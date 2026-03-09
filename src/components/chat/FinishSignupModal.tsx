import { useState } from 'react';
import { motion } from 'framer-motion';
import { Modal, Input, Button } from '../ui';
import { Lock, UserCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { LeadInfo } from './LeadGate';
import { clearStoredLead } from './LeadGate';

interface FinishSignupModalProps {
    isOpen: boolean;
    onClose: () => void;
    leadData: LeadInfo;
    onSignupComplete: () => void;
    pendingMessage?: string;
}

export function FinishSignupModal({ isOpen, onClose, leadData, onSignupComplete }: FinishSignupModalProps) {
    const { signUpFromLead } = useAuth();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

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
                profileType: leadData.profileType,
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
            <div className="pt-4 pb-2">
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
