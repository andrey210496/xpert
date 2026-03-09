import { motion } from 'framer-motion';
import { MessageSquare, ArrowRight, AlertTriangle } from 'lucide-react';

interface ChatPreviewProps {
    selectedAgent: string;
    onAgentClick: () => void;
    onCTAClick: () => void;
}

const PREVIEW_TEXTS: Record<string, { title: string; subtitle: string }> = {
    admin: {
        title: 'Assistente Administrativo',
        subtitle: 'Inicie uma conversa para tirar suas dúvidas.',
    },
    morador: {
        title: 'Portal do Morador',
        subtitle: 'Inicie uma conversa para tirar suas dúvidas.',
    },
    zelador: {
        title: 'Suporte à Zeladoria',
        subtitle: 'Inicie uma conversa para tirar suas dúvidas.',
    },
    prestador: {
        title: 'Canal do Prestador',
        subtitle: 'Inicie uma conversa para tirar suas dúvidas.',
    },
};

export function ChatPreview({ selectedAgent, onAgentClick, onCTAClick }: ChatPreviewProps) {
    const preview = PREVIEW_TEXTS[selectedAgent] || PREVIEW_TEXTS.admin;

    return (
        <div className="shrink-0 w-full max-w-3xl mx-auto px-4 pb-4 flex flex-col gap-2">
            {/* Instruction label */}
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-accent">
                ★ Clique no quadro abaixo para acessar o chat
            </p>

            {/* Cards row */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch">
                {/* Chat preview card */}
                <motion.button
                    onClick={onAgentClick}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className="flex-1 flex items-center gap-4 bg-bg-tertiary border border-border rounded-lg p-5 text-left cursor-pointer transition-colors hover:border-border-strong group"
                >
                    <div className="shrink-0 w-10 h-10 rounded-lg bg-bg-hover flex items-center justify-center">
                        <MessageSquare size={18} className="text-text-tertiary group-hover:text-text-secondary transition-colors" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-text-primary truncate">{preview.title}</p>
                        <p className="text-xs text-text-secondary mt-0.5">{preview.subtitle}</p>
                    </div>
                </motion.button>

                {/* CTA card */}
                <motion.button
                    onClick={onCTAClick}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="shrink-0 w-full sm:w-44 flex flex-col items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white rounded-lg p-4 cursor-pointer transition-colors"
                >
                    <span className="text-[10px] uppercase tracking-[0.15em] font-bold leading-tight text-center">
                        Leve o XPERT para sua Administradora
                    </span>
                    <ArrowRight size={16} />
                </motion.button>
            </div>

            {/* AI Disclaimer */}
            <div className="flex items-center gap-1.5 justify-center mt-1">
                <AlertTriangle size={12} className="text-warning shrink-0" />
                <p className="text-[10px] text-text-tertiary">
                    Atenção: lembre-se que está conversando com uma IA e esta pode cometer erros.
                </p>
            </div>
        </div>
    );
}
