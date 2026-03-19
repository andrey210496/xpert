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
    // Check if we should use demo mode (explicitly requested or via demo profile)
    const isDemoProfile = profile?.id?.includes('demo');
    const isExplicitDemo = API_BASE_URL === 'demo';

    if (isDemoProfile || isExplicitDemo) {
        return simulateStreaming(messages, agentType, callbacks, signal);
    }

    // Sanitize message content
    const MAX_MESSAGE_LENGTH = 10_000;
    const sanitizedMessages = messages.map((m) => ({
        ...m,
        content: m.content.trim().slice(0, MAX_MESSAGE_LENGTH),
    }));

    // Build system prompt on frontend (uses DB config + tenant context)
    const dbConfig = await getAgentConfig(agentType);
    let systemPrompt = dbConfig?.system_prompt || AGENT_CONFIGS[agentType]?.systemPrompt || '';

    if (dbConfig?.knowledge_base) {
        systemPrompt += `\n\nBASE DE CONHECIMENTO ESPECÍFICA:\n${dbConfig.knowledge_base}`;
    }

    if (tenant) {
        const tenantInfo = `\n\nCONTEXTO DO CONDOMÍNIO ATUAL:
Nome: ${tenant.name}
${tenant.tenant_context ? `Regras e Informações Específicas: ${tenant.tenant_context}` : 'Nota: Use as regras padrão de condomínio, pois este tenant ainda não definiu regras customizadas.'}`;
        systemPrompt += tenantInfo;
    }

    if (profile?.full_name) {
        systemPrompt += `\n\nUSUÁRIO ATUAL: Você está conversando com ${profile.full_name}. Trate o usuário pelo nome quando apropriado para uma recepção personalizada.`;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: sanitizedMessages,
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
                if (!line.startsWith('data: ')) continue;
                const data = line.slice(6).trim();
                if (!data) continue;

                try {
                    const parsed = JSON.parse(data);
                    const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    if (text) {
                        fullText += text;
                        callbacks.onToken(text);
                    }

                    if (parsed.usageMetadata) {
                        usage = {
                            prompt_tokens: parsed.usageMetadata.promptTokenCount || 0,
                            completion_tokens: parsed.usageMetadata.candidatesTokenCount || 0,
                        };
                    }
                } catch {
                    // Skip malformed JSON chunks
                }
            }
        }

        callbacks.onComplete(fullText, usage);
    } catch (error) {
        if (signal?.aborted) return;
        callbacks.onError(error instanceof Error ? error : new Error('Unknown error'));
    }
}

