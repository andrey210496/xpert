import { useState, useRef, useEffect, useCallback } from 'react';
import { LeadGate, getStoredLead } from './LeadGate';
import { FinishSignupModal } from './FinishSignupModal';
import type { LeadInfo } from './LeadGate';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Send,
    Plus,
    Menu,
    X,
    MessageSquare,
    User,
    Bot,
    Building2,
    Home,
    Wrench,
    Hammer,
    Sparkles,
    LockKeyhole,
    LogOut,
    MoreVertical,
    Trash2,
    Download,
    Share2,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useChat } from '../../hooks/useChat';
import { AGENT_CONFIGS, GUEST_MESSAGE_LIMIT } from '../../config/agents';
import type { ProfileType, Message, Conversation } from '../../types';
import { timeAgo } from '../../utils/formatters';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Card } from '../ui';

// ===== UI Helpers =====

const StatusBadge = ({ isOnline }: { isOnline: boolean }) => (
    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${isOnline ? 'bg-success/10 border border-success/20' : 'bg-text-tertiary/10 border border-text-tertiary/20'}`}>
        <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-success animate-pulse' : 'bg-text-tertiary'}`} />
        <span className={`text-[10px] font-bold uppercase tracking-wider ${isOnline ? 'text-success' : 'text-text-tertiary'}`}>
            {isOnline ? 'Online' : 'Offline'}
        </span>
    </div>
);

// ===== Deletion Confirmation Modal =====

function DeleteConfirmModal({
    isOpen,
    onCancel,
    onConfirm
}: {
    isOpen: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                >
                    {/* Backdrop */}
                    <motion.div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        onClick={onCancel}
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 350 }}
                        className="relative w-full max-w-sm bg-bg-primary border border-error/30 shadow-[0_0_50px_-12px_rgba(239,68,68,0.3)] overflow-hidden"
                        style={{ borderRadius: '2px' }}
                    >
                        {/* Status bar */}
                        <div className="h-1 bg-error" />

                        <div className="p-6 text-center">
                            <div className="w-14 h-14 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-error/20">
                                <Trash2 className="text-error" size={24} />
                            </div>

                            <h3 className="text-xl font-bold font-display text-text-primary mb-2 tracking-tight">
                                Excluir Conversa?
                            </h3>
                            <p className="text-sm text-text-tertiary mb-8 leading-relaxed">
                                Esta ação é permanente e removerá todo o histórico de mensagens desta conversa do sistema.
                            </p>

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={onCancel}
                                    className="py-3 px-4 rounded-[2px] bg-bg-hover text-text-primary text-xs font-bold uppercase tracking-widest hover:bg-bg-elevated transition-colors border border-border"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={onConfirm}
                                    className="py-3 px-4 rounded-[2px] bg-error text-white text-xs font-bold uppercase tracking-widest hover:bg-error-hover transition-all shadow-[0_4px_12px_-2px_rgba(239,68,68,0.4)]"
                                >
                                    Confirmar
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// ===== Welcome Screen (Clean Initial State) =====

function WelcomeScreen({
    agentType,
}: {
    agentType: ProfileType;
}) {
    const config = AGENT_CONFIGS[agentType];

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.05, delayChildren: 0.1 }
        },
        exit: { opacity: 0, transition: { duration: 0.2 } }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0 }
    };

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-2xl mx-auto w-full"
        >
            {/* Agent Identity */}
            <motion.div variants={itemVariants} className="relative mb-4">
                <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center border-2 z-10 relative bg-bg-primary"
                    style={{ borderColor: `${config.color}40`, backgroundColor: `${config.color}10` }}
                >
                    <AgentAvatar agentType={agentType} size={32} />
                </div>
                <div
                    className="absolute inset-[-4px] border-2 rounded-2xl opacity-20"
                    style={{ borderColor: config.color }}
                />
            </motion.div>

            <motion.div variants={itemVariants} className="text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                    <h1 className="text-2xl font-bold font-display text-text-primary tracking-tight">
                        {config.name}
                    </h1>
                    <StatusBadge isOnline={true} />
                </div>
                <p className="text-sm text-text-secondary max-w-sm mx-auto leading-relaxed">
                    {config.description}
                </p>
            </motion.div>
        </motion.div>
    );
}

