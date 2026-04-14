import { AGENT_CONFIGS } from '../config/agents';
import { getAgentConfig } from './agentConfigService';
import { fetchRelevantContext } from './knowledgeService';
import type { ProfileType } from '../types';

interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface StreamCallbacks {
    onToken: (token: string) => void;
    onComplete: (fullText: string, usage: { prompt_tokens: number; completion_tokens: number }) => void;
    onError: (error: Error) => void;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : '');

export async function streamChat(
    messages: ChatMessage[],
    agentType: ProfileType,
    callbacks: StreamCallbacks,
    tenant?: any,
    profile?: any,
    signal?: AbortSignal
): Promise<void> {

    // Build system prompt
    const dbConfig = await getAgentConfig(agentType);
    const basePrompt = dbConfig?.system_prompt || AGENT_CONFIGS[agentType]?.systemPrompt || '';

    // Fetch RAG context if tenant exists
    let ragContext = '';
    if (tenant?.id) {
        const lastUserMessage = messages[messages.length - 1]?.content;
        if (lastUserMessage) {
            const { context } = await fetchRelevantContext(lastUserMessage, `agent:${agentType}`);
            if (context) {
                ragContext = context;
            }
        }
    }

    // Build knowledge section (optional)
    let knowledgeSection = '';
    if (dbConfig?.knowledge_base || ragContext) {
        const combinedKnowledge = [
            dbConfig?.knowledge_base ? `REGRAS FIXAS DO AGENTE:\n${dbConfig.knowledge_base}` : '',
            ragContext ? `DOCUMENTOS RELEVANTES (RAG):\n${ragContext}` : ''
        ].filter(Boolean).join('\n\n---\n\n');

        knowledgeSection = `\n\nBASE DE CONHECIMENTO (use APENAS este conteúdo para responder):\n---\n${combinedKnowledge}\n---`;
    }

    // ALWAYS apply formatting rules — this wraps everything
    let systemPrompt = `REGRAS DE COMPORTAMENTO (PRIORIDADE MÁXIMA — NUNCA DESOBEDEÇA):
1. RESPOSTA DIRETA: Comece IMEDIATAMENTE com a informação. Sem introduções.
2. PROIBIDO: Nunca escreva "Entendimento preliminar", "Confirmação", "Resumo", "Alinhamento" ou repita o que o usuário disse. Se fizer isso, você FALHOU.
3. SAUDAÇÕES CURTAS: Se o usuário disser apenas "olá"/"oi"/"bom dia", responda com UMA FRASE CURTA (ex: "Olá! Como posso ajudar?"). Nada mais.
4. CONCISÃO: Respostas curtas e objetivas. Máximo 3-4 parágrafos para temas simples. Elimine toda frase desnecessária.
5. FORMATAÇÃO: Use bullet points (•) em vez de tabelas. Tabelas APENAS para comparativos numéricos. Use **negrito** só em termos-chave.
6. SEM QUESTIONÁRIOS: Não faça listas de perguntas ao usuário. Se precisar de mais contexto, faça UMA pergunta específica no final.
7. ESCOPO: Responda APENAS sobre assuntos de condomínio.${knowledgeSection ? ' Se tiver base de conhecimento, use EXCLUSIVAMENTE ela.' : ''}

PERSONALIDADE: ${basePrompt}${knowledgeSection}`;

    if (tenant) {
        const tenantInfo = `\n\nCONTEXTO DO CONDOMÍNIO ATUAL:
Nome: ${tenant.name}
${tenant.tenant_context ? `Regras e Informações Específicas: ${tenant.tenant_context}` : 'Nota: Use as regras padrão de condomínio, pois este tenant ainda não definiu regras customizadas.'}`;
        systemPrompt += tenantInfo;
    }

    if (profile?.full_name) {
        systemPrompt += `\n\nUSUÁRIO ATUAL: Você está conversando com ${profile.full_name}.`;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages,
                agentType,
                systemPrompt,
            }),
            signal,
        });

        if (!response.ok) {
            const errorBody = await response.text().catch(() => '');
            throw new Error(`API error: ${response.status} — ${errorBody}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let fullText = '';
        let usage = { prompt_tokens: 0, completion_tokens: 0 };
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const cleanLine = line.trim();
                if (!cleanLine || !cleanLine.startsWith('data: ')) continue;
                
                const data = cleanLine.slice(6);
                if (data === '[DONE]') break;

                try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.delta?.content || '';
                    if (content) {
                        fullText += content;
                        callbacks.onToken(content);
                    }

                    if (parsed.usage) {
                        usage = {
                            prompt_tokens: parsed.usage.prompt_tokens || 0,
                            completion_tokens: parsed.usage.completion_tokens || 0,
                        };
                    }
                } catch {
                    // Skip incomplete or empty JSON chunks
                }
            }
        }

        callbacks.onComplete(fullText, usage);
    } catch (error) {
        if (signal?.aborted) return;
        callbacks.onError(error instanceof Error ? error : new Error('Unknown error'));
    }
}

