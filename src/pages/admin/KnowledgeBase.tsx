import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Trash2, AlertCircle, CheckCircle2, Loader2, FileUp } from 'lucide-react';
import { useKnowledgeBase } from '../../hooks/useKnowledgeBase';
import type { AgentType, KnowledgeDocument } from '../../types/knowledge';
import { Button, Card } from '../../components/ui';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const AGENTS: { id: AgentType; label: string }[] = [
    { id: 'morador', label: 'Morador' },
    { id: 'zelador', label: 'Zelador' },
    { id: 'prestador', label: 'Prestador' },
    { id: 'sindico', label: 'Síndico' }
];

export default function KnowledgeBase() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<AgentType>('morador');
    const [fileError, setFileError] = useState<string | null>(null);

    const {
        documents,
        isLoading,
        isUploading,
        uploadDocument,
        deleteDocument
    } = useKnowledgeBase(activeTab);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        setFileError(null);
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            setFileError('Apenas arquivos PDF são permitidos.');
            return;
        }

        if (file.size > 50 * 1024 * 1024) {
            setFileError('O arquivo excede o limite de 50MB.');
            return;
        }

        try {
            await uploadDocument(file);
            e.target.value = ''; // Reset
        } catch (err: any) {
            setFileError(err.message || 'Erro ao realizar o upload do documento.');
        }
    };

    const handleDelete = async (doc: KnowledgeDocument) => {
        if (!window.confirm(`Tem certeza que deseja excluir o documento "${doc.file_name}"?`)) return;
        try {
            await deleteDocument(doc.id, doc.file_path);
        } catch (err: any) {
            alert(`Erro ao excluir: ${err.message}`);
        }
    };

    return (
        <div className="min-h-screen bg-bg-primary text-text-primary p-6 md:p-10">
            <div className="max-w-6xl mx-auto space-y-8">
                
                {/* Header */}
                <div>
                    <button 
                        onClick={() => navigate('/superadmin')} 
                        className="flex items-center text-sm font-medium text-text-secondary hover:text-text-primary mb-4 transition-colors cursor-pointer"
                    >
                        &larr; Voltar ao Painel
                    </button>
                    <h1 className="text-3xl font-extrabold tracking-tight font-display mb-2">Base de Conhecimento</h1>
                    <p className="text-text-secondary">Gerencie os documentos em PDF que alimentam as respostas de cada agente de atendimento.</p>
                </div>

                {/* Tabs */}
                <div className="border-b border-border/60">
                    <nav className="-mb-px flex space-x-8 overflow-x-auto">
                        {AGENTS.map((agent) => {
                            const isActive = activeTab === agent.id;
                            return (
                                <button
                                    key={agent.id}
                                    onClick={() => {
                                        setFileError(null);
                                        setActiveTab(agent.id);
                                    }}
                                    className={`
                                        whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors
                                        ${isActive 
                                            ? 'border-accent text-accent' 
                                            : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border-strong'}
                                    `}
                                >
                                    Agente {agent.label}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* Content */}
                <div className="space-y-6">
                    
                    {/* Upload Dropzone */}
                    <Card className="border border-dashed border-border-strong bg-bg-secondary/30 pb-8 pt-10 px-6 text-center hover:bg-bg-secondary transition-colors relative">
                        <input 
                            type="file" 
                            accept=".pdf"
                            onChange={handleFileUpload}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                            title="Clique ou arraste um PDF aqui"
                            disabled={isUploading}
                        />
                        <div className="flex flex-col items-center justify-center space-y-4 pointer-events-none">
                            <div className={`p-4 rounded-full ${isUploading ? 'bg-accent/20 text-accent animate-pulse' : 'bg-bg-tertiary text-text-secondary'}`}>
                                {isUploading ? <Loader2 size={32} className="animate-spin" /> : <FileUp size={32} />}
                            </div>
                            <div>
                                <p className="text-base font-semibold text-text-primary">
                                    {isUploading ? 'Enviando documento...' : 'Clique ou arraste o PDF aqui'}
                                </p>
                                <p className="text-sm text-text-tertiary mt-1">
                                    Somente .PDF de até 50MB
                                </p>
                            </div>
                            {!isUploading && (
                                <Button type="button" variant="secondary" size="sm" className="pointer-events-auto relative z-10" onClick={(e) => {
                                    e.currentTarget.parentElement?.previousElementSibling?.dispatchEvent(new MouseEvent('click'));
                                }}>
                                    Selecionar arquivo
                                </Button>
                            )}
                            {fileError && (
                                <motion.div initial={{opacity:0, y:-5}} animate={{opacity:1, y:0}} className="text-error text-xs font-semibold flex items-center gap-1.5 bg-error/10 px-3 py-1.5 rounded-md mt-2">
                                    <AlertCircle size={14} /> {fileError}
                                </motion.div>
                            )}
                        </div>
                    </Card>

                    {/* Table */}
                    <Card className="p-0 overflow-hidden border border-border/50">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead>
                                    <tr className="border-b border-border/50 bg-bg-secondary/50 text-text-secondary text-xs uppercase tracking-wider font-semibold font-display">
                                        <th className="px-6 py-4">Nome do Arquivo</th>
                                        <th className="px-6 py-4">Data de Upload</th>
                                        <th className="px-6 py-4">Chunks</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-text-tertiary">
                                                <Loader2 size={24} className="animate-spin mx-auto mb-2" />
                                                Carregando documentos...
                                            </td>
                                        </tr>
                                    ) : documents.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-text-tertiary">
                                                Nenhum documento encontrado na base de conhecimento do {activeTab}.
                                            </td>
                                        </tr>
                                    ) : (
                                        <AnimatePresence>
                                            {documents.map((doc) => (
                                                <motion.tr 
                                                    key={doc.id}
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    className="hover:bg-bg-hover transition-colors group"
                                                >
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-accent/10 text-accent rounded-md">
                                                                <FileText size={16} />
                                                            </div>
                                                            <span className="font-medium text-text-primary text-sm truncate max-w-[200px] md:max-w-xs" title={doc.file_name}>
                                                                {doc.file_name}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-text-secondary">
                                                        {format(new Date(doc.created_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                                                    </td>
                                                    <td className="px-6 py-4 text-text-secondary">
                                                        {doc.chunk_count > 0 ? doc.chunk_count : '-'}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {doc.status === 'active' && (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20">
                                                                <CheckCircle2 size={12} /> Ativo
                                                            </span>
                                                        )}
                                                        {doc.status === 'processing' && (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20">
                                                                <Loader2 size={12} className="animate-spin" /> Processando...
                                                            </span>
                                                        )}
                                                        {doc.status === 'error' && (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-error/10 text-error border border-error/20" title={doc.error_msg || 'Erro desconhecido'}>
                                                                <AlertCircle size={12} /> Erro
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button 
                                                            onClick={() => handleDelete(doc)}
                                                            className="p-2 text-text-tertiary hover:text-error hover:bg-error/10 rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                            title="Excluir documento"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
                                                </motion.tr>
                                            ))}
                                        </AnimatePresence>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
