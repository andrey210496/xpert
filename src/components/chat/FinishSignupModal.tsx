import { useState } from 'react';
import { motion } from 'framer-motion';
import { Modal, Input, Button } from '../ui';
import { Lock, UserCheck, AlertCircle, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { LeadInfo } from './LeadGate';
import { clearStoredLead } from './LeadGate';
import type { ProfileType } from '../../types';
import { Home, Wrench, Hammer, Building2 } from 'lucide-react';

const PROFILE_OPTIONS = [
    { type: 'morador' as ProfileType, label: 'Morador', desc: 'Sou morador', Icon: Home, color: '#10B981' },
    { type: 'zelador' as ProfileType, label: 'Zelador', desc: 'Sou zelador', Icon: Wrench, color: '#F59E0B' },
    { type: 'prestador' as ProfileType, label: 'Prestador', desc: 'Presto serviços', Icon: Hammer, color: '#8B5CF6' },
    { type: 'admin' as ProfileType, label: 'Síndico', desc: 'Sou síndico(a)', Icon: Building2, color: '#3B82F6' },
];

interface FinishSignupModalProps {
    isOpen: boolean;
    onClose: () => void;
    leadData: LeadInfo;
    onSignupComplete: () => void;
    pendingMessage?: string;
}

export function FinishSignupModal({ isOpen, onClose, leadData, onSignupComplete }: FinishSignupModalProps) {
    const { signUpFromLead } = useAuth();
    const [selectedProfile, setSelectedProfile] = useState<ProfileType | null>(leadData.profileType || null);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!selectedProfile) {
            setError('Selecione seu perfil antes de continuar.');
            return;
        }

        if (!password.trim()) {
            setError('Crie uma senha para sua conta.');
            return;
        }

        if (password.length < 6) {
            setError('A senha deve ter pelo menos 6 caracteres.');
            return;
        }

        if (password !== confirmPassword) {
            setError('As senhas não coincidem.');
            return;
        }

        setIsLoading(true);
        try {
            const result = await signUpFromLead({
                email: leadData.email,
                password,
                fullName: leadData.name,
                phone: leadData.phone,
                profileType: selectedProfile,
            });

            if (result.error) {
                if (result.error.includes('already registered') || result.error.includes('already been registered') || result.error.includes('User already registered')) {
                    setError('Este e-mail já está cadastrado. Utilize a opção "Entrar" no topo da página.');
                } else {
                    setError(result.error);
                }
                return;
            }

            clearStoredLead();
            onSignupComplete();
        } catch {
            setError('Erro ao finalizar cadastro. Tente novamente.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="sm">
            <div className="relative pt-4 pb-2">
                <button
                    onClick={onClose}
                    className="absolute -top-2 -right-2 p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer z-10"
                    title="Fechar"
                >
                    <X size={18} />
                </button>
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex justify-center mb-4"
                >
                    <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center">
                        <UserCheck size={28} className="text-accent" />
                    </div>
                </motion.div>

                <h2 className="text-lg font-extrabold text-text-primary text-center tracking-tight font-display mb-1">
                    Para ter sua resposta, finalize seu cadastro
                </h2>
                <p className="text-xs text-text-secondary text-center mb-6">
                    Crie uma senha para acessar suas conversas a qualquer momento.
                </p>

                <div className="bg-bg-secondary/50 border border-border rounded-xl p-3 mb-5">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                            <span className="text-text-tertiary">Nome</span>
                            <p className="text-text-primary font-medium truncate">{leadData.name}</p>
                        </div>
                        <div>
                            <span className="text-text-tertiary">E-mail</span>
                            <p className="text-text-primary font-medium truncate">{leadData.email}</p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-text-primary tracking-tight">Qual seu perfil?</label>
                        <div className="grid grid-cols-2 gap-2">
                            {PROFILE_OPTIONS.map((opt) => (
                                <button
                                    key={opt.type}
                                    type="button"
                                    onClick={() => {
                                        setSelectedProfile(opt.type);
                                        setError('');
                                    }}
                                    className={`flex items-center gap-2.5 p-2 rounded-xl border transition-all text-left ${selectedProfile === opt.type ? 'bg-bg-hover ring-1 ring-border-strong border-border-strong shadow-sm' : 'border-border bg-bg-elevated hover:bg-bg-secondary cursor-pointer active:scale-95'}`}
                                >
                                    <div
                                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                                        style={{ backgroundColor: `${opt.color}15` }}
                                    >
                                        <opt.Icon size={14} style={{ color: opt.color }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-bold text-text-primary truncate">{opt.label}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <Input
                        label="Crie sua senha"
                        placeholder="Mínimo 6 caracteres"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoFocus
                    />
                    <Input
                        label="Confirme a senha"
                        placeholder="Repita a senha"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                    />

                    {error && (
                        <div className="flex items-start gap-2 text-[10px] uppercase tracking-wider font-bold text-error bg-error/5 border border-error/20 rounded-md px-3 py-2">
                            <AlertCircle size={14} className="shrink-0 mt-0.5" />
                            {error}
                        </div>
                    )}

                    <Button type="submit" size="lg" isLoading={isLoading} className="mt-1 font-bold tracking-tight">
                        <Lock size={16} className="mr-2" />
                        Finalizar Cadastro
                    </Button>
                </form>
            </div>
        </Modal>
    );
}
