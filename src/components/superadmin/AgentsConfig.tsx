import { useState, useEffect } from 'react';
import { Button, Badge } from '../ui';
import { Bot, Save, Check, AlertCircle, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { motion } from 'framer-motion';
import { KnowledgeUpload } from '../admin/KnowledgeUpload';

import { fetchAgentConfigs, updateAgentConfig } from '../../services/agentConfigService';
import type { AgentDbConfig } from '../../types';

const AGENT_META: Record<string, { color: string; icon: string; badge: string }> = {
    admin: { color: '#3B82F6', icon: '🏢', badge: 'sindico' },
    morador: { color: '#10B981', icon: '🏠', badge: 'morador' },
    zelador: { color: '#F59E0B', icon: '🔧', badge: 'zelador' },
    prestador: { color: '#8B5CF6', icon: '🛠️', badge: 'prestador' },
};

const AGENT_ORDER = ['admin', 'morador', 'zelador', 'prestador'];

interface AgentCardState {
    system_prompt: string;
    knowledge_base: string;
    is_active: boolean;
    isSaving: boolean;
    isSaved: boolean;
    error: string;
}

export function AgentsConfig() {
    const [configs, setConfigs] = useState<AgentDbConfig[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
    const [activeSubTab, setActiveSubTab] = useState<'behavior' | 'knowledge'>('behavior');
    const [editState, setEditState] = useState<Record<string, AgentCardState>>({});

    useEffect(() => {
        loadConfigs();
    }, []);

    const loadConfigs = async () => {
        setIsLoading(true);
        const data = await fetchAgentConfigs();
        setConfigs(data);

        const state: Record<string, AgentCardState> = {};
        for (const c of data) {
            state[c.agent_type] = {
                system_prompt: c.system_prompt,
                knowledge_base: c.knowledge_base,
                is_active: c.is_active,
                isSaving: false,
                isSaved: false,
                error: '',
            };
        }
        setEditState(state);
        setIsLoading(false);
    };

    const handleSave = async (agentType: string) => {
        const current = editState[agentType];
        if (!current) return;

        setEditState((prev) => ({
            ...prev,
            [agentType]: { ...current, isSaving: true, error: '', isSaved: false },
        }));

        const result = await updateAgentConfig(agentType, {
            system_prompt: current.system_prompt,
            knowledge_base: current.knowledge_base,
            is_active: current.is_active,
        });

        setEditState((prev) => ({
            ...prev,
            [agentType]: {
                ...current,
                isSaving: false,
                isSaved: result.success,
                error: result.error || '',
            },
        }));

        if (result.success) {
            setTimeout(() => {
                setEditState((prev) => ({
                    ...prev,
                    [agentType]: { ...prev[agentType], isSaved: false },
                }));
            }, 3000);
        }
    };

    const updateField = (agentType: string, field: keyof AgentCardState, value: string | boolean) => {
        setEditState((prev) => ({
            ...prev,
            [agentType]: { ...prev[agentType], [field]: value, isSaved: false },
        }));
    };

    const hasChanges = (agentType: string) => {
        const original = configs.find((c) => c.agent_type === agentType);
        const current = editState[agentType];
        if (!original || !current) return false;
        return (
            original.system_prompt !== current.system_prompt ||
            original.knowledge_base !== current.knowledge_base ||
            original.is_active !== current.is_active
        );
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-3">
                    <svg className="animate-spin h-6 w-6 text-accent" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-sm text-text-tertiary">Carregando configurações...</span>
                </div>
            </div>
        );
    }

    if (configs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <AlertCircle size={32} className="text-text-tertiary" />
                <p className="text-text-secondary text-sm text-center max-w-md">
                    Nenhuma configuração de agente encontrada. Execute a migration SQL <code>agent_configs.sql</code> no Supabase para criar os agentes padrão.
                </p>
            </div>
        );
    }

    const sortedConfigs = [...configs].sort(
        (a, b) => AGENT_ORDER.indexOf(a.agent_type) - AGENT_ORDER.indexOf(b.agent_type)
    );

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-bold text-text-primary tracking-tight font-display flex items-center gap-2">
                        <Bot size={22} className="text-accent" />
                        Agentes de IA
                    </h2>
                    <p className="text-sm text-text-secondary mt-1">
                        Configure o comportamento e a base de conhecimento de cada agente.
                    </p>
                </div>
            </div>

            {/* Agent Cards */}
            <div className="flex flex-col gap-4">
                {sortedConfigs.map((config) => {
                    const meta = AGENT_META[config.agent_type] || AGENT_META.admin;
                    const state = editState[config.agent_type];
                    const isExpanded = expandedAgent === config.agent_type;
                    if (!state) return null;

                    return (
                        <div
                            key={config.agent_type}
                            className="rounded-xl border border-border bg-bg-secondary overflow-hidden transition-all"
                        >
                            {/* Card Header */}
                            <button
                                onClick={() => setExpandedAgent(isExpanded ? null : config.agent_type)}
                                className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-bg-tertiary/50 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                                        style={{ backgroundColor: `${meta.color}15` }}
                                    >
                                        {meta.icon}
                                    </div>
                                    <div className="text-left">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-text-primary">
                                                {config.display_name}
                                            </span>
                                            <Badge variant={meta.badge as any}>
                                                {config.agent_type}
                                            </Badge>
                                            {!state.is_active && (
                                                <Badge variant="neutral">Desativado</Badge>
                                            )}
                                        </div>
                                        <span className="text-xs text-text-tertiary">
                                            Atualizado: {new Date(config.updated_at).toLocaleDateString('pt-BR')}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {hasChanges(config.agent_type) && (
                                        <span className="w-2 h-2 rounded-full bg-warning" />
                                    )}
                                    {state.isSaved && (
                                        <Check size={16} className="text-success" />
                                    )}
                                    {isExpanded ? (
                                        <ChevronUp size={18} className="text-text-tertiary" />
                                    ) : (
                                        <ChevronDown size={18} className="text-text-tertiary" />
                                    )}
                                </div>
                            </button>

                            {/* Expanded Content */}
                            {isExpanded && (
                                <div className="border-t border-border flex flex-col bg-bg-secondary">
                                    {/* Sub-Tabs Navigation */}
                                    <div className="flex border-b border-border bg-bg-tertiary/30 px-5 pt-4 gap-6">
                                        <button
                                            onClick={() => setActiveSubTab('behavior')}
                                            className={`pb-3 text-xs font-bold uppercase tracking-widest transition-all relative ${
                                                activeSubTab === 'behavior' ? 'text-accent' : 'text-text-tertiary hover:text-text-secondary'
                                            }`}
                                        >
                                            🧠 Personalidade
                                            {activeSubTab === 'behavior' && (
                                                <motion.div layoutId="activeSubTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
                                            )}
                                        </button>
                                        <button
                                            onClick={() => setActiveSubTab('knowledge')}
                                            className={`pb-3 text-xs font-bold uppercase tracking-widest transition-all relative ${
                                                activeSubTab === 'knowledge' ? 'text-accent' : 'text-text-tertiary hover:text-text-secondary'
                                            }`}
                                        >
                                            📚 Conhecimento
                                            {activeSubTab === 'knowledge' && (
                                                <motion.div layoutId="activeSubTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
                                            )}
                                        </button>
                                    </div>

                                    <div className="p-5 space-y-5">
                                        {activeSubTab === 'behavior' ? (
                                            <>
                                                {/* Active Toggle */}
                                                <div className="flex items-center justify-between p-3 rounded-xl bg-bg-tertiary/20 border border-border/50">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-bold text-text-primary uppercase tracking-tight">Status do Agente</span>
                                                        <span className="text-[10px] text-text-tertiary">Ativa ou desativa este papel no sistema</span>
                                                    </div>
                                                    <button
                                                        onClick={() => updateField(config.agent_type, 'is_active', !state.is_active)}
                                                        className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${state.is_active ? 'bg-success' : 'bg-bg-tertiary'
                                                            }`}
                                                    >
                                                        <span
                                                            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${state.is_active ? 'translate-x-5' : 'translate-x-0'
                                                                }`}
                                                        />
                                                    </button>
                                                </div>

                                                {/* System Prompt */}
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-xs font-bold uppercase tracking-widest text-text-tertiary">
                                                            System Prompt (Instruções Principais)
                                                        </label>
                                                        <span className="text-[10px] text-text-tertiary font-mono">
                                                            {state.system_prompt.length.toLocaleString()} chars
                                                        </span>
                                                    </div>
                                                    <textarea
                                                        value={state.system_prompt}
                                                        onChange={(e) => updateField(config.agent_type, 'system_prompt', e.target.value)}
                                                        rows={10}
                                                        className="w-full bg-bg-primary border border-border rounded-lg px-4 py-3 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 resize-y font-mono leading-relaxed transition-all"
                                                        placeholder="Defina as instruções de personalidade do agente..."
                                                    />
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                {/* Knowledge Base (PDF) */}
                                                <div className="space-y-4">
                                                    <div className="bg-bg-tertiary/20 rounded-xl border border-border p-1">
                                                        <KnowledgeUpload tenantId={`agent:${config.agent_type}`} />
                                                    </div>
                                                </div>

                                                {/* Knowledge Base (Texto) */}
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-xs font-bold uppercase tracking-widest text-text-tertiary">
                                                            Documentos de Texto (REGRAS RÁPIDAS)
                                                        </label>
                                                        <span className="text-[10px] text-text-tertiary font-mono">
                                                            {state.knowledge_base.length.toLocaleString()} chars
                                                        </span>
                                                    </div>
                                                    <textarea
                                                        value={state.knowledge_base}
                                                        onChange={(e) => updateField(config.agent_type, 'knowledge_base', e.target.value)}
                                                        rows={8}
                                                        className="w-full bg-bg-primary border border-border rounded-lg px-4 py-3 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 resize-y font-mono leading-relaxed transition-all"
                                                        placeholder="Cole aqui regras gerais, SLAs ou FAQs que o agente deve sempre consultar..."
                                                    />
                                                    <div className="flex items-start gap-2 p-2 bg-accent/5 rounded-md border border-accent/10">
                                                        <Info size={12} className="text-accent mt-0.5" />
                                                        <p className="text-[10px] text-text-secondary leading-relaxed font-sans">
                                                            💡 Esse conteúdo servirá como backup se a IA não encontrar informações nos arquivos PDF.
                                                        </p>
                                                    </div>
                                                </div>
                                            </>
                                        )}

                                        {/* Error */}
                                        {state.error && (
                                            <div className="text-[10px] uppercase tracking-wider font-bold text-error bg-error/5 border border-error/20 rounded-md px-3 py-2">
                                                {state.error}
                                            </div>
                                        )}

                                        {/* Save Button */}
                                        <div className="flex justify-end pt-2">
                                            <Button
                                                onClick={() => handleSave(config.agent_type)}
                                                isLoading={state.isSaving}
                                                disabled={!hasChanges(config.agent_type) && !state.isSaving}
                                                className="font-bold tracking-tight"
                                            >
                                                {state.isSaved ? (
                                                    <>
                                                        <Check size={16} /> Salvo!
                                                    </>
                                                ) : (
                                                    <>
                                                        <Save size={16} /> Salvar Configuração
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>
                    );
                })}
            </div>
        </div>
    );
}
