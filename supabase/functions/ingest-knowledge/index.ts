import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/+esm";
import pdfParse from "https://cdn.jsdelivr.net/npm/pdf-parse@1.1.1/+esm";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const QDRANT_URL = Deno.env.get("QDRANT_URL")!;
const QDRANT_API_KEY = Deno.env.get("QDRANT_API_KEY") ?? "";
const COLLECTION = "xpert_knowledge";

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 150;

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

async function embedTexts(texts: string[]): Promise<number[][]> {
  const pipe = await getEmbedder();
  const results: number[][] = [];
  for (const text of texts) {
    const output = await pipe(text, { pooling: "mean", normalize: true });
    results.push(Array.from(output.data as Float32Array));
  }
  return results;
}

function chunkText(text: string): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let start = 0;
  while (start < words.length) {
    const end = Math.min(start + CHUNK_SIZE, words.length);
    chunks.push(words.slice(start, end).join(" "));
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks.filter((c) => c.trim().length > 80);
}

// Upsert no Qdrant usando o ID determinístico (tenant+source+index)
// para garantir idempotência em re-uploads do mesmo PDF
function makePointId(tenantId: string, source: string, chunkIndex: number): string {
  const str = `${tenantId}:${source}:${chunkIndex}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) >>> 0;
  }
  return hash.toString();
}

async function upsertToQdrant(points: object[]): Promise<void> {
  const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION}/points?wait=true`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(QDRANT_API_KEY ? { "api-key": QDRANT_API_KEY } : {}),
    },
    body: JSON.stringify({ points }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Qdrant upsert error: ${err}`);
  }
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const tenantId = formData.get("tenant_id") as string;

    if (!file || !tenantId) {
      return new Response(
        JSON.stringify({ error: "Campos 'file' e 'tenant_id' são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const buffer = await file.arrayBuffer();
    const pdfData = await pdfParse(Buffer.from(buffer));
    const chunks = chunkText(pdfData.text);

    console.log(`PDF "${file.name}": ${chunks.length} chunks`);

    const BATCH = 10;
    let total = 0;

    for (let i = 0; i < chunks.length; i += BATCH) {
      const batch = chunks.slice(i, i + BATCH);
      const embeddings = await embedTexts(batch);

      const points = batch.map((content, j) => ({
        id: makePointId(tenantId, file.name, i + j),
        vector: embeddings[j],
        payload: {
          tenant_id: tenantId,
          source: file.name,
          chunk_index: i + j,
          content,
        },
      }));

      await upsertToQdrant(points);
      total += batch.length;
      console.log(`Progresso: ${total}/${chunks.length}`);
    }

    return new Response(
      JSON.stringify({ success: true, chunks: total, source: file.name }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
