import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Phone, Send, ShieldCheck, Bot } from 'lucide-react';
import { AGENT_CONFIGS } from '../../config/agents';
import { supabase } from '../../services/supabase';
import type { ProfileType } from '../../types';

const LEAD_STORAGE_KEY = 'xpert_chat_lead';

interface LeadInfo {
    name: string;
    phone: string;
    leadId: string;
}

export function getStoredLead(): LeadInfo | null {
    try {
        const stored = localStorage.getItem(LEAD_STORAGE_KEY);
        if (!stored) return null;
        const parsed = JSON.parse(stored);
        if (parsed.name && parsed.phone && parsed.leadId) return parsed;
        return null;
    } catch {
        return null;
    }
}

function storeLead(lead: LeadInfo) {
    localStorage.setItem(LEAD_STORAGE_KEY, JSON.stringify(lead));
}

type Step = 'greeting' | 'name' | 'phone' | 'consent' | 'done';

interface LeadGateProps {
    agentType: ProfileType;
    onLeadCaptured: (lead: LeadInfo) => void;
}

function AgentBubble({ children, agentType }: { children: React.ReactNode; agentType: ProfileType }) {
    const config = AGENT_CONFIGS[agentType];
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex gap-3 px-4"
        >
            <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border border-border"
                style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
            >
                <Bot size={14} style={{ color: config.color }} />
            </div>
            <div className="bg-bg-elevated border border-border rounded-xl rounded-tl-sm px-3.5 py-2.5 max-w-[80%]">
                <p className="text-sm text-text-primary leading-relaxed">{children}</p>
            </div>
        </motion.div>
    );
}

function UserBubble({ children, agentType }: { children: React.ReactNode; agentType: ProfileType }) {
    const config = AGENT_CONFIGS[agentType];
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex gap-3 px-4 flex-row-reverse"
        >
            <div className="w-7 h-7 rounded-lg bg-bg-elevated flex items-center justify-center shrink-0 border border-border mt-0.5">
                <User size={14} className="text-text-tertiary" />
            </div>
            <div
                className="rounded-xl rounded-tr-sm px-3.5 py-2.5 max-w-[80%]"
                style={{ backgroundColor: `${config.color}15`, borderColor: `${config.color}25`, borderWidth: '1px' }}
            >
                <p className="text-sm text-text-primary leading-relaxed">{children}</p>
            </div>
        </motion.div>
    );
}

