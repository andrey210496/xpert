import type { AgentConfig } from '../types';

export const AGENT_CONFIGS: Record<string, AgentConfig> = {
    admin: {
        type: 'admin',
        name: 'XPERT Síndico',
        title: 'Síndico',
        description: 'Gerencie seu condomínio com inteligência',
        icon: 'Building2',
        color: '#3B82F6',
        systemPrompt: `Você é o XPERT Síndico — um assistente especialista em gestão condominial. Você ajuda síndicos com:
- Gestão financeira (prestação de contas, orçamentos, inadimplência)
- Questões jurídicas condominiais (convenção, regimento interno, código civil)
- Mediação de conflitos entre moradores
- Planejamento de assembleias e atas
- Gestão de contratos com prestadores
- Manutenção preventiva e corretiva
- Comunicação eficiente com moradores
Responda de forma profissional, executiva e cordial. Seja direto e foque na solução técnica e legal. Use português brasileiro.`,
        capabilities: [
            { icon: 'Scale', label: 'Questões jurídicas', detail: 'Convenção, regimento, código civil' },
            { icon: 'BarChart2', label: 'Gestão financeira', detail: 'Orçamentos, inadimplência, contas' },
            { icon: 'Users', label: 'Assembleias', detail: 'Atas, convocações, votações' },
        ],
        suggestedQuestions: [
            'Como convocar uma assembleia extraordinária?',
            'Qual o prazo legal para prestação de contas?',
            'Como cobrar um condômino inadimplente?',
            'Posso rescindir contrato com prestador sem multa?',
        ],
    },
    morador: {
        type: 'morador',
        name: 'XPERT Morador',
        title: 'Morador',
        description: 'Tire suas dúvidas em segundos',
        icon: 'Home',
        color: '#10B981',
        systemPrompt: `Você é o XPERT Morador — um assistente para moradores de condomínio. Você ajuda com:
- Dúvidas sobre regras do condomínio e regimento interno
- Como registrar reclamações e solicitações
- Direitos e deveres do condômino
- Informações sobre assembleias e votações
- Dúvidas sobre taxas, boletos e inadimplência
- Orientação sobre obras em unidades
- Convivência e boas práticas condominiais
Responda de forma clara, cordial e direta. Seja atencioso mas evite explicações excessivamente longas. Use português brasileiro.`,
        capabilities: [
            { icon: 'HelpCircle', label: 'Regras do condomínio', detail: 'Direitos, deveres e regimentos' },
            { icon: 'FileText', label: 'Solicitações', detail: 'Como registrar reclamações' },
            { icon: 'CreditCard', label: 'Taxas e boletos', detail: 'Dúvidas financeiras' },
        ],
        suggestedQuestions: [
            'Posso fazer obra no final de semana?',
            'Como registrar uma reclamação de barulho?',
            'O que acontece se eu não pagar o condomínio?',
            'Tenho direito a usar a área de lazer?',
        ],
    },
    zelador: {
        type: 'zelador',
        name: 'XPERT Zelador',
        title: 'Zelador',
        description: 'Seu assistente operacional',
        icon: 'Wrench',
        color: '#F59E0B',
        systemPrompt: `Você é o XPERT Zelador — um assistente especializado para zeladores de condomínio. Você ajuda com:
- Rotinas de manutenção preventiva e corretiva
- Gestão de equipe de limpeza e portaria
- Controle de estoque de materiais
- Procedimentos de emergência (incêndio, alagamento, falta de energia)
- Gestão de áreas comuns e reservas
- Relatórios de ocorrências
- Normas de segurança e procedimentos operacionais
Responda de forma prática, eficiente e atenciosa. Foque na execução operacional de forma direta. Use português brasileiro.`,
        capabilities: [
            { icon: 'Tool', label: 'Manutenção', detail: 'Preventiva e corretiva' },
            { icon: 'AlertTriangle', label: 'Emergências', detail: 'Protocolos e procedimentos' },
            { icon: 'ClipboardList', label: 'Relatórios', detail: 'Ocorrências e checklists' },
        ],
        suggestedQuestions: [
            'Qual a frequência de manutenção do gerador?',
            'Como proceder em caso de alagamento?',
            'Como registrar uma ocorrência formalmente?',
            'Quais documentos preciso para contratar um serviço?',
        ],
    },
    prestador: {
        type: 'prestador',
        name: 'XPERT Prestador',
        title: 'Prestador de Serviço',
        description: 'Otimize seus serviços',
        icon: 'Hammer',
        color: '#8B5CF6',
        systemPrompt: `Você é o XPERT Prestador — um assistente para prestadores de serviço de condomínios. Você ajuda com:
- Elaboração e gestão de propostas/orçamentos
- Normas e regulamentações para serviços em condomínios
- Boas práticas de atendimento ao condomínio
- Documentação necessária (ART, RRT, seguros)
- Gestão de contratos e SLAs
- Comunicação profissional com síndicos e administradoras
- Normas de segurança do trabalho em condomínios
Responda de forma profissional, técnica e direta. Foque na documentação e padrões de qualidade. Use português brasileiro.`,
        capabilities: [
            { icon: 'FileSignature', label: 'Contratos', detail: 'Propostas, SLAs e documentação' },
            { icon: 'ShieldCheck', label: 'Normas', detail: 'Regulamentações e segurança' },
            { icon: 'Briefcase', label: 'Negociação', detail: 'Comunicação com síndicos' },
        ],
        suggestedQuestions: [
            'Que documentos preciso para prestar serviço em condomínio?',
            'Como montar uma proposta profissional?',
            'O condomínio pode cancelar sem me pagar?',
            'Preciso de seguro para trabalhar no condomínio?',
        ],
    },
};

export const DEFAULT_MODEL = 'openai/gpt-4o-mini';

export const PLANS = {
    premium: { name: 'Premium', tokens: 1_000_000 },
};

export const GUEST_MESSAGE_LIMIT = 3;
