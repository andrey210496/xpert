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
    let systemPrompt = dbConfig?.system_prompt || AGENT_CONFIGS[agentType]?.systemPrompt || '';

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

    if (dbConfig?.knowledge_base || ragContext) {
        const combinedKnowledge = [
            dbConfig?.knowledge_base ? `REGRAS FIXAS DO AGENTE:\n${dbConfig.knowledge_base}` : '',
            ragContext ? `BASE DE CONHECIMENTO DO CONDOMÍNIO (RAG):\n${ragContext}` : ''
        ].filter(Boolean).join('\n\n---\n\n');

        systemPrompt = `REGRAS OBRIGATÓRIAS (PRIORIDADE MÁXIMA):
1. Você DEVE responder EXCLUSIVAMENTE com base na "BASE DE CONHECIMENTO" fornecida abaixo.
2. NÃO use seu conhecimento geral. Se a informação não estiver na base, responda: "Desculpe, não tenho essa informação na minha base de conhecimento atual. Por favor, entre em contato com a administração."
3. DIRETRIZES DE FORMATAÇÃO E RESPOSTA (CRÍTICO):
   - RESPOSTA DIRETA: Comece a resposta imediatamente. NUNCA use "Entendimento preliminar", "Confirmação" ou repita o que o usuário disse.
   - CONCISÃO EXECUTIVA: Seja objetivo e economize palavras. Evite enrolação (fillers).
   - ESTRUTURA: Use títulos (## ou ###) para organizar temas. Use Negrito para conceitos-chave.
   - LISTAS > TABELAS: Priorize bullet points para listas de itens, passos ou vantagens. Use tabelas APENAS para dados estritamente comparativos.
   - TOM: Equilíbrio entre profissionalismo e cordialidade. Atencioso, mas focado na eficiência.

PERSONALIDADE E TOM:
${systemPrompt}

BASE DE CONHECIMENTO:
---
${combinedKnowledge}
---`;
    }

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

