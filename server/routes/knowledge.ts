import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import { pipeline, env } from '@xenova/transformers';
import { v5 as uuidv5 } from 'uuid';

const router = Router();
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const COLLECTION = "xpert_knowledge";

// UUID Namespace for deterministic IDs
const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

// Configure Transformers.js to use local models only
env.localModelPath = '/var/www/xpert/models';
env.allowRemoteModels = false;

// Singleton for the embedder to avoid reloading model
let embedder: any = null;

async function getEmbedder() {
    if (!embedder) {
        console.log('[Knowledge] Loading local gte-small model...');
        embedder = await pipeline('feature-extraction', 'Xenova/gte-small', {
            quantized: true,
        });
        console.log('[Knowledge] Model loaded successfully.');
    }
    return embedder;
}

async function embedTexts(texts: string[]): Promise<number[][]> {
    const pipe = await getEmbedder();
    const results: number[][] = [];
    for (const text of texts) {
        const output = await pipe(text, { pooling: 'mean', normalize: true });
        results.push(Array.from(output.data));
    }
    return results;
}

function chunkText(text: string): string[] {
    const CHUNK_SIZE = 800;
    const CHUNK_OVERLAP = 150;
    const words = text.split(/\s+/);
    const chunks: string[] = [];
    let start = 0;
    
    while (start < words.length) {
        const end = Math.min(start + CHUNK_SIZE, words.length);
        chunks.push(words.slice(start, end).join(" "));
        start += CHUNK_SIZE - CHUNK_OVERLAP;
    }
    return chunks.filter(c => c.trim().length > 80);
}

async function upsertToQdrant(points: any[], retries = 3) {
    if (!QDRANT_URL) throw new Error('QDRANT_URL not configured');
    
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION}/points?wait=true`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(QDRANT_API_KEY ? { 'api-key': QDRANT_API_KEY } : {}),
                },
                body: JSON.stringify({ points }),
            });

            if (!res.ok) {
                const err = await res.text();
                throw new Error(`Qdrant error: ${err}`);
            }
            return; // Success
        } catch (error: any) {
            console.warn(`[Knowledge] Qdrant upload attempt ${attempt} failed: ${error.message}`);
            if (attempt === retries) throw error;
            // Wait 1s, then 2s, before retrying
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }
}

// ROUTE: Ingest PDF — com tratamento correto de erros do multer
router.post('/ingest', (req: Request, res: Response, next: any) => {
    upload.single('file')(req, res, (err: any) => {
        if (err) {
            // Erro vindo do multer (ex: arquivo muito grande)
            console.error('[Knowledge Multer Error]:', err);
            return res.status(400).json({ 
                error: err.code === 'LIMIT_FILE_SIZE' 
                    ? 'Arquivo muito grande. Limite máximo: 50MB.' 
                    : `Erro no upload: ${err.message}` 
            });
        }
        next();
    });
}, async (req: Request, res: Response): Promise<void> => {
    try {
        const file = req.file;
        const tenantId = req.body.tenant_id;

        if (!file || !tenantId) {
            res.status(400).json({ error: 'Arquivo e tenant_id são obrigatórios' });
            return;
        }

        console.log(`[Knowledge] Ingesting PDF: ${file.originalname} for ${tenantId}`);
        
        const pdfData = await pdfParse(file.buffer);
        const chunks = chunkText(pdfData.text);
        
        console.log(`[Knowledge] Split into ${chunks.length} chunks`);

        const BATCH_SIZE = 5;
        let totalProcessed = 0;

        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
            const batch = chunks.slice(i, i + BATCH_SIZE);
            const embeddings = await embedTexts(batch);

            const points = batch.map((content, j) => ({
                id: uuidv5(`${tenantId}:${file.originalname}:${i + j}`, NAMESPACE),
                vector: embeddings[j],
                payload: {
                    tenant_id: tenantId,
                    source: file.originalname,
                    chunk_index: i + j,
                    content,
                },
            }));

            await upsertToQdrant(points);
            totalProcessed += batch.length;
            console.log(`[Knowledge] Progress: ${totalProcessed}/${chunks.length}`);
        }

        res.json({ success: true, chunks: totalProcessed, source: file.originalname });
    } catch (error) {
        console.error('[Knowledge Ingest Error]:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
});

// ROUTE: Query Knowledge
router.post('/query', async (req: Request, res: Response): Promise<void> => {
    try {
        const { question, tenant_id, match_count = 5, threshold = 0.65 } = req.body;

        if (!question || !tenant_id) {
            res.status(400).json({ error: 'question e tenant_id são obrigatórios' });
            return;
        }

        if (!QDRANT_URL) throw new Error('QDRANT_URL not configured');

        const [queryEmbedding] = await embedTexts([question]);

        const searchRes = await fetch(`${QDRANT_URL}/collections/${COLLECTION}/points/search`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(QDRANT_API_KEY ? { 'api-key': QDRANT_API_KEY } : {}),
            },
            body: JSON.stringify({
                vector: queryEmbedding,
                limit: match_count,
                score_threshold: threshold,
                with_payload: true,
                filter: {
                    must: [{ key: "tenant_id", match: { value: tenant_id } }]
                }
            }),
        });

        if (!searchRes.ok) {
            const err = await searchRes.text();
            throw new Error(`Qdrant search error: ${err}`);
        }

        const data: any = await searchRes.json();
        const results = (data.result || []).map((r: any) => ({
            source: r.payload.source,
            content: r.payload.content,
            similarity: Math.round(r.score * 100) / 100,
        }));

        if (results.length === 0) {
            res.json({ context: null, sources: [] });
            return;
        }

        const context = results
            .map((c: any, i: number) => `[Referência ${i + 1} — ${c.source}]\n${c.content}`)
            .join("\n\n---\n\n");

        res.json({
            context,
            sources: results.map((c: any) => ({ source: c.source, similarity: c.similarity })),
        });

    } catch (error) {
        console.error('[Knowledge Query Error]:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
});

export { router as knowledgeRouter };
