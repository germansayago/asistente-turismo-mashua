// /src/app/api/sync/route.ts
import { NextResponse } from "next/server";
// Ya no necesitamos importar 'headers' de 'next/headers'
import { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings } from "@langchain/openai";
import { promises as fs } from "fs";
import path from "path";

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

// 1. Usamos el parámetro 'request' que nos llega
export async function GET(request: Request) {
  // 2. Obtenemos los headers directamente desde el objeto 'request'
  const authorization = request.headers.get("authorization");

  if (authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

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

    const postDocuments = posts.map(
      (post: WordPressItem) =>
        new Document({
          pageContent: post.content.rendered.replace(/<[^>]*>/g, "").trim(),
          metadata: {
            source: post.link,
            title: post.title.rendered,
            type: "Blog Post",
          },
        })
    );

    const promoDocuments = promos.map(
      (promo: WordPressItem) =>
        new Document({
          pageContent: promo.content.rendered.replace(/<[^>]*>/g, "").trim(),
          metadata: {
            source: promo.link,
            title: promo.title.rendered,
            type: "Promoción",
            vigencia: promo.fecha_vigente,
          },
        })
    );

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
    return NextResponse.json(
      { message: "Error en la sincronización" },
      { status: 500 }
    );
  }
}
