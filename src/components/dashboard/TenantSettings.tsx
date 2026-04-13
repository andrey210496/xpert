import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { motion } from 'framer-motion';
import { Card, Button, Badge } from '../ui';
import { FileText, Save, Info, CheckCircle2 } from 'lucide-react';
import { KnowledgeUpload } from '../admin/KnowledgeUpload';

export function TenantSettings() {
    const { tenant, refreshAuthData } = useAuth();
    const [context, setContext] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        if (tenant?.tenant_context) {
            setContext(tenant.tenant_context);
        }
    }, [tenant]);

    const handleSave = async () => {
        if (!tenant) return;
        setIsSaving(true);
        setMessage(null);

        const { error } = await supabase
            .from('tenants')
            .update({ tenant_context: context })
            .eq('id', tenant.id);

        if (error) {
            setMessage({ type: 'error', text: 'Erro ao salvar configurações: ' + error.message });
        } else {
            await refreshAuthData();
            setMessage({ type: 'success', text: 'Configurações salvas! A IA já está ciente das novas regras.' });
        }
        setIsSaving(false);
        setTimeout(() => setMessage(null), 5000);
    };

    return (
        <div className="space-y-8 animate-fade-in max-w-4xl">
            <div>
                <h2 className="text-2xl font-bold font-display text-text-primary mb-1">Configurações do Condomínio</h2>
                <p className="text-sm text-text-secondary">Personalize o comportamento da IA e as regras do seu condomínio.</p>
            </div>

            <Card className="p-8 bg-bg-secondary border-border border">
                <div className="flex items-start gap-4 mb-8 p-4 bg-accent/5 rounded-xl border border-accent/10">
                    <Info className="text-accent shrink-0" size={20} />
                    <div className="text-xs text-text-secondary leading-relaxed">
                        <span className="font-bold text-text-primary block mb-1">Cérebro da IA (Contexto Personalizado)</span>
                        O texto abaixo será injetado no prompt do sistema de todos os agentes (Síndico, Morador, Zelador, Prestador).
                        Use este espaço para colar o **Regimento Interno**, horários de silêncio, regras de mudanças ou qualquer informação específica do seu condomínio.
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-text-tertiary uppercase tracking-widest font-mono">
                                Regramento e Contexto Local
                            </label>
                            <span className="text-[10px] text-text-tertiary font-mono">
                                {context.length} caracteres
                            </span>
                        </div>
                        <textarea
                            value={context}
                            onChange={(e) => setContext(e.target.value)}
                            placeholder="Ex: Horário de silêncio: 22h às 08h. Mudanças apenas em dias úteis. Salão de festas reserva via App..."
                            className="w-full h-64 bg-bg-primary border border-border rounded-xl p-4 text-sm text-text-primary outline-none focus:border-accent transition-all resize-none font-sans leading-relaxed"
                        />
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-border">
                        <div className="flex items-center gap-2">
                            {message && (
                                <motion.div
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className={`flex items-center gap-2 text-xs font-bold ${message.type === 'success' ? 'text-success' : 'text-error'}`}
                                >
                                    {message.type === 'success' && <CheckCircle2 size={14} />}
                                    {message.text}
                                </motion.div>
                            )}
                        </div>
                        <Button
                            onClick={handleSave}
                            isLoading={isSaving}
                            className="min-w-[160px]"
                        >
                            <Save size={16} className="mr-2" /> Salvar Regras
                        </Button>
                    </div>
                </div>
            </Card>

            <div className="space-y-4">
                <div>
                    <h3 className="text-sm font-bold text-text-tertiary uppercase tracking-widest font-mono">Base de Conhecimento (Documentos)</h3>
                    <p className="text-xs text-text-tertiary mt-1">Gerencie documentos PDF para consulta automática da inteligência artificial.</p>
                </div>
                <KnowledgeUpload tenantId={tenant?.id || ''} />
            </div>

            {/* Informações Gerais do Condomínio (Read-only por enquanto) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-6">
                    <h3 className="text-xs font-bold text-text-tertiary uppercase tracking-widest font-mono mb-4">Dados Técnicos</h3>
                    <div className="space-y-4">
                        <div className="flex justify-between border-b border-border/50 pb-2">
                            <span className="text-xs text-text-tertiary">Nome</span>
                            <span className="text-xs font-bold text-text-primary">{tenant?.name}</span>
                        </div>
                        <div className="flex justify-between border-b border-border/50 pb-2">
                            <span className="text-xs text-text-tertiary">Slug (URL)</span>
                            <span className="text-xs font-mono text-accent">{tenant?.slug}</span>
                        </div>
                        <div className="flex justify-between border-b border-border/50 pb-2">
                            <span className="text-xs text-text-tertiary">Plano Atual</span>
                            <Badge variant="sindico">{tenant?.plan.toUpperCase()}</Badge>
                        </div>
                    </div>
                </Card>

                <Card className="p-6 bg-bg-tertiary/20 flex flex-col items-center justify-center text-center">
                    <FileText size={40} className="text-text-tertiary mb-3 opacity-20" />
                    <h4 className="text-sm font-bold text-text-secondary mb-1">Exportar Dados</h4>
                    <p className="text-[10px] text-text-tertiary max-w-[200px]">Em breve: Baixe relatórios de consumo e histórico de conversas em PDF.</p>
                </Card>
            </div>
        </div>
    );
}
