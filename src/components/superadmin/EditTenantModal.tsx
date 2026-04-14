import { useState, useEffect } from 'react';
import { Modal, Button } from '../ui';
import { supabase } from '../../services/supabase';
import { Building2, ChevronDown, Zap, PlusCircle, Trash2, AlertTriangle, Check } from 'lucide-react';

interface TenantData {
    id: string;
    name: string;
    plan: string;
    status: string;
    plan_tokens_total: number;
    token_balance: number;
    tenant_context?: string;
    slug?: string;
}

interface EditTenantModalProps {
    isOpen: boolean;
    onClose: () => void;
    tenant: TenantData | null;
    onSuccess: () => void;
}

const PLAN_OPTIONS = [
    { value: 'premium', label: 'Premium', tokens: 1_000_000 },
];

const TOKEN_TOP_UPS = [
    { label: '+50k',   value: 50_000 },
    { label: '+200k',  value: 200_000 },
    { label: '+500k',  value: 500_000 },
    { label: '+1M',    value: 1_000_000 },
];

export function EditTenantModal({ isOpen, onClose, tenant, onSuccess }: EditTenantModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // localBalance: atualiza otimisticamente sem esperar prop do pai
    const [localBalance, setLocalBalance] = useState(0);
    // manualBalanceInput: valor digitado no campo "Definir saldo"
    const [manualBalanceInput, setManualBalanceInput] = useState('');

    const [form, setForm] = useState({
        name: '',
        plan: 'premium',
        status: 'active',
        tenant_context: '',
    });

    // Só reseta form/estados quando abre um tenant DIFERENTE (pelo id)
    useEffect(() => {
        if (tenant) {
            setForm({
                name: tenant.name || '',
                plan: tenant.plan || 'premium',
                status: tenant.status || 'active',
                tenant_context: tenant.tenant_context || '',
            });
            setLocalBalance(tenant.token_balance || 0);
            setManualBalanceInput(String(tenant.token_balance || 0));
            setError('');
            setSuccessMsg('');
            setShowDeleteConfirm(false);
        }
    }, [tenant?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!tenant) return null;

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');

        if (!form.name.trim()) {
            setError('O nome do condomínio é obrigatório.');
            return;
        }
        if (form.name.trim().length > 120) {
            setError('Nome muito longo (máx. 120 caracteres).');
            return;
        }

        const selectedPlan = PLAN_OPTIONS.find(p => p.value === form.plan);
        const newPlanTokens = selectedPlan?.tokens ?? tenant.plan_tokens_total;

        setIsLoading(true);
        try {
            const { error: dbError } = await supabase
                .from('tenants')
                .update({
                    name: form.name.trim(),
                    plan: form.plan,
                    plan_tokens_total: newPlanTokens,
                    status: form.status,
                    tenant_context: form.tenant_context.trim() || null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', tenant.id);

            if (dbError) throw dbError;

            setSuccessMsg('Condomínio atualizado com sucesso!');
            onSuccess();
            setTimeout(onClose, 1200);
        } catch (err: unknown) {
            if (import.meta.env.DEV) console.error('Erro ao editar tenant:', err);
            setError(err instanceof Error ? err.message : 'Erro ao salvar. Tente novamente.');
        } finally {
            setIsLoading(false);
        }
    };

    const applyBalanceChange = async (newBalance: number, label: string) => {
        const previousBalance = localBalance;
        setError('');
        setSuccessMsg('');
        setLocalBalance(newBalance); // atualização instantânea
        setManualBalanceInput(String(newBalance));
        setIsLoading(true);
        try {
            const { error: dbError } = await supabase
                .from('tenants')
                .update({
                    token_balance: newBalance,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', tenant.id);

            if (dbError) throw dbError;

            setSuccessMsg(label);
            onSuccess();
        } catch (err: unknown) {
            if (import.meta.env.DEV) console.error('Erro ao atualizar saldo:', err);
            setLocalBalance(previousBalance); // rollback
            setManualBalanceInput(String(previousBalance));
            setError('Erro ao atualizar saldo. Tente novamente.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleTopUp = (amount: number) => {
        const newBalance = localBalance + amount;
        const label = TOKEN_TOP_UPS.find(t => t.value === amount)?.label ?? `+${amount}`;
        applyBalanceChange(newBalance, `${label} tokens adicionados!`);
    };

    const handleSetBalance = () => {
        const parsed = parseInt(manualBalanceInput.replace(/\D/g, ''), 10);
        if (isNaN(parsed) || parsed < 0) {
            setError('Valor inválido para o saldo.');
            return;
        }
        applyBalanceChange(parsed, `Saldo definido para ${parsed.toLocaleString('pt-BR')} tokens.`);
    };

    const handleDelete = async () => {
        setIsLoading(true);
        setError('');
        try {
            const { error: dbError } = await supabase
                .from('tenants')
                .delete()
                .eq('id', tenant.id);

            if (dbError) throw dbError;

            onSuccess();
            onClose();
        } catch (err: unknown) {
            if (import.meta.env.DEV) console.error('Erro ao excluir tenant:', err);
            setError('Erro ao excluir condomínio. Tente novamente.');
            setShowDeleteConfirm(false);
        } finally {
            setIsLoading(false);
        }
    };

    const tokenUsed = (tenant.plan_tokens_total || 0) - localBalance;
    const tokenPct = (tenant.plan_tokens_total || 0) > 0
        ? Math.min(100, Math.round((localBalance / tenant.plan_tokens_total) * 100))
        : 0;

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="lg">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent shrink-0">
                    <Building2 size={20} />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-text-primary tracking-tight font-display">
                        Gerenciar Condomínio
                    </h2>
                    <p className="text-xs text-text-tertiary font-mono">{tenant.slug || tenant.id}</p>
                </div>
            </div>

            {/* Token status bar */}
            <div className="mb-6 p-4 rounded-xl bg-bg-secondary border border-border space-y-2">
                <div className="flex items-center justify-between text-xs">
                    <span className="text-text-tertiary uppercase tracking-widest font-bold flex items-center gap-1.5">
                        <Zap size={12} /> Saldo de Tokens
                    </span>
                    <span className="font-mono text-text-primary font-bold">
                        {localBalance.toLocaleString('pt-BR')} restantes
                    </span>
                </div>
                <div className="w-full h-2 bg-bg-tertiary rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all ${tokenPct <= 5 ? 'bg-error' : tokenPct <= 20 ? 'bg-warning' : 'bg-accent'}`}
                        style={{ width: `${tokenPct}%` }}
                    />
                </div>
                <div className="flex justify-between text-[10px] text-text-tertiary font-mono">
                    <span>{tokenUsed.toLocaleString('pt-BR')} usados</span>
                    <span>{(tenant.plan_tokens_total || 0).toLocaleString('pt-BR')} total do plano</span>
                </div>

                {/* Quick top-up */}
                <div className="pt-2 space-y-3">
                    <div>
                        <p className="text-[10px] uppercase tracking-widest font-bold text-text-tertiary mb-2">
                            Adicionar ao saldo
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {TOKEN_TOP_UPS.map((t) => (
                                <button
                                    key={t.value}
                                    onClick={() => handleTopUp(t.value)}
                                    disabled={isLoading}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent/10 text-accent border border-accent/20 text-xs font-bold hover:bg-accent/20 transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                    <PlusCircle size={12} />
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Manual balance control */}
                    <div>
                        <p className="text-[10px] uppercase tracking-widest font-bold text-text-tertiary mb-2">
                            Definir saldo exato
                        </p>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                inputMode="numeric"
                                value={manualBalanceInput}
                                onChange={(e) => setManualBalanceInput(e.target.value.replace(/\D/g, ''))}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSetBalance(); } }}
                                disabled={isLoading}
                                className="flex-1 h-9 px-3 bg-bg-primary border border-border rounded-lg text-text-primary text-sm font-mono outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all disabled:opacity-50"
                                placeholder="Ex: 500000"
                            />
                            <button
                                type="button"
                                onClick={handleSetBalance}
                                disabled={isLoading}
                                className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-accent text-white text-xs font-bold hover:bg-accent/90 transition-colors disabled:opacity-50 cursor-pointer shrink-0"
                            >
                                <Check size={13} />
                                Aplicar
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {error && (
                <div className="mb-4 text-[10px] uppercase tracking-wider font-bold text-error bg-error/5 border border-error/20 rounded-md px-3 py-2 text-center">
                    {error}
                </div>
            )}
            {successMsg && (
                <div className="mb-4 text-[10px] uppercase tracking-wider font-bold text-success bg-success/5 border border-success/20 rounded-md px-3 py-2 text-center">
                    {successMsg}
                </div>
            )}

            <form onSubmit={handleSave} className="space-y-5">
                {/* Nome */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase tracking-widest text-text-secondary font-bold">
                        Nome do Condomínio
                    </label>
                    <input
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value.slice(0, 120) })}
                        className="h-10 w-full px-3 bg-bg-secondary border border-border rounded-md text-text-primary text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all"
                        placeholder="Nome do condomínio"
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                    {/* Status */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] uppercase tracking-widest text-text-secondary font-bold">
                            Status
                        </label>
                        <div className="relative">
                            <select
                                value={form.status}
                                onChange={(e) => setForm({ ...form, status: e.target.value })}
                                className="w-full h-10 bg-bg-secondary border border-border rounded-md pl-3 pr-8 text-sm text-text-primary focus:outline-none focus:border-accent/50 appearance-none transition-all"
                            >
                                <option value="active">Ativo</option>
                                <option value="trial">Trial</option>
                                <option value="suspended">Suspenso</option>
                            </select>
                            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" size={14} />
                        </div>
                    </div>
                </div>


                <div className="flex flex-wrap gap-4 items-center justify-between pt-6 mt-4 border-t border-border/50">
                    <div className="flex-1 min-w-[200px]">
                        {!showDeleteConfirm ? (
                            <button
                                type="button"
                                onClick={() => setShowDeleteConfirm(true)}
                                disabled={isLoading}
                                className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-error/60 hover:text-error transition-colors cursor-pointer disabled:opacity-50"
                            >
                                <Trash2 size={13} />
                                Excluir condomínio
                            </button>
                        ) : (
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-bold text-error uppercase tracking-widest">Confirmar?</span>
                                <div className="flex gap-1.5">
                                    <button
                                        type="button"
                                        onClick={handleDelete}
                                        disabled={isLoading}
                                        className="h-7 px-3 bg-error text-white text-[10px] font-bold rounded-md hover:bg-error-strong transition-colors"
                                    >
                                        SIM, EXCLUIR
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowDeleteConfirm(false)}
                                        disabled={isLoading}
                                        className="h-7 px-3 bg-bg-hover text-text-secondary text-[10px] font-bold rounded-md transition-colors"
                                    >
                                        NÃO
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3 justify-end flex-shrink-0">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
                            Cancelar
                        </Button>
                        <Button type="submit" isLoading={isLoading}>
                            Salvar Alterações
                        </Button>
                    </div>
                </div>
            </form>
        </Modal>
    );
}
