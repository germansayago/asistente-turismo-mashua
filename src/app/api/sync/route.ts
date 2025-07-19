// /src/app/api/sync/route.ts
import { NextResponse } from "next/server";
import { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings } from "@langchain/openai";
import { promises as fs } from "fs";
import path from "path";

const WORDPRESS_POSTS_URL =
  "https://mashua.com.ar/wp-json/wp/v2/posts?per_page=50&_fields=id,title,content,link";
// Asegúrate de que el campo 'fecha_vigente' esté disponible en la respuesta de la API de promociones
const WORDPRESS_PROMOS_URL =
  "https://mashua.com.ar/wp-json/wp/v2/promocion?per_page=50&_fields=id,title,content,link,fecha_vigencia";

export async function GET() {
  try {
    console.log("Iniciando sincronización de posts y promociones...");

    const [postsResponse, promosResponse] = await Promise.all([
      fetch(WORDPRESS_POSTS_URL),
      fetch(WORDPRESS_PROMOS_URL),
    ]);

    if (!postsResponse.ok || !promosResponse.ok) {
      throw new Error("Error al obtener datos de WordPress");
    }

    const posts = await postsResponse.json();
    const promos = await promosResponse.json();

    const postDocuments = posts.map(
      (post: any) =>
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
      (promo: any) =>
        new Document({
          pageContent: promo.content.rendered.replace(/<[^>]*>/g, "").trim(),
          metadata: {
            source: promo.link,
            title: promo.title.rendered,
            type: "Promoción",
            // Guardamos la fecha de vigencia en los metadatos
            vigencia: promo.fecha_vigencia,
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
