import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Info, ShieldCheck, Ticket, ArrowRight, CheckCircle2, AlertCircle, Loader2, LogIn } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface TenantInfoModalProps {
    isOpen: boolean;
    onClose: () => void;
    tenant: any | null;
}

type Step = 'idle' | 'loading' | 'success' | 'error';

export function TenantInfoModal({ isOpen, onClose, tenant }: TenantInfoModalProps) {
    const { profile } = useAuth();
    const [inviteCode, setInviteCode] = useState('');
    const [step, setStep] = useState<Step>('idle');
    const [errorMsg, setErrorMsg] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteCode.trim() || !profile) return;

        setStep('loading');
        setErrorMsg('');

        // 1) Look up the invite code
        const { data: codeData, error: codeError } = await supabase
            .from('invite_codes')
            .select('*')
            .eq('code', inviteCode.trim().toUpperCase())
            .maybeSingle();

        if (codeError || !codeData) {
            setStep('error');
            setErrorMsg('Código inválido ou não encontrado.');
            return;
        }

        if (codeData.current_uses >= codeData.max_uses) {
            setStep('error');
            setErrorMsg('Este código atingiu o limite máximo de usos.');
            return;
        }

        // 2) Link the user to the tenant and update their role
        const { error: updateError } = await supabase
            .from('profiles')
            .update({
                tenant_id: codeData.tenant_id,
                profile_type: codeData.profile_type,
            })
            .eq('id', profile.id);

        if (updateError) {
            setStep('error');
            setErrorMsg('Erro ao vincular ao condomínio. Tente novamente.');
            return;
        }

        // 3) Increment the invite code usage counter
        await supabase
            .from('invite_codes')
            .update({ current_uses: codeData.current_uses + 1 })
            .eq('id', codeData.id);

        setStep('success');

        // Reload after a moment so auth refreshes with the new tenant
        setTimeout(() => {
            window.location.reload();
        }, 2200);
    };

    if (!isOpen) return null;

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
                        className="relative w-full max-w-md glass-premium border-glow-premium rounded-2xl overflow-hidden shadow-2xl"
                    >
                        {/* Glow Header Strip */}
                        <div className="glow-accent-sm h-1 w-full bg-accent/60 rounded-t-2xl" />

                        <div className="p-6">
                            {tenant ? (
                                /* ── CONNECTED STATE ── */
                                <div className="animate-fade-in-up space-y-5">
                                    <div className="flex flex-col items-center text-center pb-5 border-b border-border/50">
                                        <div
                                            className="w-16 h-16 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent mb-4 hover-lift"
                                            style={{ boxShadow: 'var(--shadow-accent)' }}
                                        >
                                            <Building2 size={28} />
                                        </div>
                                        <h3 className="text-lg font-display font-semibold text-text-primary tracking-tight">{tenant.name}</h3>
                                        <div className="mt-2">
                                            {tenant.status === 'active' ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-success/10 border border-success/25 text-[10px] font-bold tracking-widest text-success uppercase">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" /> LICENÇA ATIVA
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-warning/10 border border-warning/25 text-[10px] font-bold tracking-widest text-warning uppercase">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-warning" /> INATIVO
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="surface-card-sm p-4 flex items-start gap-3">
                                        <ShieldCheck className="text-accent shrink-0 mt-0.5" size={16} />
                                        <div>
                                            <p className="text-[10px] font-mono uppercase tracking-widest text-text-tertiary mb-1">Conexão Segura</p>
                                            <p className="text-sm text-text-secondary">Conectado ao banco privado desta administração.</p>
                                        </div>
                                    </div>

                                    <div className="p-4 rounded-xl bg-accent/5 border border-accent/15 flex gap-3">
                                        <Info className="text-accent shrink-0 mt-0.5" size={15} />
                                        <p className="text-xs text-text-secondary leading-relaxed">
                                            Este assistente possui acesso exclusivo às documentações e histórico de comunicados validados pela administração deste condomínio.
                                        </p>
                                    </div>

                                    <button onClick={onClose} className="btn-ghost w-full mt-2 uppercase text-[11px]">
                                        Fechar
                                    </button>
                                </div>
                            ) : (
                                /* ── NOT CONNECTED STATE ── */
                                <div className="animate-fade-in-up space-y-5">
                                    <div className="flex flex-col items-center text-center pb-5 border-b border-border/50">
                                        <div className="w-16 h-16 rounded-xl bg-bg-elevated border border-border flex items-center justify-center text-text-tertiary mb-4">
                                            <LogIn size={28} />
                                        </div>
                                        <h3 className="text-lg font-display font-semibold text-text-primary tracking-tight">Vincular Condomínio</h3>
                                        <p className="mt-1 text-sm text-text-secondary leading-relaxed max-w-xs">
                                            Insira o código de convite gerado pelo síndico para se conectar ao seu condomínio.
                                        </p>
                                    </div>

                                    <AnimatePresence mode="wait">
                                        {step === 'success' ? (
                                            <motion.div
                                                key="success"
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className="flex flex-col items-center gap-3 py-6 text-center"
                                            >
                                                <div className="w-14 h-14 rounded-full bg-success/15 border border-success/30 flex items-center justify-center">
                                                    <CheckCircle2 className="text-success" size={28} />
                                                </div>
                                                <p className="text-sm font-semibold text-text-primary">Vinculado com sucesso!</p>
                                                <p className="text-xs text-text-secondary">Recarregando sua sessão...</p>
                                            </motion.div>
                                        ) : (
                                            <motion.form
                                                key="form"
                                                onSubmit={handleSubmit}
                                                className="space-y-4"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                            >
                                                <div className="space-y-2">
                                                    <label className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest flex items-center gap-1.5">
                                                        <Ticket size={12} className="text-accent" /> Código de Convite
                                                    </label>
                                                    <input
                                                        className="input-premium font-mono tracking-widest uppercase text-center text-base"
                                                        placeholder="EX: BLOCO-A-XK9F"
                                                        value={inviteCode}
                                                        onChange={(e) => {
                                                            setInviteCode(e.target.value);
                                                            if (step === 'error') setStep('idle');
                                                        }}
                                                        disabled={step === 'loading'}
                                                        autoComplete="off"
                                                    />
                                                </div>

                                                <AnimatePresence>
                                                    {step === 'error' && (
                                                        <motion.div
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: 'auto' }}
                                                            exit={{ opacity: 0, height: 0 }}
                                                            className="flex items-center gap-2 p-3 rounded-lg bg-error/10 border border-error/25 text-sm text-error"
                                                        >
                                                            <AlertCircle size={15} className="shrink-0" />
                                                            {errorMsg}
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>

                                                <button
                                                    type="submit"
                                                    disabled={!inviteCode.trim() || step === 'loading'}
                                                    className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                                >
                                                    {step === 'loading' ? (
                                                        <><Loader2 size={15} className="animate-spin" /> Verificando...</>
                                                    ) : (
                                                        <><ArrowRight size={15} /> ENTRAR NO CONDOMÍNIO</>
                                                    )}
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={onClose}
                                                    className="btn-ghost w-full uppercase text-[11px]"
                                                >
                                                    Cancelar
                                                </button>
                                            </motion.form>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
