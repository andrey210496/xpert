import { Router, type Request, type Response } from 'express';

const router = Router();

const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';

interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

interface ChatRequestBody {
    messages: ChatMessage[];
    agentType: string;
    systemPrompt: string;
}

function buildOpenRouterPayload(messages: ChatMessage[], systemPrompt: string) {
    return {
        model: OPENROUTER_MODEL,
        messages: [
            { role: 'system', content: systemPrompt },
            ...messages
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 4096,
    };
}

router.post('/chat', async (req: Request, res: Response): Promise<void> => {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
        res.status(500).json({ error: 'OPENROUTER_API_KEY não configurada no servidor' });
        return;
    }

    const { messages, systemPrompt } = req.body as ChatRequestBody;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ error: 'messages é obrigatório e deve ser um array não-vazio' });
        return;
    }

    // Sanitize messages
    const MAX_MSG_LEN = 10_000;
    const sanitized = messages.map((m) => ({
        ...m,
        content: (m.content || '').trim().slice(0, MAX_MSG_LEN),
    }));

    const payload = buildOpenRouterPayload(sanitized, systemPrompt);

    try {
        const openRouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://xpert-condo.ai', // Opcional, mas recomendado pelo OpenRouter
                'X-Title': 'XPERT Condo Assistant',
            },
            body: JSON.stringify(payload),
        });

        if (!openRouterRes.ok) {
            const errorBody = await openRouterRes.text().catch(() => '');
            res.status(openRouterRes.status).json({
                error: `OpenRouter API error: ${openRouterRes.status}`,
                details: errorBody,
            });
            return;
        }

        // Stream SSE back to the client
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

        const reader = openRouterRes.body?.getReader();
        if (!reader) {
            res.status(500).json({ error: 'No response body from OpenRouter' });
            return;
        }

        const decoder = new TextDecoder();

        // Pipe OpenRouter SSE stream directly to client
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
                error: 'Erro interno ao conectar com OpenRouter',
                details: error instanceof Error ? error.message : 'Unknown',
            });
        }
    }
});

export { router as chatRouter };