// Simulated streaming for demo mode (no backend)
async function simulateStreaming(
    messages: ChatMessage[],
    agentType: ProfileType,
    callbacks: StreamCallbacks,
    signal?: AbortSignal
): Promise<void> {
    const lastUserMessage = messages[messages.length - 1]?.content || '';
    const agentName = AGENT_CONFIGS[agentType]?.name || 'XPERT';

    const responses: Record<string, string[]> = {
        admin: [
            `Olá! Sou o **${agentName}**, seu assistente especialista em gestão condominial. 🏢\n\nCom base na sua pergunta sobre \"${lastUserMessage.slice(0, 50)}...\", posso ajudá-lo com:\n\n1. **Gestão Financeira** — Análise de prestação de contas, planejamento orçamentário e estratégias para redução de inadimplência\n2. **Questões Jurídicas** — Interpretação da convenção condominial e do Código Civil\n3. **Mediação de Conflitos** — Técnicas profissionais para resolução de disputas\n\nComo posso aprofundar algum desses temas para você?`,
            `Excelente pergunta! Como síndico, é fundamental estar atualizado sobre as **melhores práticas de gestão**.\n\n### Recomendações:\n\n- **Transparência financeira**: Publique demonstrativos mensais acessíveis a todos os condôminos\n- **Assembleias bem planejadas**: Envie a pauta com no mínimo 5 dias de antecedência\n- **Manutenção preventiva**: Crie um calendário anual de inspeções\n- **Comunicação digital**: Utilize canais oficiais para avisos e deliberações\n\n> 💡 *Dica: Documentes todas as decisões por escrito para segurança jurídica.*\n\nPosso elaborar um plano mais detalhado para o seu condomínio?`,
        ],
        morador: [
            `Olá! Sou o **${agentName}** e estou aqui pra te ajudar! 😊\n\nSobre a sua dúvida \"${lastUserMessage.slice(0, 50)}...\", veja algumas informações importantes:\n\n### Seus Direitos como Condômino:\n- ✅ Participar e votar em assembleias\n- ✅ Ter acesso às prestações de contas\n- ✅ Utilizar áreas comuns conforme regras\n- ✅ Receber comunicados sobre obras e manutenções\n\n### Seus Deveres:\n- 📋 Pagar a taxa condominial em dia\n- 🔇 Respeitar horários de silêncio\n- 🏗️ Comunicar obras na unidade previamente\n\nPosso detalhar algum ponto específico?`,
            `Ótima pergunta! Vou te explicar de forma clara e direta.\n\n**Para registrar uma reclamação ou solicitação**, siga estes passos:\n\n1. **Identifique o tipo**: É uma reclamação de convivência, manutenção ou sugestão?\n2. **Registre por escrito**: Envie ao síndico ou administradora por email ou sistema do condomínio\n3. **Seja específico**: Descreva data, horário, local e detalhes da situação\n4. **Aguarde o retorno**: O prazo usual é de 5 a 10 dias úteis\n\n> Se for uma **emergência** (vazamento, problema elétrico), entre em contato diretamente com o zelador ou portaria!\n\nQuer que eu monte um modelo de comunicação para você?`,
        ],
        zelador: [
            `Olá! Sou o **${agentName}**, seu assistente operacional! 🔧\n\nSobre \"${lastUserMessage.slice(0, 50)}...\", aqui vão orientações práticas:\n\n### Checklist de Manutenção Preventiva Diária:\n- [ ] Verificar bombas d'água e nível dos reservatórios\n- [ ] Inspecionar áreas comuns (iluminação, limpeza)\n- [ ] Checar sistema de interfones/porteiro eletrônico\n- [ ] Verificar elevadores (funcionamento e limpeza)\n- [ ] Conferir extintores e saídas de emergência\n\n### Manutenção Semanal:\n- [ ] Testar gerador (se houver)\n- [ ] Limpar ralos e calhas\n- [ ] Verificar portões e cancelas\n\nPrecisa de um checklist personalizado para o seu condomínio?`,
        ],
        prestador: [
            `Olá! Sou o **${agentName}**, seu assistente de negócios! 🛠️\n\nSobre \"${lastUserMessage.slice(0, 50)}...\", aqui vão orientações profissionais:\n\n### Estrutura de uma Proposta Profissional:\n\n1. **Identificação**: Dados da empresa, CNPJ, responsável técnico\n2. **Escopo detalhado**: Descrição clara dos serviços a serem executados\n3. **Cronograma**: Prazo de início, duração e marco de conclusão\n4. **Investimento**: Valores detalhados (material, mão de obra, administrativa)\n5. **Garantias**: Prazo e condições de garantia dos serviços\n6. **Documentação**: ART/RRT, seguro de responsabilidade civil\n\n> 📌 *Dica: Propostas bem estruturadas aumentam significativamente a taxa de aprovação em assembleias.*\n\nGostaria que eu ajude a elaborar uma proposta específica?`,
        ],
    };

    const agentResponses = responses[agentType] || responses.admin;
    const response = agentResponses[Math.floor(Math.random() * agentResponses.length)];

    let fullText = '';
    const words = response.split(' ');

    for (let i = 0; i < words.length; i++) {
        if (signal?.aborted) return;
        const word = (i > 0 ? ' ' : '') + words[i];
        fullText += word;
        callbacks.onToken(word);
        await new Promise((resolve) => setTimeout(resolve, 20 + Math.random() * 30));
    }

    const estimatedInputTokens = Math.ceil(lastUserMessage.length / 4);
    const estimatedOutputTokens = Math.ceil(fullText.length / 4);

    callbacks.onComplete(fullText, {
        prompt_tokens: estimatedInputTokens,
        completion_tokens: estimatedOutputTokens,
    });
}
