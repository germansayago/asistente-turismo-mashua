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
import { Langfuse } from "langfuse";
import { CallbackHandler } from "langfuse-langchain";

// Instancia del cliente de Langfuse para la observabilidad
const langfuse = new Langfuse({
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  baseUrl: process.env.LANGFUSE_BASEURL,
});

// Modelo de lenguaje para el agente
const llm = new ChatOpenAI({ modelName: "gpt-4o", temperature: 0.7 });

// Definición de la herramienta para derivar leads.
// El esquema Zod describe los datos que la herramienta espera.
const HandoffTool = z
  .object({
    nombre: z.string().describe("Nombre del cliente"),
    email: z.string().describe("Email del cliente"),
    telefono: z.string().describe("Teléfono del cliente"),
    procedencia: z
      .string()
      .describe("Ciudad o país desde donde escribe el cliente"),
    consulta: z.string().describe("Un resumen de la consulta del cliente"),
  })
  .describe(
    "Usa esta herramienta cuando hayas recolectado toda la información de contacto del cliente."
  );

// Vinculamos la herramienta al modelo LLM.
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

// Prompt principal del sistema. Define la personalidad, el flujo y las reglas del agente.
const masterPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `Eres un asistente de viajes experto, amigable y proactivo para la agencia "Mashua". Tu único y estricto objetivo es calificar a los clientes potenciales a través de una conversación natural y guiada, y usar la herramienta 'derivar_a_vendedor' cuando tengas toda la información.

    **TU FLUJO DE CONVERSACIÓN SE BASA EN ESTAS REGLAS:**

    1.  **MANTÉN EL FOCO:** Si el usuario pregunta sobre cualquier tema que no esté relacionado con viajes o la agencia "Mashua", debes responder de manera educada que tu especialidad es el turismo y que no puedes ayudar con esa consulta. **Bajo ninguna circunstancia, respondas a preguntas irrelevantes.**

    2.  **FLUJO DE CALIFICACIÓN:**
        a. Inicia la conversación de forma amigable y pregunta por las necesidades del cliente (con quién viaja, de dónde escribe, qué experiencia busca).
        b. Una vez que tengas suficiente información para ofrecer valor (usando el Contexto), hazlo con 1-2 frases cortas y atractivas.
        c. Inmediatamente después, ofrece conectar al cliente con un asesor experto para una cotización.
        d. Si el cliente acepta, **DEBES iniciar el proceso de recolección de datos.** La primera cosa que debes hacer es pedir amablemente el nombre del cliente. Luego, pide un dato a la vez:
           - Nombre
           - Email
           - Teléfono
        e. Cuando tengas todos los datos (nombre, email, teléfono, procedencia), **NO GENERES MÁS TEXTO. Únicamente usa la herramienta 'derivar_a_vendedor'**.

    3. **REGLAS DE SEGURIDAD:**
        - **NUNCA RESPONDAS CON UN MENSAJE VACÍO.** Si no sabes qué decir o si el flujo se interrumpe, genera una respuesta que pida de nuevo el dato que te falta (por ejemplo: "¿Cuál es tu email, por favor?").
        - **NO INVENTES:** Si la información no está en el 'Contexto de búsqueda', no la generes.

    Contexto de búsqueda:
    {context}`,
  ],
  new MessagesPlaceholder("chat_history"),
  ["user", "{input}"],
]);

// La cadena principal que orquesta el prompt y el modelo con las herramientas.
const chain = masterPrompt.pipe(llmWithTools);

// Endpoint de la API para las interacciones del chat.
export async function POST(req: Request) {
  let trace = null;

  try {
    // Extraemos los datos de la solicitud, incluyendo el ID de usuario.
    const { question, chat_history, userId } = await req.json();

    // Validamos el ID de usuario o asignamos uno anónimo por defecto.
    const validatedUserId =
      userId && typeof userId === "string" ? userId : "anonymous-user";

    // Iniciamos la traza de Langfuse para esta conversación.
    trace = langfuse.trace({
      name: "user-chat-request",
      userId: validatedUserId,
    });

    const langfuseHandler = new CallbackHandler({ root: trace });

    // Convertimos el historial de chat al formato de LangChain.
    const history = (chat_history || []).map(
      (msg: { sender: string; text: string }) =>
        msg.sender === "user"
          ? new HumanMessage(msg.text)
          : new AIMessage(msg.text)
    );

    // --- LÓGICA DE RAG (BÚSQUEDA) ---
    // Leemos la base de datos de conocimiento local.
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
    // Recuperamos los documentos más relevantes para la pregunta del usuario.
    const retriever = vectorStore.asRetriever({ k: 3 });
    const relevantDocs = await retriever.invoke(question);
    const context = relevantDocs.map((doc) => doc.pageContent).join("\n\n");

    // --- INVOCAMOS LA CADENA PRINCIPAL ---
    // Pasamos el historial, la pregunta y el contexto al LLM.
    const result = await chain.invoke(
      {
        chat_history: history,
        input: question,
        context: context,
      },
      { callbacks: [langfuseHandler] }
    );

    let answer = "";

    // --- MANEJO DE LA RESPUESTA: TEXTO O ACCIÓN ---
    // Verificamos si el resultado es una llamada a una herramienta.
    if (result.tool_calls && result.tool_calls.length > 0) {
      const toolCall = result.tool_calls[0];
      const contactInfo = toolCall.args;
      trace.span({ name: "handoff-to-sales", input: contactInfo });

      const fullHistoryText = [...history, new HumanMessage(question)]
        .map((msg) => msg.content)
        .join("\n");

      // Enviamos los datos del lead al webhook externo.
      const webhookUrl = process.env.MAKE_WEBHOOK_URL;
      if (webhookUrl) {
        fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: contactInfo.nombre,
            email: contactInfo.email,
            telefono: contactInfo.telefono,
            procedencia: contactInfo.procedencia,
            consulta: contactInfo.consulta,
            historial_chat: fullHistoryText,
            fecha_lead: new Date().toISOString(),
          }),
        }).catch((err) => console.error("Error al enviar webhook:", err));
      }

      answer = `¡Muchas gracias, ${contactInfo.nombre}! He enviado tu consulta a nuestro equipo. Te contactarán a tu email (${contactInfo.email}) o por WhatsApp en breve.`;
    } else {
      // Si no es una llamada a una herramienta, devolvemos la respuesta de texto.
      answer = result.content as string;
      // Capa de seguridad: si la respuesta es vacía, usamos un fallback.
      if (!answer || answer.trim() === "") {
        console.warn("Respuesta nula o vacía del LLM. Usando fallback.");
        answer =
          "¿Cuál es tu nombre? Con eso, podemos empezar a planificar tu viaje.";
      }
    }

    return NextResponse.json({ answer });
  } catch (error) {
    console.error("Error en el asistente:", error);
    if (trace) {
      trace.update({ metadata: { error: (error as Error).toString() } });
    }
    return NextResponse.json(
      { message: "Error en el asistente" },
      { status: 500 }
    );
  } finally {
    // Patrón robusto para serverless: Flushear todos los eventos pendientes.
    await langfuse.shutdownAsync();
  }
}
