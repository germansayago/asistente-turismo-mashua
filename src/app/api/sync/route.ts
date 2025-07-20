// /src/app/api/sync/route.ts
import { NextResponse } from "next/server";
import { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { promises as fs } from "fs";
import path from "path";
import { Langfuse } from "langfuse";
import { CallbackHandler } from "langfuse-langchain";

interface WordPressItem {
  link: string;
  title: { rendered: string };
  content: { rendered: string };
  fecha_vigente?: string;
}

const WORDPRESS_POSTS_URL =
  "https://mashua.com.ar/wp-json/wp/v2/posts?per_page=50&_fields=id,title,content,link";
const WORDPRESS_PROMOS_URL =
  "https://mashua.com.ar/wp-json/wp/v2/promocion?per_page=50&_fields=id,title,content,link,fecha_vigente";

// Instancia de Langfuse para observabilidad
const langfuse = new Langfuse({
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  baseUrl: process.env.LANGFUSE_BASEURL,
});

// Instanciamos el LLM para la tarea de resumen
const summarizerLlm = new ChatOpenAI({
  modelName: "gpt-3.5-turbo-0125",
  temperature: 0.1,
});

// Prompt para guiar al LLM en la tarea de resumen
const summaryPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "Eres un asistente experto en resumir textos. Tu única tarea es leer el texto proporcionado y devolver un resumen conciso que capture los puntos más importantes. El resumen debe ser de una a dos frases. Proporciona solo el resumen, sin saludos ni ningún otro texto adicional.",
  ],
  ["user", "{text_to_summarize}"],
]);

// Función que se encarga de generar el resumen para un texto
async function generateSummary(
  text: string,
  handler: CallbackHandler
): Promise<string> {
  const result = await summaryPrompt
    .pipe(summarizerLlm)
    .invoke({ text_to_summarize: text }, { callbacks: [handler] });
  return result.content as string;
}

export async function GET(request: Request) {
  // const authorization = request.headers.get("authorization");

  // if (authorization !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return new NextResponse("Unauthorized", { status: 401 });
  // }

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

    const [postsResponse, promosResponse] = await Promise.all([
      fetch(WORDPRESS_POSTS_URL),
      fetch(WORDPRESS_PROMOS_URL),
    ]);

    if (!postsResponse.ok || !promosResponse.ok) {
      throw new Error("Error al obtener datos de WordPress");
    }

    const posts: WordPressItem[] = await postsResponse.json();
    const promos: WordPressItem[] = await promosResponse.json();

    const postPromises = posts.map(async (post) => {
      const cleanedContent = post.content.rendered
        .replace(/<[^>]*>/g, "")
        .trim();

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
      summarySpan.end(); // <-- ¡CORREGIDO! Usamos .end()

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
      summarySpan.end(); // <-- ¡CORREGIDO! Usamos .end()

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
    const embeddings = new OpenAIEmbeddings();

    const { MemoryVectorStore } = await import("langchain/vectorstores/memory");
    const vectorStore = await MemoryVectorStore.fromDocuments(
      allDocuments,
      embeddings
    );

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
    trace.update({ metadata: { error: (error as Error).toString() } });
    return NextResponse.json(
      { message: "Error en la sincronización" },
      { status: 500 }
    );
  } finally {
    await langfuse.shutdownAsync();
  }
}
