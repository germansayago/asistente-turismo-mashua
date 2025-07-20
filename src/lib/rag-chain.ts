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
import { asesorLinkPrompt, comercialPrompt } from "./prompts";

type ChatHistoryMessage = {
  sender: "user" | "bot";
  text: string;
};

export async function runRAGChain(
  question: string,
  chat_history: ChatHistoryMessage[],
  agentType: "asesor" | "comercial" | "servicio_agencia"
) {
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
  const retriever = vectorStore.asRetriever({ k: 8 });
  const llm = new ChatOpenAI({ modelName: "gpt-4o" });

  const historyAwarePrompt = ChatPromptTemplate.fromMessages([
    new MessagesPlaceholder("chat_history"),
    ["user", "{input}"],
    [
      "user",
      "Dada la conversación anterior, genera una pregunta de búsqueda que sea autocontenida.",
    ],
  ]);
  const historyAwareRetrieverChain = await createHistoryAwareRetriever({
    llm,
    retriever,
    rephrasePrompt: historyAwarePrompt,
  });

  let answerGenerationPrompt;
  if (agentType === "asesor") {
    answerGenerationPrompt = asesorLinkPrompt;
  } else {
    answerGenerationPrompt = comercialPrompt;
  }

  const documentChain = await createStuffDocumentsChain({
    llm,
    prompt: answerGenerationPrompt,
  });

  const history = (chat_history || []).map((msg) =>
    msg.sender === "user" ? new HumanMessage(msg.text) : new AIMessage(msg.text)
  );

  const retrieverResult = await historyAwareRetrieverChain.invoke({
    chat_history: history,
    input: question,
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filteredDocs = retrieverResult.filter((doc) => {
    if (doc.metadata.type !== "Promoción") return true;
    const vigencia = doc.metadata.vigencia as string | undefined;
    if (vigencia) return new Date(vigencia) >= today;
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

  return result.answer;
}