// ===== Agent Avatar (Refined) =====

function AgentAvatar({ agentType, size = 32 }: { agentType: ProfileType; size?: number }) {
    const config = AGENT_CONFIGS[agentType];
    const icons: Record<string, typeof Building2> = {
        admin: Building2,
        morador: Home,
        zelador: Wrench,
        prestador: Hammer,
    };
    const Icon = icons[agentType] || Bot;

    return (
        <div
            className="flex items-center justify-center rounded-lg shrink-0 border border-border"
            style={{
                width: size,
                height: size,
                backgroundColor: 'var(--color-bg-tertiary)',
            }}
        >
            <Icon size={size * 0.5} style={{ color: config?.color || '#3B82F6' }} />
        </div>
    );
}

// ===== Typing Indicator (Refined) =====

function TypingIndicator({ agentColor }: { agentColor: string }) {
    return (
        <div className="flex items-center gap-1.5 px-4 py-3 bg-bg-elevated/50 rounded-xl border border-border w-fit ml-2">
            <div className="w-1.5 h-1.5 rounded-full animate-bounce [animation-duration:0.8s] bg-current opacity-40" style={{ color: agentColor }} />
            <div className="w-1.5 h-1.5 rounded-full animate-bounce [animation-duration:0.8s] [animation-delay:0.2s] bg-current opacity-40" style={{ color: agentColor }} />
            <div className="w-1.5 h-1.5 rounded-full animate-bounce [animation-duration:0.8s] [animation-delay:0.4s] bg-current opacity-40" style={{ color: agentColor }} />
        </div>
    );
}

// ===== Message Bubble (Refined Editorial Style) =====

function MessageBubble({
    message,
    agentType,
    isLastInGroup = false,
}: {
    message: Message;
    agentType: ProfileType;
    isLastInGroup?: boolean;
}) {
    const isUser = message.role === 'user';
    const config = AGENT_CONFIGS[agentType];

    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className={`flex gap-3 px-4 ${isUser ? 'flex-row-reverse' : ''} ${isLastInGroup ? 'mb-2' : 'mb-1'}`}
        >
            {!isUser && (
                <div className="mt-0.5">
                    <AgentAvatar agentType={agentType} size={28} />
                </div>
            )}
            {isUser && (
                <div className="w-7 h-7 rounded-lg bg-bg-elevated flex items-center justify-center shrink-0 border border-border mt-0.5">
                    <User size={14} className="text-text-tertiary" />
                </div>
            )}

            <div
                className={`max-w-[70%] rounded-xl px-3.5 py-2.5 ${isUser
                    ? 'text-text-primary rounded-tr-sm'
                    : 'bg-bg-elevated border border-border rounded-tl-sm'
                    }`}
                style={isUser ? { backgroundColor: `${config.color}15`, borderColor: `${config.color}25`, borderWidth: '1px' } : {}}
            >
                {isUser ? (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap font-sans">{message.content}</p>
                ) : (
                    <div className="flex flex-col gap-2">
                        <div className="markdown-content text-sm text-text-primary font-sans leading-relaxed">
                            <ReactMarkdown>{message.content || '...'}</ReactMarkdown>
                        </div>
                        <div className="mt-2 pt-2 border-t border-border/50">
                            <p className="text-[10px] text-text-tertiary italic leading-tight">
                                🤖 Esta é uma resposta gerada por inteligência artificial e pode cometer erros. Verifique sempre informações cruciais na convenção do condomínio.
                            </p>
                        </div>
                    </div>
                )}
                <div className={`text-[10px] mt-1.5 font-mono uppercase tracking-widest ${isUser ? 'text-right' : ''} text-text-tertiary opacity-60`}>
                    {timeAgo(message.created_at)}
                </div>
            </div>
        </motion.div>
    );
}

