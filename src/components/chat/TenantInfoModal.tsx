import { Modal } from '../ui';
import { Building2, Info, ShieldCheck } from 'lucide-react';

interface TenantInfoModalProps {
    isOpen: boolean;
    onClose: () => void;
    tenant: any; // Using any for brevity since type is extracted generically, but assuming object with name/status
}

export function TenantInfoModal({ isOpen, onClose, tenant }: TenantInfoModalProps) {
    if (!tenant) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Meu Condomínio">
            <div className="space-y-6">
                
                {/* Minimalist Tenant Header */}
                <div className="flex flex-col items-center justify-center pt-2 pb-6 border-b border-border/50">
                    <div className="w-16 h-16 rounded-sm bg-accent/10 border border-accent/20 flex items-center justify-center text-accent mb-4">
                        <Building2 size={32} />
                    </div>
                    <h3 className="text-xl font-display font-medium text-text-primary tracking-tight text-center px-4">{tenant.name || 'Condomínio Desconhecido'}</h3>
                    <div className="mt-2 flex items-center gap-2">
                        {tenant.status === 'active' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-success/30 bg-success/10 text-[10px] font-mono tracking-widest text-success uppercase rounded-sm">
                                <div className="w-1.5 h-1.5 rounded-full bg-success"></div> LICENÇA ATIVA
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-warning/30 bg-warning/10 text-[10px] font-mono tracking-widest text-warning uppercase rounded-sm">
                                <div className="w-1.5 h-1.5 rounded-full bg-warning"></div> INATIVO / EM ANÁLISE
                            </span>
                        )}
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="p-4 surface-card-sm flex items-start gap-3 group hover:border-accent/40 transition-colors">
                        <ShieldCheck className="text-text-tertiary mt-0.5 group-hover:text-accent transition-colors" size={16} />
                        <div>
                            <p className="text-[10px] font-mono uppercase tracking-widest text-text-tertiary mb-1">Status de Conexão</p>
                            <p className="text-sm text-text-secondary">Conectado de forma segura ao banco de dados privativo da sua administração.</p>
                        </div>
                    </div>

                    <div className="p-4 surface-card-sm bg-sharp-contrast border border-border/50">
                        <div className="flex gap-3">
                            <Info className="text-accent shrink-0 mt-0.5" size={16} />
                            <p className="text-xs text-text-secondary leading-relaxed">
                                Este assistente inteligente possui acesso direto às documentações, regras oficiais e histórico de comunicados validados exclusivamente pela administração deste condomínio.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="pt-4 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-bg-hover text-text-primary hover:bg-bg-tertiary border border-border text-xs font-bold tracking-tight rounded-sm transition-all"
                    >
                        FECHAR
                    </button>
                </div>
            </div>
        </Modal>
    );
}