export function LeadGate({ agentType, onLeadCaptured }: LeadGateProps) {
    const config = AGENT_CONFIGS[agentType];
    const [step, setStep] = useState<Step>('greeting');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const timer = setTimeout(() => setStep('name'), 800);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (step === 'name' || step === 'phone') {
            setTimeout(() => inputRef.current?.focus(), 400);
        }
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [step]);

    const formatPhone = (value: string): string => {
        const digits = value.replace(/\D/g, '').slice(0, 11);
        if (digits.length <= 2) return digits;
        if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    };

    const handleNameSubmit = () => {
        if (!name.trim() || name.trim().length < 2) return;
        setStep('phone');
    };

    const handlePhoneSubmit = () => {
        const digits = phone.replace(/\D/g, '');
        if (digits.length < 10) return;
        setStep('consent');
    };

    const handleConsent = async () => {
        setIsSubmitting(true);
        try {
            const { data, error } = await supabase.from('leads').insert([{
                first_name: name.trim(),
                phone: phone.trim(),
                status: 'new',
                source: 'chat',
            }]).select('id').single();

            if (error) throw error;

            const lead: LeadInfo = {
                name: name.trim(),
                phone: phone.trim(),
                leadId: data.id,
            };
            storeLead(lead);
            setStep('done');

            setTimeout(() => onLeadCaptured(lead), 600);
        } catch (err) {
            if (import.meta.env.DEV) console.error('[LeadGate] Error:', err);
            // Fallback: allow chat even if save fails
            const lead: LeadInfo = { name: name.trim(), phone: phone.trim(), leadId: 'local' };
            storeLead(lead);
            setStep('done');
            setTimeout(() => onLeadCaptured(lead), 600);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            action();
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full">
            <div className="flex-1 overflow-y-auto py-8">
                <div className="max-w-2xl mx-auto space-y-4">
                    {/* Greeting */}
                    <AgentBubble agentType={agentType}>
                        Olá! 👋 Eu sou o <strong>{config.name}</strong>. Estou aqui para te ajudar.
                    </AgentBubble>

                    <AnimatePresence>
                        {/* Ask name */}
                        {step !== 'greeting' && (
                            <AgentBubble agentType={agentType}>
                                Para começarmos, como posso te chamar?
                            </AgentBubble>
                        )}

                        {/* Name input */}
                        {step === 'name' && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="px-4"
                            >
                                <div className="max-w-sm ml-10">
                                    <div
                                        className="flex items-center gap-2 rounded-xl border p-2.5 transition-all focus-within:ring-2"
                                        style={{ borderColor: `${config.color}40`, boxShadow: `0 0 0 1px ${config.color}10` } as React.CSSProperties}
                                    >
                                        <User size={16} className="text-text-tertiary shrink-0 ml-1" />
                                        <input
                                            ref={inputRef}
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value.slice(0, 100))}
                                            onKeyDown={(e) => handleKeyDown(e, handleNameSubmit)}
                                            placeholder="Seu nome..."
                                            className="flex-1 bg-transparent text-text-primary placeholder:text-text-tertiary outline-none text-sm"
                                            autoComplete="given-name"
                                        />
                                        <button
                                            onClick={handleNameSubmit}
                                            disabled={!name.trim() || name.trim().length < 2}
                                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all shrink-0 active:scale-90 disabled:opacity-20"
                                            style={{
                                                backgroundColor: name.trim().length >= 2 ? config.color : 'var(--color-bg-tertiary)',
                                                color: name.trim().length >= 2 ? '#FFF' : 'var(--color-text-tertiary)',
                                            }}
                                        >
                                            <Send size={13} />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* Name echo + ask phone */}
                        {(step === 'phone' || step === 'consent' || step === 'done') && (
                            <>
                                <UserBubble agentType={agentType}>{name}</UserBubble>
                                <AgentBubble agentType={agentType}>
                                    Prazer, <strong>{name}</strong>! 😊 Pode me informar seu telefone para contato?
                                </AgentBubble>
                            </>
                        )}

                        {/* Phone input */}
                        {step === 'phone' && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="px-4"
                            >
                                <div className="max-w-sm ml-10">
                                    <div
                                        className="flex items-center gap-2 rounded-xl border p-2.5 transition-all focus-within:ring-2"
                                        style={{ borderColor: `${config.color}40`, boxShadow: `0 0 0 1px ${config.color}10` } as React.CSSProperties}
                                    >
                                        <Phone size={16} className="text-text-tertiary shrink-0 ml-1" />
                                        <input
                                            ref={inputRef}
                                            type="tel"
                                            value={phone}
                                            onChange={(e) => setPhone(formatPhone(e.target.value))}
                                            onKeyDown={(e) => handleKeyDown(e, handlePhoneSubmit)}
                                            placeholder="(00) 00000-0000"
                                            className="flex-1 bg-transparent text-text-primary placeholder:text-text-tertiary outline-none text-sm"
                                            autoComplete="tel"
                                        />
                                        <button
                                            onClick={handlePhoneSubmit}
                                            disabled={phone.replace(/\D/g, '').length < 10}
                                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all shrink-0 active:scale-90 disabled:opacity-20"
                                            style={{
                                                backgroundColor: phone.replace(/\D/g, '').length >= 10 ? config.color : 'var(--color-bg-tertiary)',
                                                color: phone.replace(/\D/g, '').length >= 10 ? '#FFF' : 'var(--color-text-tertiary)',
                                            }}
                                        >
                                            <Send size={13} />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* Phone echo + LGPD consent */}
                        {(step === 'consent' || step === 'done') && (
                            <>
                                <UserBubble agentType={agentType}>{phone}</UserBubble>
                                <AgentBubble agentType={agentType}>
                                    Obrigado, {name}! Antes de começarmos, preciso do seu consentimento:
                                </AgentBubble>
                            </>
                        )}

                        {/* Consent card */}
                        {step === 'consent' && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="px-4"
                            >
                                <div className="max-w-md ml-10 p-4 rounded-xl border border-border bg-bg-secondary/50">
                                    <div className="flex items-start gap-3 mb-4">
                                        <ShieldCheck size={20} className="text-success shrink-0 mt-0.5" />
                                        <p className="text-xs text-text-secondary leading-relaxed">
                                            Seus dados serão utilizados exclusivamente para identificação durante o atendimento e eventual contato sobre sua dúvida.
                                            Não compartilhamos suas informações com terceiros, em conformidade com a <strong className="text-text-primary">LGPD (Lei 13.709/2018)</strong>.
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleConsent}
                                        disabled={isSubmitting}
                                        className="w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest text-white transition-all active:scale-[0.98] disabled:opacity-60"
                                        style={{ backgroundColor: config.color }}
                                    >
                                        {isSubmitting ? 'Salvando...' : 'Concordo, vamos começar!'}
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* Done */}
                        {step === 'done' && (
                            <AgentBubble agentType={agentType}>
                                Perfeito! ✅ Agora estou pronto para te ajudar. O que você precisa saber?
                            </AgentBubble>
                        )}
                    </AnimatePresence>

                    <div ref={bottomRef} className="h-4" />
                </div>
            </div>
        </div>
    );
}
