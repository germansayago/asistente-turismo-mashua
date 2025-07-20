import { NextResponse } from "next/server";
import { ChatOpenAI } from "@langchain/openai";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { runRAGChain } from "@/lib/rag-chain";
import {
  routingJsonSchema,
  routingPrompt,
  intentClassifierPrompt,
} from "@/lib/prompts";
import { handleContactHandoff, runQualification } from "@/lib/agent-actions";

const llm = new ChatOpenAI({ modelName: "gpt-3.5-turbo", temperature: 0 });

// --- DEFINICIÓN DE CADENAS (usando los prompts importados) ---
const intentClassifierChain = intentClassifierPrompt
  .pipe(llm)
  .pipe(new StringOutputParser());

const llmWithTools = llm.bindTools(
  [
    {
      type: "function",
      function: {
        name: "routing_decision",
        description: "Toma la decisión de enrutamiento.",
        parameters: routingJsonSchema,
      },
    },
  ],
  { tool_choice: "routing_decision" }
);
const routingChain = routingPrompt.pipe(llmWithTools);

export async function POST(req: Request) {
  try {
    const { question, chat_history } = await req.json();
    const history = (chat_history || []).map(
      (msg: { sender: string; text: string }) =>
        msg.sender === "user"
          ? new HumanMessage(msg.text)
          : new AIMessage(msg.text)
    );

    // --- LÓGICA ESPECIAL PARA EL PRIMER MENSAJE ---
    if (history.length === 0) {
      console.log("Primer mensaje. Clasificando intención...");
      const intent = await intentClassifierChain.invoke({ input: question });
      console.log(`Intención inicial: ${intent}`);

      let firstAnswer = "";
      if (intent.includes("informativa")) {
        firstAnswer =
          "¡Hola! Bienvenido a nuestra agencia. Si buscas inspiración o información sobre destinos, nuestro blog es el lugar perfecto. ¿Sobre qué destino te gustaría que te recomiende un artículo?";
      } else {
        // 'transaccional'
        firstAnswer = await runQualification(history, question);
      }
      return NextResponse.json({ answer: firstAnswer });
    }

    // --- EL ORQUESTADOR NORMAL TOMA EL CONTROL A PARTIR DEL SEGUNDO MENSAJE ---
    const routeResult = await routingChain.invoke({
      chat_history: history.slice(-4), // Usamos historial reciente
      input: question,
    });
    const route = routeResult.tool_calls?.[0]?.args?.decision || "fallback";
    console.log(
      `Pregunta: "${question}" -> Decisión del Orquestador: ${route}`
    );

    let answer = "";
    switch (route) {
      case "calificar":
        answer = await runQualification(history, question);
        break;
      case "solicitar_nombre":
        answer = "¡Perfecto! Para empezar, ¿cuál es tu nombre?";
        break;
      case "solicitar_email":
        answer = "¡Gracias! Ahora, ¿cuál es tu dirección de email?";
        break;
      case "solicitar_telefono":
        answer =
          "Genial. Por último, ¿cuál es tu número de teléfono para contactarte por WhatsApp?";
        break;
      case "procesar_contacto_final":
        answer = await handleContactHandoff(question, chat_history);
        break;
      case "asesor":
        answer = await runRAGChain(question, chat_history, "asesor");
        break;
      case "comercial":
      case "servicio_agencia":
        answer = await runRAGChain(question, chat_history, "comercial");
        break;
      case "fallback":
      default:
        answer = await runRAGChain(question, chat_history, "asesor");
        break;
    }

    return NextResponse.json({ answer });
  } catch (error) {
    console.error("Error en el orquestador:", error);
    return NextResponse.json(
      { message: "Error en el orquestador" },
      { status: 500 }
    );
  }
}
