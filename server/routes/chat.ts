import { Router, type Request, type Response } from 'express';

const router = Router();

const GEMINI_MODEL = 'gemini-2.5-flash';

interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

interface ChatRequestBody {
    messages: ChatMessage[];
    agentType: string;
    systemPrompt: string;
}

function buildGeminiUrl(model: string, apiKey: string): string {
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
}

function toGeminiPayload(messages: ChatMessage[], systemPrompt: string) {
    const contents = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
        }));

    return {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: {
            temperature: 0.7,
            topP: 0.95,
            maxOutputTokens: 8192,
        },
    };
}

router.post('/chat', async (req: Request, res: Response): Promise<void> => {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        res.status(500).json({ error: 'GEMINI_API_KEY não configurada no servidor' });
        return;
    }

    const { messages, systemPrompt } = req.body as ChatRequestBody;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ error: 'messages é obrigatório e deve ser um array não-vazio' });
        return;
    }

    if (!systemPrompt || typeof systemPrompt !== 'string') {
        res.status(400).json({ error: 'systemPrompt é obrigatório' });
        return;
    }

    // Sanitize messages
    const MAX_MSG_LEN = 10_000;
    const sanitized = messages.map((m) => ({
        ...m,
        content: (m.content || '').trim().slice(0, MAX_MSG_LEN),
    }));

    const payload = toGeminiPayload(sanitized, systemPrompt);

    try {
        const geminiRes = await fetch(buildGeminiUrl(GEMINI_MODEL, apiKey), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!geminiRes.ok) {
            const errorBody = await geminiRes.text().catch(() => '');
            res.status(geminiRes.status).json({
                error: `Gemini API error: ${geminiRes.status}`,
                details: errorBody,
            });
            return;
        }

        // Stream SSE back to the client
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

        const reader = geminiRes.body?.getReader();
        if (!reader) {
            res.status(500).json({ error: 'No response body from Gemini' });
            return;
        }

        const decoder = new TextDecoder();

        // Pipe Gemini SSE stream directly to client
        const pump = async () => {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                res.write(chunk);
            }
            res.end();
        };

        // Handle client disconnect
        req.on('close', () => {
            reader.cancel().catch(() => { });
        });

        await pump();
    } catch (error) {
        if (!res.headersSent) {
            res.status(500).json({
                error: 'Erro interno ao conectar com Gemini',
                details: error instanceof Error ? error.message : 'Unknown',
            });
        }
    }
});

export { router as chatRouter };
