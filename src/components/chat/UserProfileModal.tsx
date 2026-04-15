import { Modal } from '../ui';
import { Mail, Phone, User, Key } from 'lucide-react';

interface UserProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    profile: any;
}

export function UserProfileModal({ isOpen, onClose, profile }: UserProfileModalProps) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Meu Perfil">
            <div className="space-y-6">
                
                {/* Minimalist Profile Header */}
                <div className="flex flex-col items-center justify-center pt-2 pb-6 border-b border-border/50">
                    <div className="w-16 h-16 rounded-sm bg-accent/10 border border-accent/20 flex items-center justify-center text-accent mb-4">
                        <User size={32} />
                    </div>
                    <h3 className="text-xl font-display font-medium text-text-primary tracking-tight">{profile.full_name}</h3>
                    <div className="mt-2 inline-flex items-center px-2 py-0.5 border border-border text-[10px] font-mono tracking-widest text-text-tertiary uppercase rounded-sm">
                        PERFIL: {profile.profile_type}
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="p-4 surface-card-sm flex items-start gap-3 group hover:border-accent/40 transition-colors">
                        <Mail className="text-text-tertiary mt-0.5 group-hover:text-accent transition-colors" size={16} />
                        <div>
                            <p className="text-[10px] font-mono uppercase tracking-widest text-text-tertiary mb-1">E-mail de Acesso</p>
                            <p className="text-sm text-text-secondary">{profile.email || 'Email associado à conta'}</p>
                        </div>
                    </div>

                    <div className="p-4 surface-card-sm flex items-start gap-3 group hover:border-accent/40 transition-colors">
                        <Phone className="text-text-tertiary mt-0.5 group-hover:text-accent transition-colors" size={16} />
                        <div>
                            <p className="text-[10px] font-mono uppercase tracking-widest text-text-tertiary mb-1">Telefone / Contato</p>
                            <p className="text-sm text-text-secondary">{profile.phone || 'Não informado'}</p>
                        </div>
                    </div>

                    <div className="p-4 surface-card-sm flex flex-col items-start gap-3">
                        <div className="flex items-center gap-2">
                             <Key className="text-text-tertiary" size={16} />
                             <p className="text-[10px] font-mono uppercase tracking-widest text-text-tertiary">Privacidade & Segurança</p>
                        </div>
                        <p className="text-xs text-text-secondary leading-relaxed">
                            Suas informações estão protegidas por criptografia de ponta a ponta e disponíveis apenas para a administração principal do seu respectivo condomínio.
                        </p>
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
