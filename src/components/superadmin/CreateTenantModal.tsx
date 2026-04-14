import { useState } from 'react';
import { Modal, Input, Button } from '../ui';
import { supabase } from '../../services/supabase';
import { Building2, ChevronDown } from 'lucide-react';

interface CreateTenantModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function CreateTenantModal({ isOpen, onClose, onSuccess }: CreateTenantModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        tenantName: '',
        plan: 'premium',
        adminName: '',
        adminEmail: '',
        adminPhone: '',
        adminPassword: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (
            !formData.tenantName.trim() ||
            !formData.adminName.trim() ||
            !formData.adminEmail.trim() ||
            !formData.adminPhone.trim() ||
            !formData.adminPassword.trim()
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

        if (formData.adminPassword.length < 8) {
            setError('A senha deve ter pelo menos 8 caracteres.');
            return;
        }

        if (!/[a-zA-Z]/.test(formData.adminPassword) || !/[0-9]/.test(formData.adminPassword)) {
            setError('A senha deve conter letras e números.');
            return;
        }

        setIsLoading(true);
        try {
            const { data, error: rpcError } = await supabase.rpc('superadmin_create_tenant_and_admin', {
                p_tenant_name: formData.tenantName,
                p_plan: formData.plan,
                p_admin_name: formData.adminName,
                p_admin_email: formData.adminEmail,
                p_admin_password: formData.adminPassword
            });

            if (rpcError) throw rpcError;
            if (data?.error) throw new Error(data.error);

            onSuccess();
            onClose();
        } catch (err: unknown) {
            if (import.meta.env.DEV) console.error('Erro ao criar tenant:', err);
            setError(err instanceof Error ? err.message : 'Erro inesperado ao criar o condomínio.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="md">
            <div className="text-center mb-6 pt-2">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mx-auto text-accent mb-4">
                    <Building2 size={24} />
                </div>
                <h2 className="text-xl font-bold text-text-primary tracking-tight font-display mb-1">Novo Condomínio</h2>
                <p className="text-sm text-text-secondary font-sans leading-relaxed">
                    Crie um ambiente isolado (Tenant) e a respectiva conta de acesso do Síndico.
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

                    <Input
                        label="Senha Provisória"
                        placeholder="Mínimo 8 caracteres (letras e números)"
                        type="password"
                        value={formData.adminPassword}
                        onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
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
                        Criar Condomínio
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
