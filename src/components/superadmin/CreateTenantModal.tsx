import { useState } from 'react';
import { Modal, Input, Button } from '../ui';
import { supabase } from '../../services/supabase';
import { Building2 } from 'lucide-react';

interface CreateTenantModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function CreateTenantModal({ isOpen, onClose, onSuccess }: CreateTenantModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [step, setStep] = useState<'form' | 'success'>('form');
    const [masterCode, setMasterCode] = useState('');
    const [formData, setFormData] = useState({
        tenantName: '',
        plan: 'premium',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (
        if (!formData.tenantName.trim()) {
            setError('Preencha o nome do condomínio.');
            return;
        }

        if (formData.tenantName.trim().length > 120) {
            setError('Nome do condomínio muito longo (máx. 120 caracteres).');
            return;
        }

        setIsLoading(true);
        try {
            // 1. Criar o Condomínio (Tenant)
            const { data: tenantData, error: tenantError } = await supabase
                .from('tenants')
                .insert([{
                    name: formData.tenantName.trim(),
                    plan: formData.plan,
                    status: 'active',
                    plan_tokens_total: formData.plan === 'premium' ? 1000000 : 500000,
                    token_balance: formData.plan === 'premium' ? 1000000 : 500000
                }])
                .select('id')
                .single();

            if (tenantError) throw tenantError;
            if (!tenantData) throw new Error('Não foi possível identificar o ID do condomínio criado.');

            // 2. Criar a Chave Mestra (Invite Code)
            const code = `MASTER-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
            
            const { error: inviteError } = await supabase
                .from('invite_codes')
                .insert([{
                    tenant_id: tenantData.id,
                    code: code,
                    profile_type: 'admin',
                    max_uses: 1,
                    current_uses: 0
                }]);

            if (inviteError) throw inviteError;

            setMasterCode(code);
            setStep('success');
            onSuccess();
        } catch (err: unknown) {
            if (import.meta.env.DEV) console.error('Erro ao criar tenant:', err);
            setError(err instanceof Error ? err.message : 'Erro inesperado ao criar o condomínio.');
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(masterCode);
        alert('Código Mestre copiado!');
    };

    return (
        <Modal isOpen={isOpen} onClose={step === 'success' ? () => { onClose(); setStep('form'); setMasterCode(''); } : onClose} size="md">
            {step === 'form' ? (
                <>
                    <div className="text-center mb-6 pt-2">
                        <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mx-auto text-accent mb-4">
                            <Building2 size={24} />
                        </div>
                        <h2 className="text-xl font-bold text-text-primary tracking-tight font-display mb-1">Novo Condomínio</h2>
                        <p className="text-sm text-text-secondary font-sans leading-relaxed">
                            Crie um ambiente isolado (Tenant) e gere o código mestre para o Síndico.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <div className="space-y-4 p-4 rounded-xl bg-bg-secondary border border-border">
                            <Input
                                label="Nome do Condomínio"
                                placeholder="Ex: Vida Nova Residencial"
                                value={formData.tenantName}
                                onChange={(e) => setFormData({ ...formData, tenantName: e.target.value })}
                                autoFocus
                            />
                        </div>

                        {error && (
                            <div className="text-[10px] uppercase tracking-wider font-bold text-error bg-error/5 border border-error/20 rounded-md px-3 py-2 text-center mt-2">
                                {error}
                            </div>
                        )}

                        <div className="flex gap-3 justify-end mt-4">
                            <Button type="button" variant="ghost" onClick={onClose}>
                                Cancelar
                            </Button>
                            <Button type="submit" isLoading={isLoading} className="font-bold tracking-tight px-6">
                                Gerar PIN do Síndico
                            </Button>
                        </div>
                    </form>
                </>
            ) : (
                <div className="text-center py-6">
                    <div className="w-16 h-16 rounded-full bg-success/15 border border-success/30 flex items-center justify-center mx-auto mb-6">
                        <Building2 size={28} className="text-success" />
                    </div>
                    <h2 className="text-2xl font-bold text-text-primary tracking-tight font-display mb-2">Condomínio Criado!</h2>
                    <p className="text-sm text-text-secondary font-sans leading-relaxed mb-8 max-w-sm mx-auto">
                        Envie este Código Mestre para o Síndico. Ele deverá inseri-lo na tela "Vincular Condomínio" após criar a própria conta.
                    </p>
                    
                    <div className="bg-bg-elevated border border-border rounded-xl p-6 mb-8">
                        <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-3">PIN DE ACESSO (SÍNDICO)</p>
                        <div className="text-3xl font-mono tracking-widest font-bold text-accent select-all">
                            {masterCode}
                        </div>
                        <p className="text-xs text-text-tertiary mt-3">Uso único (Max Uses: 1)</p>
                    </div>

                    <div className="flex flex-col gap-3">
                        <Button onClick={copyToClipboard} className="w-full">
                            COPIAR CÓDIGO
                        </Button>
                        <Button variant="ghost" onClick={() => { onClose(); setStep('form'); setMasterCode(''); }} className="w-full text-xs">
                            FECHAR
                        </Button>
                    </div>
                </div>
            )}
        </Modal>
    );
}
