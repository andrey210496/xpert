import { AGENT_CONFIGS } from '../config/agents';
import { getAgentConfig } from './agentConfigService';
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
    // Simulation is ONLY for explicit demo sessions
    const isDemoProfile = Boolean(profile?.id?.includes('demo'));
    const isExplicitSimulate = API_BASE_URL === 'simulate';
    
    if (isDemoProfile || isExplicitSimulate) {
        console.warn('[Chat Service] Using simulated streaming:', { isDemoProfile, isExplicitSimulate });
        return simulateStreaming(messages, agentType, callbacks, signal);
    }

    // Build system prompt
    const dbConfig = await getAgentConfig(agentType);
    let systemPrompt = dbConfig?.system_prompt || AGENT_CONFIGS[agentType]?.systemPrompt || '';

    if (dbConfig?.knowledge_base) {
        systemPrompt = `REGRAS OBRIGATÓRIAS (PRIORIDADE MÁXIMA):
1. Você DEVE responder EXCLUSIVAMENTE com base na "BASE DE CONHECIMENTO" fornecida abaixo.
2. NÃO use seu conhecimento geral ou treinamento para responder perguntas. Sua ÚNICA fonte de informação é a base de conhecimento.
3. Se a pergunta do usuário NÃO estiver coberta pela base de conhecimento, responda educadamente: "Desculpe, não tenho essa informação na minha base de conhecimento atual. Por favor, entre em contato com a administração para mais detalhes."
4. NUNCA invente, suponha ou extrapole informações que não estejam explicitamente na base de conhecimento.
5. NÃO responda perguntas fora do escopo do condomínio ou da base (ex: receitas, programação, curiosidades gerais, etc). Você NÃO é uma IA de uso geral.
6. Mantenha sua personalidade e tom conforme descrito abaixo, mas SEMPRE limitado ao conteúdo da base.

PERSONALIDADE E TOM:
${systemPrompt}

BASE DE CONHECIMENTO (responda SOMENTE com base neste conteúdo):
---
${dbConfig.knowledge_base}
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

async function simulateStreaming(
    messages: ChatMessage[],
    agentType: ProfileType,
    callbacks: StreamCallbacks,
    signal?: AbortSignal
): Promise<void> {
    const lastUserMessage = messages[messages.length - 1]?.content || '';
    const agentName = AGENT_CONFIGS[agentType]?.name || 'XPERT';
    const response = `Olá! Sou o **${agentName}**. No momento estou em modo demonstração. Recebi sua mensagem: "${lastUserMessage.slice(0, 30)}..."`;

    let fullText = '';
    const words = response.split(' ');

    for (let i = 0; i < words.length; i++) {
        if (signal?.aborted) return;
        const word = (i > 0 ? ' ' : '') + words[i];
        fullText += word;
        callbacks.onToken(word);
        await new Promise((resolve) => setTimeout(resolve, 30));
    }

    callbacks.onComplete(fullText, { prompt_tokens: 10, completion_tokens: 20 });
}
