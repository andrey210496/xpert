import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Phone, User, ShieldCheck, X } from 'lucide-react';

interface UserProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    profile: any;
}

export function UserProfileModal({ isOpen, onClose, profile }: UserProfileModalProps) {
    if (!isOpen) return null;

    const roleLabel: Record<string, string> = {
        superadmin: 'Super Administrador',
        admin: 'Síndico',
        morador: 'Morador',
        zelador: 'Zelador',
        prestador: 'Prestador de Serviço',
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    {/* Panel */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: 16 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 16 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        className="relative w-full max-w-sm bg-bg-secondary border border-border rounded-2xl overflow-hidden"
                        style={{ boxShadow: 'var(--shadow-deep)' }}
                    >
                        {/* Top accent line */}
                        <div className="h-px w-full bg-gradient-to-r from-transparent via-accent/60 to-transparent" />

                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-all"
                        >
                            <X size={15} />
                        </button>

                        <div className="p-6 space-y-5">
                            {/* Header */}
                            <div className="flex flex-col items-center text-center pb-5 border-b border-border/50">
                                <div
                                    className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent mb-4 hover-lift"
                                    style={{ boxShadow: 'var(--shadow-accent)' }}
                                >
                                    <User size={28} />
                                </div>
                                <h3 className="text-lg font-display font-semibold text-text-primary tracking-tight">
                                    {profile.full_name}
                                </h3>
                                <div className="mt-2 flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 border border-accent/20">
                                    <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                                    <span className="text-[10px] font-bold tracking-widest text-accent uppercase">
                                        {roleLabel[profile.profile_type] ?? profile.profile_type}
                                    </span>
                                </div>
                            </div>

                            {/* Info rows */}
                            <div className="space-y-3">
                                <div className="surface-card-sm p-4 flex items-center gap-3 group cursor-default">
                                    <div className="w-8 h-8 rounded-lg bg-bg-elevated flex items-center justify-center text-text-tertiary group-hover:text-accent group-hover:bg-accent/10 transition-all">
                                        <Mail size={15} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-mono uppercase tracking-widest text-text-tertiary">E-mail de Acesso</p>
                                        <p className="text-sm text-text-secondary mt-0.5">{profile.email || 'associado à conta'}</p>
                                    </div>
                                </div>

                                <div className="surface-card-sm p-4 flex items-center gap-3 group cursor-default">
                                    <div className="w-8 h-8 rounded-lg bg-bg-elevated flex items-center justify-center text-text-tertiary group-hover:text-accent group-hover:bg-accent/10 transition-all">
                                        <Phone size={15} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-mono uppercase tracking-widest text-text-tertiary">Telefone</p>
                                        <p className="text-sm text-text-secondary mt-0.5">{profile.phone || 'Não informado'}</p>
                                    </div>
                                </div>

                                <div className="p-4 rounded-xl bg-accent/5 border border-accent/15 flex items-start gap-3">
                                    <ShieldCheck className="text-accent shrink-0 mt-0.5" size={15} />
                                    <p className="text-xs text-text-secondary leading-relaxed">
                                        Suas informações são protegidas por criptografia e acessíveis apenas pela administração do seu condomínio.
                                    </p>
                                </div>
                            </div>

                            <button onClick={onClose} className="btn-ghost w-full uppercase tracking-widest text-[11px]">
                                Fechar
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
