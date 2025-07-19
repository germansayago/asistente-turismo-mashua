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

export async function POST(req: Request) {
  try {
    const { question } = await req.json();
    if (!question) {
      return NextResponse.json(
        { message: "No question provided" },
        { status: 400 }
      );
    }

    // 1. Inicializar modelos
    const llm = new ChatOpenAI({ modelName: "gpt-4o", temperature: 0.7 });
    const embeddings = new OpenAIEmbeddings();

    // 2. Cargar documentos desde la carpeta /data
    const loader = new DirectoryLoader("src/data", {
      ".txt": (path) => new TextLoader(path),
    });
    const docs = await loader.load();
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 50,
    });
    const splitDocs = await splitter.splitDocuments(docs);

    // 3. Crear base de datos vectorial en memoria
    const vectorStore = await MemoryVectorStore.fromDocuments(
      splitDocs,
      embeddings
    );
    const retriever = vectorStore.asRetriever({ k: 2 });

    // 4. Crear la cadena de IA (RAG)
    const prompt = ChatPromptTemplate.fromTemplate(`
      Eres un asistente virtual de una agencia de turismo.
      Responde la pregunta del usuario basándote solo en este contexto:
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

    // 5. Obtener la respuesta
    const result = await retrievalChain.invoke({ input: question });

    return NextResponse.json({ answer: result.answer });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "Error processing your request" },
      { status: 500 }
    );
  }
}