function ChatInput({
    onSend,
    isStreaming,
    isDisabled,
    agentColor,
}: {
    onSend: (content: string) => void;
    isStreaming: boolean;
    isDisabled: boolean;
    agentColor: string;
}) {
    const [value, setValue] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleSubmit = () => {
        if (!value.trim() || isStreaming || isDisabled) return;
        onSend(value.trim());
        setValue('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
        }
    }, [value]);

    return (
        <div className="px-4 py-4 bg-bg-primary">
            <div className="max-w-2xl mx-auto">
                <div
                    className="flex items-end gap-2 bg-bg-secondary border border-border rounded-xl p-2.5 transition-all focus-within:ring-4"
                    style={{
                        borderColor: value.trim() ? `${agentColor}40` : undefined,
                        boxShadow: value.trim() ? `0 0 0 1px ${agentColor}20` : undefined
                    } as React.CSSProperties}
                >
                    <textarea
                        ref={textareaRef}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={isDisabled ? 'Acesso limitado atingido' : 'Descreva a situação ou dúvida...'}
                        disabled={isDisabled}
                        rows={1}
                        className="flex-1 bg-transparent text-text-primary placeholder:text-text-tertiary outline-none resize-none text-sm font-sans px-2 py-1.5 min-h-[24px]"
                    />
                    <button
                        onClick={handleSubmit}
                        disabled={!value.trim() || isStreaming || isDisabled}
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0 active:scale-90 disabled:opacity-20 disabled:scale-100"
                        style={{
                            backgroundColor: value.trim() ? agentColor : 'var(--color-bg-tertiary)',
                            color: value.trim() ? '#FFF' : 'var(--color-text-tertiary)'
                        }}
                    >
                        <Send size={15} />
                    </button>
                </div>
                {!isDisabled && (
                    <p className="text-[10px] text-text-tertiary text-center mt-2 opacity-60">
                        <span className="font-bold">Enter</span> enviar · <span className="font-bold">Shift+Enter</span> nova linha
                    </p>
                )}
            </div>
        </div>
    );
}

