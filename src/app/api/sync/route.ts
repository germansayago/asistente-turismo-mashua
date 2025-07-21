// /src/app/api/sync/route.ts
// Este archivo es un agente de sincronización que se ejecuta como un cron job.
// Se encarga de extraer datos de WordPress, resumirlos, crear embeddings
// y actualizar una base de datos vectorial local.

import { NextResponse } from "next/server";
import { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { promises as fs } from "fs";
import path from "path";
import { Langfuse } from "langfuse";
import { CallbackHandler } from "langfuse-langchain";

// Definimos la estructura de los datos que esperamos de WordPress.
interface WordPressItem {
  link: string;
  title: { rendered: string };
  content: { rendered: string };
  fecha_vigente?: string;
}

// URLs de los endpoints de la API de WordPress para posts y promociones.
const WORDPRESS_POSTS_URL =
  "https://mashua.com.ar/wp-json/wp/v2/posts?per_page=50&_fields=id,title,content,link";
const WORDPRESS_PROMOS_URL =
  "https://mashua.com.ar/wp-json/wp/v2/promocion?per_page=50&_fields=id,title,content,link,fecha_vigente";

// Instancia del cliente de Langfuse para enviar trazas y métricas.
const langfuse = new Langfuse({
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  baseUrl: process.env.LANGFUSE_BASEURL,
});

// Instancia de un LLM de bajo costo para generar resúmenes de los documentos.
const summarizerLlm = new ChatOpenAI({
  modelName: "gpt-3.5-turbo-0125",
  temperature: 0.1,
});

// Prompt para guiar al LLM en la tarea de resumen.
const summaryPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "Eres un asistente experto en resumir textos. Tu única tarea es leer el texto proporcionado y devolver un resumen conciso que capture los puntos más importantes. El resumen debe ser de una a dos frases. Proporciona solo el resumen, sin saludos ni ningún otro texto adicional.",
  ],
  ["user", "{text_to_summarize}"],
]);

// Función auxiliar para generar un resumen de texto usando el LLM.
async function generateSummary(
  text: string,
  handler: CallbackHandler
): Promise<string> {
  const result = await summaryPrompt
    .pipe(summarizerLlm)
    .invoke({ text_to_summarize: text }, { callbacks: [handler] });
  return result.content as string;
}

// Endpoint GET de la API que ejecuta la sincronización.
export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");

  if (authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Creamos una traza en Langfuse para monitorizar todo el proceso.
  const trace = langfuse.trace({
    name: "data-sync",
    input: {
      url_posts: WORDPRESS_POSTS_URL,
      url_promos: WORDPRESS_PROMOS_URL,
    },
    userId: "sync-agent-cron",
  });

  try {
    console.log("Iniciando sincronización automática...");

    // Fetcheamos los datos de WordPress en paralelo para optimizar el tiempo.
    const [postsResponse, promosResponse] = await Promise.all([
      fetch(WORDPRESS_POSTS_URL),
      fetch(WORDPRESS_PROMOS_URL),
    ]);

    if (!postsResponse.ok || !promosResponse.ok) {
      throw new Error("Error al obtener datos de WordPress");
    }

    const posts: WordPressItem[] = await postsResponse.json();
    const promos: WordPressItem[] = await promosResponse.json();

    // Mapeamos los datos para generar documentos de LangChain,
    // creando un resumen para cada uno con una llamada al LLM.
    const postPromises = posts.map(async (post) => {
      const cleanedContent = post.content.rendered
        .replace(/<[^>]*>/g, "")
        .trim();

      // Creamos un span para monitorear la llamada al LLM para este documento.
      const summarySpan = trace.span({
        name: "generate-summary-post",
        input: cleanedContent,
        metadata: {
          title: post.title.rendered,
        },
      });
      const summaryHandler = new CallbackHandler({ root: summarySpan });
      const summary = await generateSummary(cleanedContent, summaryHandler);
      summarySpan.update({ output: summary });
      summarySpan.end();

      return new Document({
        pageContent: summary,
        metadata: {
          source: post.link,
          title: post.title.rendered,
          type: "Blog Post",
        },
      });
    });

    const promoPromises = promos.map(async (promo) => {
      const cleanedContent = promo.content.rendered
        .replace(/<[^>]*>/g, "")
        .trim();

      const summarySpan = trace.span({
        name: "generate-summary-promo",
        input: cleanedContent,
        metadata: {
          title: promo.title.rendered,
        },
      });
      const summaryHandler = new CallbackHandler({ root: summarySpan });
      const summary = await generateSummary(cleanedContent, summaryHandler);
      summarySpan.update({ output: summary });
      summarySpan.end();

      return new Document({
        pageContent: summary,
        metadata: {
          source: promo.link,
          title: promo.title.rendered,
          type: "Promoción",
          vigencia: promo.fecha_vigente,
        },
      });
    });

    const postDocuments = await Promise.all(postPromises);
    const promoDocuments = await Promise.all(promoPromises);

    const allDocuments = [...postDocuments, ...promoDocuments];

    if (allDocuments.length === 0) {
      return NextResponse.json({
        message: "No se encontraron documentos para procesar",
      });
    }

    console.log(
      `Creando vectores para ${allDocuments.length} documentos en total...`
    );
    // Creamos los embeddings a partir de los documentos resumidos.
    const embeddings = new OpenAIEmbeddings();
    const { MemoryVectorStore } = await import("langchain/vectorstores/memory");
    const vectorStore = await MemoryVectorStore.fromDocuments(
      allDocuments,
      embeddings
    );

    // Guardamos el vector store en un archivo local para que el agente de chat pueda usarlo.
    const dbFilePath = path.resolve(process.cwd(), "db.json");
    await fs.writeFile(
      dbFilePath,
      JSON.stringify({
        documents: vectorStore.memoryVectors.map((mv) => mv.metadata),
        vectors: vectorStore.memoryVectors.map((mv) => mv.embedding),
        content: vectorStore.memoryVectors.map((mv) => mv.content),
      })
    );

    console.log(
      "Base de datos local actualizada con posts y promociones en db.json!"
    );
    return NextResponse.json({ message: "Sincronización completada" });
  } catch (error) {
    console.error("Error en sincronización:", error);
    // Registramos el error en la traza de Langfuse.
    trace.update({ metadata: { error: (error as Error).toString() } });
    return NextResponse.json(
      { message: "Error en la sincronización" },
      { status: 500 }
    );
  } finally {
    // Cerramos el cliente de Langfuse para asegurar que los datos se envíen.
    await langfuse.shutdownAsync();
  }
}
