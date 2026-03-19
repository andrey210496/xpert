import { createClient } from "npm:@supabase/supabase-js@2.39.3"
import pdfParse from "npm:pdf-parse@1.1.1"
import { Buffer } from "node:buffer"

interface ProcessPdfRequest {
    document_id: string;
    chunks_path?: string;       // Caminho no Storage para o JSON de chunks
    chunk_offset?: number;
    file_name?: string;
    agent_type?: string;
    total_chunks?: number;
}

const BATCH_SIZE = 2;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    let documentIdToUpdate = '';

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!;
        if (!geminiApiKey) throw new Error("GEMINI_API_KEY ausente!");

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const body = await req.json() as ProcessPdfRequest;
        const { document_id } = body;
        if (!document_id) throw new Error('document_id é obrigatório.');
        documentIdToUpdate = document_id;

        // ─────────────────────────────────────────
        // FASE 1: Extração do PDF (primeira chamada)
        // ─────────────────────────────────────────
        if (!body.chunks_path) {
            console.log("FASE 1: Extraindo texto do PDF...");

            const { data: docs, error: docError } = await supabase
                .from('knowledge_documents')
                .select('*')
                .eq('id', document_id);

            if (docError || !docs?.length) throw new Error(`Doc não encontrado: ${docError?.message}`);
            const doc = docs[0];

            const { data: fileData, error: dlError } = await supabase.storage
                .from('knowledge-pdfs')
                .download(doc.file_path);
            if (dlError || !fileData) throw new Error(`Download falhou: ${dlError?.message}`);

            const arrayBuffer = await fileData.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const parsed = await pdfParse(buffer);
            let parsedText = parsed.text;

            if (!parsedText?.trim()) throw new Error('PDF vazio.');
            console.log("Texto:", parsedText.length, "chars");

            // Sanitizar
            parsedText = parsedText.replace(/\x00/g, '').replace(/[\uFFFD\uFFFE\uFFFF]/g, '');

            // Criar chunks
            const paragraphs = parsedText.split(/\n\s*\n/);
            const allChunks: string[] = [];
            let cur = '';
            for (const p of paragraphs) {
                if (cur.length + p.length > 2000) {
                    if (cur.trim()) allChunks.push(cur.trim());
                    cur = p;
                } else {
                    cur += (cur ? '\n\n' : '') + p;
                }
            }
            if (cur.trim()) allChunks.push(cur.trim());
            console.log("Chunks:", allChunks.length);

            // Salvar chunks no Storage (evita body gigante nas auto-invocações)
            const chunksPath = `_temp/${document_id}_chunks.json`;
            const chunksJson = JSON.stringify(allChunks);
            const { error: uploadErr } = await supabase.storage
                .from('knowledge-pdfs')
                .upload(chunksPath, new Blob([chunksJson], { type: 'application/json' }), { upsert: true });

            if (uploadErr) throw new Error(`Falha ao salvar chunks: ${uploadErr.message}`);
            console.log("Chunks salvos no storage:", chunksPath);

            // Agendar FASE 2 (body leve, só metadata)
            fetch(`${supabaseUrl}/functions/v1/process-pdf`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseServiceKey}`,
                    'apikey': supabaseServiceKey,
                },
                body: JSON.stringify({
                    document_id,
                    chunks_path: chunksPath,
                    chunk_offset: 0,
                    file_name: doc.file_name,
                    agent_type: doc.agent_type,
                    total_chunks: allChunks.length,
                }),
            }).then(res => {
                if (!res.ok) console.error("Erro agindo FASE 2 HTTP:", res.status);
            }).catch(err => console.error("Erro rede agendando FASE 2:", err));

            return new Response(JSON.stringify({ status: 'extraction_done', totalChunks: allChunks.length }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // ─────────────────────────────────────────
        // FASE 2: Processar embeddings em lotes
        // ─────────────────────────────────────────
        const { chunks_path, chunk_offset = 0, file_name = '', agent_type = '', total_chunks = 0 } = body;
        console.log(`FASE 2: Lote offset=${chunk_offset}, total=${total_chunks}`);

        // Baixar chunks do storage
        const { data: chunksFile, error: chunksErr } = await supabase.storage
            .from('knowledge-pdfs')
            .download(chunks_path!);

        if (chunksErr || !chunksFile) throw new Error(`Falha ao ler chunks: ${chunksErr?.message}`);
        const allChunks: string[] = JSON.parse(await chunksFile.text());

        const batchEnd = Math.min(chunk_offset + BATCH_SIZE, allChunks.length);
        const targetTable = `${agent_type}_knowledge`;
        console.log(`Processando chunks ${chunk_offset + 1}-${batchEnd}/${allChunks.length}`);

        const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

        for (let i = chunk_offset; i < batchEnd; i++) {
            const chunkText = allChunks[i];
            if (!chunkText?.trim()) continue;

            // Wait 4 seconds between chunks to avoid Gemini 15 RPM free tier limit
            if (i > chunk_offset) {
                console.log("Aguardando 4s para evitar Rate Limit...");
                await delay(4000);
            }

            // Sanitizar
            const safeText = chunkText
                .replace(/\x00/g, '')
                .replace(/[^\x20-\x7E\xA0-\uFFFC\n\r\t]/g, ' ')
                .substring(0, 8000);

            const geminiRes = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${geminiApiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: 'models/gemini-embedding-001',
                        content: { parts: [{ text: safeText }] }
                    }),
                }
            );

            if (!geminiRes.ok) {
                const errBody = await geminiRes.text();
                throw new Error(`Gemini erro ${geminiRes.status}: ${errBody}`);
            }

            const geminiData = await geminiRes.json();
            let embedding: number[] = geminiData.embedding.values;
            console.log(`  Dimensões originais do Gemini: ${embedding.length}`);

            if (embedding.length < 1536) {
                embedding = [...embedding, ...new Array(1536 - embedding.length).fill(0)];
            } else if (embedding.length > 1536) {
                embedding = embedding.slice(0, 1536);
            }

            const { error: insertError } = await supabase
                .from(targetTable)
                .insert({
                    document_id,
                    content: safeText,
                    embedding,
                    metadata: { document_id, file_name, chunk_index: i }
                });

            if (insertError) throw new Error(`Erro chunk ${i}: ${insertError.message}`);
            console.log(`  ✓ Chunk ${i + 1}`);
        }

        // Mais chunks para processar?
        if (batchEnd < allChunks.length) {
            console.log(`Agendando próximo lote (${batchEnd}/${allChunks.length})...`);

            await supabase
                .from('knowledge_documents')
                .update({ chunk_count: batchEnd })
                .eq('id', document_id);

            fetch(`${supabaseUrl}/functions/v1/process-pdf`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseServiceKey}`,
                    'apikey': supabaseServiceKey,
                },
                body: JSON.stringify({
                    document_id,
                    chunks_path,
                    chunk_offset: batchEnd,
                    file_name,
                    agent_type,
                    total_chunks: allChunks.length,
                }),
            }).then(res => {
                if (!res.ok) console.error("Erro HTTP agendando próximo lote:", res.status);
            }).catch(err => console.error("Erro rede agendando:", err));

            return new Response(JSON.stringify({ status: 'processing', processed: batchEnd, total: allChunks.length }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Concluído! Limpar arquivo temporário e atualizar status
        console.log("CONCLUÍDO!", batchEnd, "chunks processados");

        await supabase.storage.from('knowledge-pdfs').remove([chunks_path!]);

        await supabase
            .from('knowledge_documents')
            .update({ status: 'active', chunk_count: batchEnd })
            .eq('id', document_id);

        return new Response(JSON.stringify({ success: true, chunksProcessed: batchEnd }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (err: any) {
        console.error('ERRO:', err.message);
        if (documentIdToUpdate) {
            try {
                const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
                await supabase.from('knowledge_documents')
                    .update({ status: 'error', error_msg: err.message })
                    .eq('id', documentIdToUpdate);
            } catch (_) {}
        }
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