function ChatSidebar({
    conversations,
    currentId,
    agentType,
    isOpen,
    onClose,
    onSelect,
    onNewChat,
    onConfirmDeleteRequest,
    isLoading,
}: {
    conversations: Conversation[];
    currentId: string | null;
    agentType: ProfileType;
    isOpen: boolean;
    onClose: () => void;
    onSelect: (conv: Conversation) => void;
    onNewChat: () => void;
    isLoading?: boolean;
    onConfirmDeleteRequest: (id: string) => void;
}) {
    const config = AGENT_CONFIGS[agentType];
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
    const [menuPosition, setMenuPosition] = useState<{ top: number, left: number } | null>(null);
    // Close menu on scroll to prevent "floating" menu issues with fixed positioning
    useEffect(() => {
        const handleScroll = () => {
            if (menuOpenId) {
                setMenuOpenId(null);
                setMenuPosition(null);
            }
        };

        const scrollContainer = document.getElementById('sidebar-history');
        scrollContainer?.addEventListener('scroll', handleScroll);
        return () => scrollContainer?.removeEventListener('scroll', handleScroll);
    }, [menuOpenId]);

    const handleMenuToggle = (e: React.MouseEvent, convId: string) => {
        e.stopPropagation();
        if (menuOpenId === convId) {
            setMenuOpenId(null);
            setMenuPosition(null);
        } else {
            const rect = e.currentTarget.getBoundingClientRect();
            setMenuOpenId(convId);
            // Position near the button, avoiding overflow
            setMenuPosition({
                top: rect.top,
                left: rect.right + 5
            });
        }
    };

    const handleExport = (conv: Conversation) => {
        // Simple export - actual messages would need to be fetched if not current
        const content = `Histórico de Conversa - ${conv.title || 'Início'}\nData: ${new Date(conv.created_at).toLocaleString()}\n\n[Mensagens não carregadas nesta prévia do dashboard]`;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `conversa-${conv.id.slice(0, 8)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setMenuOpenId(null);
        setMenuPosition(null);
    };

    const handleShare = (conv: Conversation) => {
        const shareUrl = `${window.location.origin}/chat/share/${conv.id}`;
        navigator.clipboard.writeText(shareUrl);
        alert('Link de compartilhamento copiado!');
        setMenuOpenId(null);
        setMenuPosition(null);
    };

    return (
        <>
            {/* Backdrop for closing menu */}
            <AnimatePresence>
                {menuOpenId && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[90]"
                        onClick={() => { setMenuOpenId(null); setMenuPosition(null); }}
                    />
                )}
            </AnimatePresence>

            {/* Mobile overlay */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 z-30 lg:hidden"
                        onClick={onClose}
                    />
                )}
            </AnimatePresence>

            {/* Sidebar: always visible on lg+, slide-in on mobile */}
            <aside
                className={`fixed lg:relative lg:!translate-x-0 left-0 top-0 bottom-0 w-64 bg-bg-secondary border-r border-border z-40 flex flex-col transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                <div className="h-16 px-4 border-b border-border flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-tertiary font-bold">XPERT PROTOCOL</span>
                    <button onClick={onClose} className="lg:hidden p-2 hover:bg-bg-hover rounded-md text-text-tertiary transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Active Agent Badge */}
                <div className="mx-3 mt-4 mb-2 p-3 rounded-lg border bg-current/5" style={{ borderColor: `${config.color}20`, color: config.color }}>
                    <div className="flex items-center gap-2 mb-0.5">
                        <AgentAvatar agentType={agentType} size={16} />
                        <span className="text-xs font-bold font-display tracking-tight text-text-primary">{config.name}</span>
                    </div>
                    <span className="text-[9px] uppercase tracking-wider font-bold opacity-60">Agente Ativo</span>
                </div>

                <div className="px-3 py-2">
                    <button
                        onClick={() => { onNewChat(); onClose(); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-bg-primary border border-border rounded-lg text-xs font-bold text-text-secondary hover:text-text-primary hover:border-border-strong transition-all group"
                    >
                        <Plus size={15} className="text-text-tertiary group-hover:text-text-primary" />
                        NOVA CONVERSA
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-2 mt-2 pb-4" id="sidebar-history">
                    <h3 className="text-[10px] uppercase tracking-[0.15em] font-bold text-text-tertiary px-3 mb-2">Histórico</h3>
                    <div className="space-y-0.5">
                        {isLoading ? (
                            <div className="px-3 py-4 space-y-2">
                                <div className="h-4 bg-bg-hover animate-pulse rounded w-3/4" />
                                <div className="h-4 bg-bg-hover animate-pulse rounded w-1/2" />
                            </div>
                        ) : conversations.length === 0 ? (
                            <div className="py-8 flex flex-col items-center justify-center opacity-30">
                                <MessageSquare size={20} className="mb-2" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Nenhuma conversa</span>
                            </div>
                        ) : (
                            conversations.map((conv) => (
                                <div key={conv.id} className="relative group/item">
                                    <button
                                        onClick={() => { onSelect(conv); onClose(); }}
                                        className={`w-full text-left px-3 py-2.5 pr-10 rounded-lg text-xs font-medium transition-all group flex flex-col gap-0.5 ${conv.id === currentId
                                            ? 'bg-bg-hover text-text-primary border-l-2'
                                            : 'text-text-secondary hover:bg-bg-hover/50'
                                            }`}
                                        style={conv.id === currentId ? { borderLeftColor: config.color } : {}}
                                    >
                                        <span className="truncate w-full font-semibold">{conv.title || 'Início de conversa'}</span>
                                        <span className="text-[9px] opacity-50 font-mono">{timeAgo(conv.created_at)}</span>
                                    </button>

                                    <button
                                        onClick={(e) => handleMenuToggle(e, conv.id)}
                                        className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-bg-elevated rounded-md text-text-tertiary transition-all ${menuOpenId === conv.id ? 'opacity-100 bg-bg-elevated' : 'opacity-0 group-hover/item:opacity-100'
                                            }`}
                                    >
                                        <MoreVertical size={14} />
                                    </button>

                                    {/* Menu rendering moved outside for fixed positioning */}
                                </div>
                            ))
                        )}
                    </div>
                </div>

            </aside>

            {/* Fixed Menu Container - Now sibling of aside to avoid transform context */}
            {menuOpenId && menuPosition && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, x: -10 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    className="fixed w-44 bg-bg-elevated border border-border rounded-lg shadow-[0_10px_50px_-10px_rgba(0,0,0,0.6)] z-[100] py-1.5 overflow-hidden"
                    style={{
                        top: `${menuPosition.top}px`,
                        left: `${menuPosition.left}px`
                    }}
                >
                    {conversations.find(c => c.id === menuOpenId) && (
                        <>
                            <button
                                onClick={() => handleShare(conversations.find(c => c.id === menuOpenId)!)}
                                className="w-full text-left px-3.5 py-2.5 text-[11px] font-bold text-text-secondary hover:bg-bg-hover flex items-center gap-2.5 transition-colors"
                            >
                                <Share2 size={13} className="text-text-tertiary" /> COMPARTILHAR
                            </button>
                            <button
                                onClick={() => handleExport(conversations.find(c => c.id === menuOpenId)!)}
                                className="w-full text-left px-3.5 py-2.5 text-[11px] font-bold text-text-secondary hover:bg-bg-hover flex items-center gap-2.5 transition-colors"
                            >
                                <Download size={13} className="text-text-tertiary" /> EXPORTAR
                            </button>
                            <div className="h-px bg-border/50 my-1 mx-2" />
                            <button
                                onClick={() => { onConfirmDeleteRequest(menuOpenId); setMenuOpenId(null); setMenuPosition(null); }}
                                className="w-full text-left px-3.5 py-2.5 text-[11px] font-bold text-error hover:bg-error/10 flex items-center gap-2.5 transition-colors"
                            >
                                <Trash2 size={13} /> EXCLUIR
                            </button>
                        </>
                    )}
                </motion.div>
            )}
        </>
    );
}

// ===== Signup Banner Components =====

function SignupBanner({ variant, onSignup, onLogin, currentMessages }: { variant: 'subtle' | 'modal', onSignup: () => void, onLogin?: () => void, currentMessages?: number }) {
    if (variant === 'subtle') {
        return (
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-4 sm:mx-6 mt-4 p-3 sm:p-4 rounded-xl bg-accent/5 border border-accent/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 group hover:bg-accent/10 transition-all"
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                        <Sparkles size={16} />
                    </div>
                    <div>
                        <span className="text-xs text-text-primary font-bold block">Acesso de Convidado ({currentMessages}/{GUEST_MESSAGE_LIMIT})</span>
                        <span className="text-[11px] text-text-secondary">Obtenha acesso ilimitado e salve seu histórico.</span>
                    </div>
                </div>
                <button
                    onClick={onSignup}
                    className="text-xs font-bold px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-all active:scale-95 shadow-sm"
                >
                    Solicitar Conta
                </button>
            </motion.div>
        );
    }

    if (variant === 'modal') {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-bg-primary/90 backdrop-blur-md">
                <Card className="max-w-sm w-full text-center p-10 space-y-6 border-border-strong shadow-2xl">
                    <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto text-accent">
                        <LockKeyhole size={28} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold font-display tracking-tight text-text-primary mb-2">Capacidade Exaurida</h3>
                        <p className="text-sm text-text-secondary leading-relaxed">
                            Você atingiu o limite de <strong>{GUEST_MESSAGE_LIMIT} mensagens</strong> para convidados. Autentique-se para continuar.
                        </p>
                    </div>
                    <div className="flex flex-col gap-3">
                        <Button className="w-full h-11" onClick={onSignup}>Solicitar Credenciais</Button>
                        <button
                            onClick={onLogin}
                            className="text-xs font-bold text-text-tertiary hover:text-text-primary transition-colors py-2"
                        >
                            JÁ POSSUO ACESSO → ENTRAR
                        </button>
                    </div>
                </Card>
            </div>
        );
    }
    return null;
}

// ===== ChatWindow (Editorial Implementation) =====

interface ChatWindowProps {
    agentType?: ProfileType;
    embeddedAgentType?: ProfileType;
    onNavigateSignup?: () => void;
    onNavigateLogin?: () => void;
}

export function ChatWindow({ agentType, embeddedAgentType, onNavigateSignup, onNavigateLogin }: ChatWindowProps) {
    const activeAgentType = embeddedAgentType || agentType;
    const safeAgentType = activeAgentType || 'admin';

    const { isAuthenticated, profile, signOut } = useAuth();
    const {
        messages, conversations, currentConversation, isStreaming,
        guestMessageCount, isGuestLimitReached, sendMessage, deleteConversation,
        startNewConversation, selectConversation, isLoadingHistory,
    } = useChat(safeAgentType);

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [leadCaptured, setLeadCaptured] = useState(() => isAuthenticated || !!getStoredLead());
    const [leadData, setLeadData] = useState<LeadInfo | null>(() => getStoredLead());
    const [showSignupModal, setShowSignupModal] = useState(false);
    const [pendingMessage, setPendingMessage] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const config = AGENT_CONFIGS[safeAgentType];

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Count user messages (role === 'user')
    const userMessageCount = messages.filter(m => m.role === 'user').length;

    const handleSend = useCallback((content: string) => {
        // If authenticated, send normally
        if (isAuthenticated) {
            sendMessage(content);
            return;
        }
        // If lead captured but not signed up, check 3-message limit
        if (leadCaptured && !isAuthenticated && leadData && userMessageCount >= GUEST_MESSAGE_LIMIT) {
            setPendingMessage(content);
            setShowSignupModal(true);
            return;
        }
        sendMessage(content);
    }, [isAuthenticated, leadCaptured, leadData, userMessageCount, sendMessage]);

    const handleSignupComplete = useCallback(() => {
        setShowSignupModal(false);
        // After signup, user is authenticated — send the pending message
        if (pendingMessage) {
            setTimeout(() => {
                sendMessage(pendingMessage);
                setPendingMessage(null);
            }, 500);
        }
    }, [pendingMessage, sendMessage]);

    if (!activeAgentType) {
        return <div className="p-8 text-center text-text-tertiary">Agente não especificado.</div>;
    }

    // The subtle banner variable can be removed but leaving it false for now
    const showSubtleBanner = false;

    const handleConfirmDelete = () => {
        if (deletingId) {
            deleteConversation(deletingId);
            setDeletingId(null);
        }
    };

    return (
        <div className={`flex h-full bg-bg-primary dot-grid overflow-hidden ${!embeddedAgentType ? 'h-screen' : ''}`}>
            {isAuthenticated && !embeddedAgentType && (
                <ChatSidebar
                    conversations={conversations}
                    currentId={currentConversation?.id || null}
                    agentType={activeAgentType}
                    isOpen={sidebarOpen}
                    onClose={() => setSidebarOpen(false)}
                    onSelect={selectConversation}
                    onNewChat={startNewConversation}
                    isLoading={isLoadingHistory}
                    onConfirmDeleteRequest={setDeletingId}
                />
            )}

            <div className={`flex-1 flex flex-col min-w-0 bg-bg-primary relative ${embeddedAgentType ? 'rounded-xl' : ''}`}>
                {/* Header - Only in fullscreen mode */}
                {!embeddedAgentType && (
                    <header className="h-16 px-6 border-b border-border bg-bg-primary/95 backdrop-blur-md flex items-center justify-between sticky top-0 z-20 shrink-0">
                        <div className="flex items-center gap-3">
                            {isAuthenticated && (
                                <button
                                    onClick={() => setSidebarOpen(true)}
                                    className="p-2 lg:hidden text-text-tertiary hover:bg-bg-hover rounded-md transition-colors"
                                >
                                    <Menu size={20} />
                                </button>
                            )}
                            <div className="relative">
                                <AgentAvatar agentType={activeAgentType} size={36} />
                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-bg-primary rounded-full flex items-center justify-center">
                                    <div className="w-2 h-2 bg-success rounded-full" />
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-sm font-bold text-text-primary font-display tracking-tight leading-none">{config.name}</h2>
                                </div>
                                <p className="text-[10px] text-text-tertiary font-bold uppercase tracking-wider mt-1 opacity-60 flex items-center gap-1.5">
                                    <span className="w-1 h-1 bg-success rounded-full" />
                                    Online agora
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div
                                className="hidden sm:flex items-center px-2.5 py-1 rounded-full border text-[11px] font-bold tracking-tight"
                                style={{ backgroundColor: `${config.color}10`, color: config.color, borderColor: `${config.color}20` }}
                            >
                                {config.title}
                            </div>

                            {!isAuthenticated && onNavigateLogin && (
                                <button
                                    onClick={onNavigateLogin}
                                    className="text-xs font-bold text-text-tertiary hover:text-accent transition-colors px-3 py-1.5"
                                >
                                    ENTRAR
                                </button>
                            )}

                            <div className="w-px h-4 bg-border mx-1" />

                            {profile && (
                                <div className="relative">
                                    <button
                                        onClick={() => setUserMenuOpen(!userMenuOpen)}
                                        className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-bg-hover transition-all group border border-transparent hover:border-border"
                                    >
                                        <div className="hidden sm:flex flex-col items-end mr-1">
                                            <span className="text-xs font-bold text-text-primary tracking-tight group-hover:text-accent transition-colors">{profile.full_name}</span>
                                            <span className="text-[9px] font-bold text-text-tertiary uppercase tracking-widest opacity-60">Meu Perfil</span>
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent group-hover:bg-accent/20 transition-all">
                                            <User size={16} />
                                        </div>
                                    </button>

                                    <AnimatePresence>
                                        {userMenuOpen && (
                                            <>
                                                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                    className="absolute right-0 mt-2 w-48 bg-bg-secondary border border-border rounded-xl shadow-2xl z-50 py-2 overflow-hidden"
                                                >
                                                    <div className="px-4 py-2 border-b border-border/50 mb-1">
                                                        <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-[0.2em]">Conta Ativa</p>
                                                        <p className="text-xs font-bold text-text-primary truncate">{profile.full_name}</p>
                                                    </div>

                                                    <button className="w-full text-left px-4 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover flex items-center gap-2 transition-colors">
                                                        <User size={14} /> Meu Perfil
                                                    </button>
                                                    <button className="w-full text-left px-4 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover flex items-center gap-2 transition-colors">
                                                        <Building2 size={14} /> Meu Condomínio
                                                    </button>

                                                    <div className="h-px bg-border/50 my-1" />

                                                    <button
                                                        onClick={async () => {
                                                            await signOut();
                                                            if (onNavigateLogin) onNavigateLogin();
                                                        }}
                                                        className="w-full text-left px-4 py-2 text-xs font-bold text-error hover:bg-error/10 flex items-center gap-2 transition-colors"
                                                    >
                                                        <LogOut size={14} /> SAIR DA CONTA
                                                    </button>
                                                </motion.div>
                                            </>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}
                        </div>
                    </header>
                )}

                <div className="flex-1 overflow-y-auto w-full flex flex-col px-4">
                    {/* Subtle banner removed as requested */}

                    {!isAuthenticated && !leadCaptured ? (
                        <LeadGate
                            agentType={safeAgentType}
                            onLeadCaptured={(lead) => {
                                setLeadData(lead);
                                setLeadCaptured(true);
                            }}
                        />
                    ) : (
                        <div className="flex-1 w-full max-w-4xl mx-auto flex flex-col">
                            <AnimatePresence mode="wait">
                                {messages.length === 0 ? (
                                    <WelcomeScreen
                                        key="welcome"
                                        agentType={activeAgentType}
                                    />
                                ) : (
                                    <motion.div
                                        key="chat-flow"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="py-8 space-y-2 flex-1"
                                    >
                                        {messages.map((msg, idx) => (
                                            <MessageBubble
                                                key={msg.id}
                                                message={msg}
                                                agentType={activeAgentType}
                                                isLastInGroup={idx === messages.length - 1 || messages[idx + 1].role !== msg.role}
                                            />
                                        ))}

                                        {isStreaming && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="flex gap-3 px-4"
                                            >
                                                <AgentAvatar agentType={activeAgentType} size={28} />
                                                <TypingIndicator agentColor={config.color} />
                                            </motion.div>
                                        )}

                                        <div ref={messagesEndRef} className="h-4 shrink-0" />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}
                </div>

                {/* Modal banner removed. The FinishSignupModal will manage the limit restriction now. */}

                {(isAuthenticated || leadCaptured) && (
                    <ChatInput
                        onSend={handleSend}
                        isStreaming={isStreaming}
                        isDisabled={false} // Never disable input entirely, let handleSend block via modal
                        agentColor={config.color}
                    />
                )}
            </div>

            {/* Deletion Confirmation Modal */}
            <DeleteConfirmModal
                isOpen={!!deletingId}
                onCancel={() => setDeletingId(null)}
                onConfirm={handleConfirmDelete}
            />

            {/* Finish Signup Modal - triggers after 3rd guest message */}
            {leadData && (
                <FinishSignupModal
                    isOpen={showSignupModal}
                    onClose={() => setShowSignupModal(false)}
                    leadData={leadData}
                    onSignupComplete={handleSignupComplete}
                    pendingMessage={pendingMessage || undefined}
                />
            )}
        </div>
    );
}
