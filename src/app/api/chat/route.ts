// /src/app/api/chat/route.ts
import { NextResponse } from "next/server";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { promises as fs } from "fs";
import path from "path";
import { Document } from "@langchain/core/documents";
import { createHistoryAwareRetriever } from "langchain/chains/history_aware_retriever";
import { AIMessage, HumanMessage } from "@langchain/core/messages";

export async function POST(req: Request) {
  try {
    const { question, chat_history } = await req.json();
    if (!question) {
      return NextResponse.json(
        { message: "No question provided" },
        { status: 400 }
      );
    }

    // --- Carga de la base de datos desde db.json ---
    const embeddings = new OpenAIEmbeddings();
    const dbFilePath = path.resolve(process.cwd(), "db.json");
    const savedData = JSON.parse(await fs.readFile(dbFilePath, "utf-8"));
    const { MemoryVectorStore } = await import("langchain/vectorstores/memory");
    const vectorStore = new MemoryVectorStore(embeddings);
    await vectorStore.addVectors(
      savedData.vectors,
      savedData.content.map(
        (pageContent: string, i: number) =>
          new Document({ pageContent, metadata: savedData.documents[i] })
      )
    );
    const retriever = vectorStore.asRetriever({ k: 4 });
    const llm = new ChatOpenAI({ modelName: "gpt-4o" });

    // --- Cadena para hacer la pregunta consciente del historial ---
    const historyAwarePrompt = ChatPromptTemplate.fromMessages([
      new MessagesPlaceholder("chat_history"),
      ["user", "{input}"],
      [
        "user",
        "Dada la conversación anterior, genera una pregunta de búsqueda que sea autocontenida para obtener información relevante para responder la pregunta del usuario.",
      ],
    ]);
    const historyAwareRetrieverChain = await createHistoryAwareRetriever({
      llm,
      retriever,
      rephrasePrompt: historyAwarePrompt,
    });

    // --- Prompt final para generar la respuesta ---
    const answerGenerationPrompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        `Eres un asistente virtual especializado ÚNICAMENTE en los productos y servicios de una agencia de turismo. Tu única función es responder preguntas sobre viajes basándote en el contexto proporcionado.

      Reglas estrictas:
      - NUNCA respondas a preguntas que no estén directamente relacionadas con turismo o con la información contenida en el contexto.
      - Si el usuario pregunta por cualquier otro tema (como recetas, matemáticas, historia general, etc.), debes declinar amablemente la respuesta. Responde algo como: "Lo siento, solo puedo ayudarte con preguntas sobre nuestros destinos y paquetes turísticos".
      - Basa tus respuestas exclusivamente en el contexto recuperado. No inventes información.

      Contexto: {context}`,
      ],
      new MessagesPlaceholder("chat_history"),
      ["user", "{input}"],
    ]);
    const documentChain = await createStuffDocumentsChain({
      llm,
      prompt: answerGenerationPrompt,
    });

    // --- Lógica principal ---
    const history = (chat_history || []).map(
      (msg: { sender: string; text: string }) =>
        msg.sender === "user"
          ? new HumanMessage(msg.text)
          : new AIMessage(msg.text)
    );

    const retrieverResult = await historyAwareRetrieverChain.invoke({
      chat_history: history,
      input: question,
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // --- Lógica de filtrado simplificada usando metadatos ---
    const filteredDocs = retrieverResult.filter((doc) => {
      if (doc.metadata.type !== "Promoción") {
        return true;
      }

      const vigencia = doc.metadata.vigencia as string | undefined;

      if (vigencia) {
        const vigenciaDate = new Date(vigencia);
        return vigenciaDate >= today;
      }

      return false;
    });

    const conversationalRetrievalChain = await createRetrievalChain({
      retriever: historyAwareRetrieverChain,
      combineDocsChain: documentChain,
    });

    const result = await conversationalRetrievalChain.invoke({
      chat_history: history,
      input: question,
      context: filteredDocs,
    });

    return NextResponse.json({ answer: result.answer });
  } catch (error) {
    console.error("Error en el chat:", error);
    return NextResponse.json(
      { message: "Error procesando la solicitud" },
      { status: 500 }
    );
  }
}
