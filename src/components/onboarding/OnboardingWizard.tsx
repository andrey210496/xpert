import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Input, Badge, Logo } from '../ui';
import { Home, Wrench, Hammer, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import type { ProfileType, Profile } from '../../types';

interface OnboardingProps {
    onComplete: (profile?: Profile) => void;
    onBack: () => void;
}

const profileOptions = [
    { type: 'morador' as ProfileType, title: 'Morador', desc: 'Sou morador de um condomínio', Icon: Home, color: '#00D4FF' },
    { type: 'zelador' as ProfileType, title: 'Zelador', desc: 'Trabalho como zelador', Icon: Wrench, color: '#FF6B35' },
    { type: 'prestador' as ProfileType, title: 'Prestador', desc: 'Presto serviços para condomínios', Icon: Hammer, color: '#A855F7' },
];

const profileVariant = {
    morador: 'morador',
    zelador: 'zelador',
    prestador: 'prestador',
    admin: 'sindico',
    sindico: 'sindico'
} as const;

export function OnboardingWizard({ onComplete, onBack }: OnboardingProps) {
    const { signUp } = useAuth();
    const [step, setStep] = useState(0);
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        phone: '',
        password: '',
        profileType: '' as ProfileType | '',
        inviteCode: '',
        tenantName: '',
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const totalSteps = 4;
    const direction = 1;

    const validateStep = (): boolean => {
        const errs: Record<string, string> = {};
        if (step === 0) {
            if (!formData.fullName.trim()) errs.fullName = 'Nome é obrigatório';
            if (!formData.email.trim()) errs.email = 'Email é obrigatório';
            if (!formData.phone.trim()) errs.phone = 'Telefone é obrigatório';
        }
        if (step === 1) {
            if (!formData.profileType) errs.profileType = 'Selecione um perfil';
        }
        if (step === 3) {
            if (!formData.password || formData.password.length < 8) errs.password = 'Senha deve ter pelo menos 8 caracteres';
            else if (!/[a-zA-Z]/.test(formData.password) || !/[0-9]/.test(formData.password)) errs.password = 'Senha deve conter letras e números';
        }
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleNext = async () => {
        if (!validateStep()) return;
        if (step === totalSteps - 1) {
            // Submit
            setIsSubmitting(true);
            const result = await signUp({
                email: formData.email,
                password: formData.password,
                fullName: formData.fullName,
                phone: formData.phone,
                profileType: formData.profileType as ProfileType,
                tenantName: formData.profileType === 'admin' || formData.profileType === 'superadmin' ? formData.tenantName : undefined,
                inviteCode: formData.profileType !== 'admin' && formData.profileType !== 'superadmin' ? formData.inviteCode : undefined,
            });
            setIsSubmitting(false);
            if (result.error) {
                setErrors({ submit: result.error });
            } else {
                onComplete(result.profile);
            }
        } else {
            setStep((s) => s + 1);
        }
    };

    const slideVariants = {
        enter: { x: direction > 0 ? 100 : -100, opacity: 0 },
        center: { x: 0, opacity: 1 },
        exit: { x: direction < 0 ? 100 : -100, opacity: 0 },
    };

    return (
        <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center py-12 px-4">
            <div className="w-full max-w-lg">
                <div className="flex justify-center mb-8">
                    <Logo size="md" />
                </div>
                {/* Progress */}
                <div className="flex items-center gap-2 mb-8">
                    {Array.from({ length: totalSteps }).map((_, i) => (
                        <div key={i} className="flex-1 h-1 rounded-full overflow-hidden bg-bg-tertiary">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: i <= step ? '100%' : '0%' }}
                                className="h-full rounded-full bg-accent"
                                transition={{ duration: 0.3 }}
                            />
                        </div>
                    ))}
                </div>

                {/* Steps */}
                <div className="glass-premium border-glow-premium p-8 min-h-[400px] flex flex-col rounded-2xl shadow-2xl relative overflow-hidden">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={step}
                            variants={slideVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.3 }}
                            className="flex-1"
                        >
                            {step === 0 && (
                                <div>
                                    <h2 className="text-2xl font-bold text-text-primary mb-2">Crie sua conta</h2>
                                    <p className="text-text-secondary text-sm mb-6">
                                        Preencha seus dados para começar a usar o XPERT.
                                    </p>
                                    <div className="flex flex-col gap-4">
                                        <Input
                                            label="Nome completo"
                                            placeholder="Seu Nome"
                                            value={formData.fullName}
                                            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                            error={errors.fullName}
                                        />
                                        <Input
                                            label="Email"
                                            placeholder="seu@email.com"
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            error={errors.email}
                                        />
                                        <Input
                                            label="Telefone"
                                            placeholder="(11) 99999-9999"
                                            type="tel"
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            error={errors.phone}
                                        />
                                    </div>
                                </div>
                            )}

                            {step === 1 && (
                                <div>
                                    <h2 className="text-2xl font-bold text-text-primary mb-2">Qual seu perfil?</h2>
                                    <p className="text-text-secondary text-sm mb-6">
                                        Selecione o perfil que melhor descreve sua relação com o condomínio.
                                    </p>
                                    <div className="grid grid-cols-2 gap-3">
                                        {profileOptions.map((opt) => (
                                            <motion.button
                                                key={opt.type}
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                                onClick={() => setFormData({ ...formData, profileType: opt.type })}
                                                className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${formData.profileType === opt.type
                                                    ? 'border-accent/50 bg-accent/5'
                                                    : 'border-border hover:border-border/80 bg-bg-secondary'
                                                    }`}
                                            >
                                                <opt.Icon
                                                    size={24}
                                                    className="mb-2"
                                                />
                                                <div className="text-sm font-medium text-text-primary">{opt.title}</div>
                                                <div className="text-xs text-text-tertiary mt-0.5">{opt.desc}</div>
                                            </motion.button>
                                        ))}
                                    </div>
                                    {errors.profileType && (
                                        <p className="text-xs text-error mt-2">{errors.profileType}</p>
                                    )}
                                </div>
                            )}

                            {step === 2 && (
                                <div>
                                    <h2 className="text-2xl font-bold text-text-primary mb-2">Código do condomínio</h2>
                                    <p className="text-text-secondary text-sm mb-6">
                                        Insira o código de convite enviado pelo seu síndico para se vincular ao condomínio correto.
                                    </p>
                                    <Input
                                        label="Código de convite"
                                        placeholder="Ex: PARQUE-2024"
                                        value={formData.inviteCode}
                                        onChange={(e) => setFormData({ ...formData, inviteCode: e.target.value })}
                                    />
                                    <div className="mt-4 p-3 rounded-xl bg-bg-secondary border border-border">
                                        <p className="text-xs text-text-tertiary">
                                            💡 O código de convite vincula sua conta ao condomínio. Peça ao seu síndico
                                            se não possui um código. (Ex: BLOCO-A-XYZW)
                                        </p>
                                    </div>
                                </div>
                            )}

                            {step === 3 && (
                                <div>
                                    <h2 className="text-2xl font-bold text-text-primary mb-2">Quase pronto!</h2>
                                    <p className="text-text-secondary text-sm mb-6">
                                        Crie uma senha para sua conta.
                                    </p>
                                    <Input
                                        label="Senha"
                                        placeholder="Mínimo 6 caracteres"
                                        type="password"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        error={errors.password}
                                    />

                                    {/* Summary */}
                                    <div className="mt-6 p-4 rounded-xl bg-bg-secondary border border-border">
                                        <h4 className="text-sm font-medium text-text-primary mb-3">Resumo</h4>
                                        <div className="flex flex-col gap-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-text-tertiary">Nome</span>
                                                <span className="text-text-primary">{formData.fullName}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-text-tertiary">Email</span>
                                                <span className="text-text-primary">{formData.email}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-text-tertiary">Perfil</span>
                                                <Badge variant={profileVariant[formData.profileType as keyof typeof profileVariant] || 'neutral'}>
                                                    {profileOptions.find((p) => p.type === formData.profileType)?.title}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>

                                    {errors.submit && (
                                        <p className="text-xs text-error mt-3">{errors.submit}</p>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>

                    {/* Navigation */}
                    <div className="flex items-center justify-between mt-8">
                        <Button
                            variant="ghost"
                            onClick={() => (step === 0 ? onBack() : setStep((s) => s - 1))}
                        >
                            <ArrowLeft size={16} /> Voltar
                        </Button>
                        <Button
                            onClick={handleNext}
                            isLoading={isSubmitting}
                        >
                            {step === totalSteps - 1 ? (
                                <>
                                    <Check size={16} /> Criar Conta
                                </>
                            ) : (
                                <>
                                    Próximo <ArrowRight size={16} />
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
