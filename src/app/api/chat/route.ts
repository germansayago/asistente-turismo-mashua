import { NextResponse } from "next/server";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { Document } from "@langchain/core/documents";
import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const llm = new ChatOpenAI({ modelName: "gpt-4o", temperature: 0.7 });

// --- 1. ACTUALIZAMOS LA HERRAMIENTA PARA INCLUIR LA PROCEDENCIA ---
const HandoffTool = z
  .object({
    nombre: z.string().describe("Nombre del cliente"),
    email: z.string().describe("Email del cliente"),
    telefono: z.string().describe("Teléfono del cliente"),
    procedencia: z
      .string()
      .describe("Ciudad o país desde donde escribe el cliente"), // <-- Nuevo campo
    consulta: z.string().describe("Un resumen de la consulta del cliente"),
  })
  .describe(
    "Usa esta herramienta cuando hayas recolectado toda la información de contacto del cliente."
  );

const llmWithTools = llm.bindTools([
  {
    type: "function",
    function: {
      name: "derivar_a_vendedor",
      description: "Envía los datos del lead calificado al equipo de ventas.",
      parameters: zodToJsonSchema(HandoffTool),
    },
  },
]);

// --- 2. ACTUALIZAMOS EL "CEREBRO" CON LA NUEVA PREGUNTA ---
const masterPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `Eres un asistente de viajes experto, amigable y proactivo para la agencia "Mashua". Tu objetivo es calificar a los clientes potenciales a través de una conversación natural y guiada.

    **TU FLUJO DE CONVERSACIÓN EN 5 PASOS:**

    1.  **SALUDO Y CALIFICACIÓN INICIAL:**
        - Si es el primer mensaje, saluda cálidamente y haz una pregunta abierta (ej: "¿A dónde te gustaría viajar?").
        - Continúa haciendo preguntas una por una para entender las necesidades del cliente: con quién viaja, **de dónde nos escribe**, y qué tipo de experiencia busca. Sé siempre breve.

    2.  **APORTE DE VALOR (usando el CONTEXTO):**
        - Una vez que tienes suficiente información, busca en tu contexto la información más relevante.
        - Ofrece un resumen MUY CORTO y atractivo (1-2 frases).

    3.  **TRANSICIÓN A LA VENTA:**
        - Inmediatamente después de aportar valor, haz la transición a la venta.
        - **Ejemplo:** "Basado en esto, puedo ayudarte a armar una cotización. ¿Te gustaría que te ponga en contacto con uno de nuestros asesores expertos?"

    4.  **CAPTURA DE DATOS SECUENCIAL:**
        - Si el usuario acepta, pide los datos de contacto UNO POR UNO: nombre, email y teléfono.

    5.  **ACCIÓN FINAL (usar la herramienta 'derivar_a_vendedor'):**
        - Una vez que tengas TODOS los datos (nombre, email, teléfono, y la procedencia que ya preguntaste), NO respondas más. Usa la herramienta 'derivar_a_vendedor' para enviar la información.

    Contexto de búsqueda:
    {context}`,
  ],
  new MessagesPlaceholder("chat_history"),
  ["user", "{input}"],
]);

const chain = masterPrompt.pipe(llmWithTools);

export async function POST(req: Request) {
  try {
    const { question, chat_history } = await req.json();
    const history = (chat_history || []).map(
      (msg: { sender: string; text: string }) =>
        msg.sender === "user"
          ? new HumanMessage(msg.text)
          : new AIMessage(msg.text)
    );

    // --- LÓGICA DE RAG (BÚSQUEDA) ---
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
    const relevantDocs = await retriever.invoke(question);
    const context = relevantDocs.map((doc) => doc.pageContent).join("\n\n");

    // --- INVOCAMOS LA CADENA PRINCIPAL ---
    const result = await chain.invoke({
      chat_history: history,
      input: question,
      context: context,
    });

    let answer = "";

    // --- MANEJO DE LA RESPUESTA: TEXTO O ACCIÓN ---
    if (result.tool_calls && result.tool_calls.length > 0) {
      const toolCall = result.tool_calls[0];
      const contactInfo = toolCall.args;

      const fullHistoryText = [...history, new HumanMessage(question)]
        .map((msg) => msg.content)
        .join("\n");

      const webhookUrl = process.env.MAKE_WEBHOOK_URL;
      if (webhookUrl) {
        fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // --- 3. AÑADIMOS EL NUEVO DATO AL WEBHOOK ---
          body: JSON.stringify({
            nombre: contactInfo.nombre,
            email: contactInfo.email,
            telefono: contactInfo.telefono,
            procedencia: contactInfo.procedencia, // <-- Nuevo dato
            consulta: contactInfo.consulta,
            historial_chat: fullHistoryText,
            fecha_lead: new Date().toISOString(),
          }),
        }).catch((err) => console.error("Error al enviar webhook:", err));
      }

      answer = `¡Muchas gracias, ${contactInfo.nombre}! He enviado tu consulta a nuestro equipo. Te contactarán a tu email (${contactInfo.email}) o por WhatsApp en breve.`;
    } else {
      answer = result.content as string;
    }

    return NextResponse.json({ answer });
  } catch (error) {
    console.error("Error en el asistente:", error);
    return NextResponse.json(
      { message: "Error en el asistente" },
      { status: 500 }
    );
  }
}
