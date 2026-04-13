import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { pipeline, env } from "https://esm.sh/@xenova/transformers@2.17.2?target=deno";

const QDRANT_URL = Deno.env.get("QDRANT_URL")!;
const QDRANT_API_KEY = Deno.env.get("QDRANT_API_KEY") ?? "";
const COLLECTION = "xpert_knowledge";

// Configurações para rodar em ambiente Deno / Supabase
env.allowLocalModels = false;
env.useBrowserCache = false;

let embedder: Awaited<ReturnType<typeof pipeline>> | null = null;

async function getEmbedder() {
  if (!embedder) {
    console.log("Iniciando carregamento do modelo gte-small...");
    embedder = await pipeline(
      "feature-extraction",
      "Xenova/gte-small",
      { quantized: true }
    );
    console.log("Modelo carregado com sucesso.");
  }
  return embedder;
}

async function embedQuery(text: string): Promise<number[]> {
  const pipe = await getEmbedder();
  const output = await pipe(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

async function searchQdrant(
  vector: number[],
  tenantId: string,
  limit: number,
  threshold: number
): Promise<Array<{ source: string; content: string; similarity: number }>> {
  const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION}/points/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(QDRANT_API_KEY ? { "api-key": QDRANT_API_KEY } : {}),
    },
    body: JSON.stringify({
      vector,
      limit,
      score_threshold: threshold,
      with_payload: true,
      filter: {
        must: [
          {
            key: "tenant_id",
            match: { value: tenantId },
          },
        ],
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Qdrant search error: ${err}`);
  }

  const data = await res.json();

  return (data.result ?? []).map((r: any) => ({
    source: r.payload.source,
    content: r.payload.content,
    similarity: Math.round(r.score * 100) / 100,
  }));
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': '*' } });
  }

  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const {
      question,
      tenant_id,
      match_count = 5,
      threshold = 0.65,
    } = await req.json();

    if (!question || !tenant_id) {
      return new Response(
        JSON.stringify({ error: "Campos 'question' e 'tenant_id' são obrigatórios" }),
        { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    const queryEmbedding = await embedQuery(question);
    const chunks = await searchQdrant(queryEmbedding, tenant_id, match_count, threshold);

    if (chunks.length === 0) {
      return new Response(
        JSON.stringify({ context: null, sources: [] }),
        { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    const context = chunks
      .map((c, i) => `[Referência ${i + 1} — ${c.source}]\n${c.content}`)
      .join("\n\n---\n\n");

    return new Response(
      JSON.stringify({
        context,
        sources: chunks.map((c) => ({ source: c.source, similarity: c.similarity })),
      }),
      { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  }
});
