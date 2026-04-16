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
        plan: 'pro',
        adminName: '',
        adminEmail: '',
        adminPhone: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (
            !formData.tenantName.trim() ||
            !formData.adminName.trim() ||
            !formData.adminEmail.trim() ||
            !formData.adminPhone.trim()
        ) {
            setError('Preencha todos os campos obrigatórios.');
            return;
        }

        if (formData.tenantName.trim().length > 120) {
            setError('Nome do condomínio muito longo (máx. 120 caracteres).');
            return;
        }

        if (formData.adminName.trim().length > 120) {
            setError('Nome do síndico muito longo (máx. 120 caracteres).');
            return;
        }

        if (formData.adminEmail.trim().length > 254 ||
            !/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(formData.adminEmail.trim())) {
            setError('E-mail inválido.');
            return;
        }

        if (formData.adminPhone.replace(/\D/g, '').length < 10) {
            setError('Telefone inválido.');
            return;
        }

        setIsLoading(true);
        try {
            // Chamar a RPC segura que gera apenas o Condomínio e o PIN, deixando a criação da conta/senha para o próprio Síndico.
            // Obs: Ignoramos adminName/Email no back-end para não ocupar o e-mail no Supabase Auth e não dar erro quando ele for se cadastrar.
            const { data, error: rpcError } = await supabase.rpc('superadmin_create_tenant_with_invite', {
                p_tenant_name: formData.tenantName.trim(),
                p_plan: formData.plan
            });

            if (rpcError) throw rpcError;
            if (data?.error) throw new Error(data.error);
            if (!data?.master_code) throw new Error('Não foi possível gerar o código_mestre do condomínio.');

            setMasterCode(data.master_code);
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
                            <h3 className="text-xs uppercase tracking-widest font-bold text-text-tertiary">Dados do Condomínio</h3>
                            <Input
                                label="Nome do Condomínio"
                                placeholder="Ex: Vida Nova Residencial"
                                value={formData.tenantName}
                                onChange={(e) => setFormData({ ...formData, tenantName: e.target.value })}
                                autoFocus
                            />
                        </div>

                        <div className="space-y-4 p-4 rounded-xl bg-bg-secondary border border-border">
                            <h3 className="text-xs uppercase tracking-widest font-bold text-text-tertiary">Acesso do Síndico</h3>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Input
                                    label="Nome Completo"
                                    placeholder="Nome do Síndico"
                                    value={formData.adminName}
                                    onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                                />
                                <Input
                                    label="Telefone"
                                    placeholder="(11) 99999-9999"
                                    value={formData.adminPhone}
                                    onChange={(e) => setFormData({ ...formData, adminPhone: e.target.value })}
                                />
                            </div>

                            <Input
                                label="E-mail Administrativo"
                                placeholder="sindico@condominio.com"
                                type="email"
                                value={formData.adminEmail}
                                onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
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
                        O condomínio e o usuário do síndico foram criados. Se quiser permitir que outra pessoa seja administradora, ou caso ele esqueça a senha, envie o PIN extra abaixo.
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
