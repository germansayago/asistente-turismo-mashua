import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { qualificationPrompt } from "./prompts";

const powerfulLLM = new ChatOpenAI({ modelName: "gpt-4o", temperature: 0 });

type ChatHistoryMessage = {
  sender: "user" | "bot";
  text: string;
};

/**
 * Ejecuta la cadena de calificación para hacer una pregunta al usuario.
 */
export async function runQualification(
  history: (AIMessage | HumanMessage)[],
  input: string
): Promise<string> {
  const qualificationChain = qualificationPrompt.pipe(powerfulLLM);
  const result = await qualificationChain.invoke({
    chat_history: history,
    input,
  });
  return typeof result.content === "string"
    ? result.content
    : JSON.stringify(result.content);
}

/**
 * Extrae los datos de contacto, envía el webhook y devuelve una respuesta de confirmación.
 */
export async function handleContactHandoff(
  question: string,
  chat_history: ChatHistoryMessage[]
): Promise<string> {
  // 1. Prompt de extracción mucho más robusto
  const contactExtractionPrompt = ChatPromptTemplate.fromTemplate(
    `Analiza la siguiente conversación y extrae el nombre, el email y el número de teléfono del cliente.
        
        CONVERSACIÓN:
        {chat_history_text}
        
        REGLAS ESTRICTAS:
        - Tu respuesta DEBE SER ÚNICAMENTE un objeto JSON válido.
        - Las claves del JSON deben ser "nombre", "email", y "telefono".
        - Si no encuentras algún dato, usa un string vacío "" como valor para esa clave.
        - NO incluyas explicaciones, saludos, ni formato Markdown (como \`\`\`json).`
  );

  const contactExtractionChain = contactExtractionPrompt
    .pipe(powerfulLLM)
    .pipe(new StringOutputParser());

  // Incluimos el último mensaje en el historial para el análisis
  const fullHistoryForExtraction = [
    ...chat_history,
    { sender: "user" as const, text: question },
  ];
  const chatHistoryText = fullHistoryForExtraction
    .map((msg) => `${msg.sender}: ${msg.text}`)
    .join("\n");

  const contactInfoResponse = await contactExtractionChain.invoke({
    chat_history_text: chatHistoryText,
  });

  let contactInfo = { nombre: "", email: "", telefono: "" };

  // 2. Lógica de parseo más segura
  try {
    contactInfo = JSON.parse(contactInfoResponse);
  } catch (e) {
    console.warn(
      "Fallo el parseo inicial de JSON. Intentando limpiar la respuesta del LLM..."
    );
    const jsonMatch = contactInfoResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch && jsonMatch[0]) {
      try {
        contactInfo = JSON.parse(jsonMatch[0]);
      } catch (e2) {
        console.error(
          "Fallo el parseo de JSON incluso después de limpiar.",
          e2
        );
        throw new Error("No se pudo extraer el JSON de la respuesta del LLM.");
      }
    } else {
      throw new Error("No se encontró un objeto JSON en la respuesta del LLM.");
    }
  }

  const chatTranscript = fullHistoryForExtraction
    .map(
      (msg) => `${msg.sender === "user" ? "Cliente" : "Asistente"}: ${msg.text}`
    )
    .join("\n\n");

  const webhookUrl = process.env.MAKE_WEBHOOK_URL;
  if (webhookUrl) {
    fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: contactInfo.nombre,
        email: contactInfo.email,
        telefono: contactInfo.telefono,
        consulta_final: question,
        historial_chat: chatTranscript,
        fecha_lead: new Date().toISOString(),
      }),
    }).catch((err) => console.error("Error al enviar webhook:", err));
  }

  return `¡Muchas gracias, ${
    contactInfo.nombre || "viajero"
  }! He enviado tu consulta a nuestro equipo. Te contactarán a tu email (${
    contactInfo.email || "no provisto"
  }) o por WhatsApp en breve.`;
}
