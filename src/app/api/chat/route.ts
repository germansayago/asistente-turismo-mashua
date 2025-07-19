// /app/api/chat/route.ts
import { NextResponse } from "next/server";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";

// Exporta una función nombrada para el método HTTP POST
export async function POST(req: Request) {
  try {
    // La solicitud se obtiene del primer argumento
    const { question } = await req.json();

    if (!question) {
      return NextResponse.json(
        { message: "No question provided" },
        { status: 400 }
      );
    }

    // --- La lógica de LangChain es exactamente la misma ---

    // 1. Inicializar Modelos
    const llm = new ChatOpenAI({ modelName: "gpt-4o", temperature: 0.7 });
    const embeddings = new OpenAIEmbeddings();

    // 2. Cargar y Dividir Documentos de la carpeta /data
    const loader = new DirectoryLoader("data", {
      ".txt": (path) => new TextLoader(path),
    });
    const docs = await loader.load();
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 50,
    });
    const splitDocs = await splitter.splitDocuments(docs);

    // 3. Crear Vector Store en Memoria y Recuperador
    const vectorStore = await MemoryVectorStore.fromDocuments(
      splitDocs,
      embeddings
    );
    const retriever = vectorStore.asRetriever({ k: 2 });

    // 4. Crear la Cadena RAG con un Prompt
    const prompt = ChatPromptTemplate.fromTemplate(`
      Eres un asistente virtual experto en los productos de una agencia de turismo.
      Responde la pregunta del usuario basándote únicamente en el siguiente contexto:
      <contexto>
      {context}
      </contexto>
      Pregunta: {input}
    `);

    const ragChain = await createStuffDocumentsChain({ llm, prompt });

    const retrievalChain = await createRetrievalChain({
      retriever,
      combineDocsChain: ragChain,
    });

    // 5. Invocar la cadena y obtener la respuesta
    const result = await retrievalChain.invoke({ input: question });

    // La respuesta se envía usando NextResponse.json()
    return NextResponse.json({ answer: result.answer });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "Error processing your request" },
      { status: 500 }
    );
  }
}
