import { useState, useEffect } from 'react';
import { UploadCloud, FileCheck, AlertCircle, Info, Trash2, Database } from 'lucide-react';
import { motion } from 'framer-motion';
import { ProgressBar, Card } from '../ui';
import { supabase } from '../../lib/supabase';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

interface Props {
  tenantId: string;
}

export function KnowledgeUpload({ tenantId }: Props) {
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchFiles();
  }, [tenantId]);

  async function fetchFiles() {
    const { data } = await supabase
      .from('knowledge_files')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (data) setFiles(data);
  }

  async function handleDelete(filename: string, id: string) {
    if (!window.confirm(`Tem certeza que deseja excluir '${filename}'? A IA esquecerá o conteúdo deste documento.`)) return;
    
    setIsDeleting(id);
    try {
      const res = await fetch(`${API_BASE_URL}/api/knowledge/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, filename })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao deletar da API.');
      }
      
      await supabase.from('knowledge_files').delete().eq('id', id);
      setFiles(prev => prev.filter(f => f.id !== id));
      setStatus({ type: 'success', message: 'Arquivo e sua memória excluídos com sucesso.' });
    } catch(err) {
      alert('Erro ao excluir: ' + (err as Error).message);
    } finally {
      setIsDeleting(null);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setStatus({ type: 'error', message: 'Por favor, selecione um arquivo PDF.' });
      return;
    }

    setUploading(true);
    setStatus(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('tenant_id', tenantId);

    try {
      const res = await fetch(`${API_BASE_URL}/api/knowledge/ingest`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao processar documento.');

      setStatus({
        type: 'success',
        message: `Sucesso! "${file.name}" foi indexado em ${data.chunks} partes.`,
      });
      
      // Registrar no Supabase
      await supabase.from('knowledge_files').insert({
        tenant_id: tenantId,
        filename: file.name,
        chunks_count: data.chunks
      });
      
      await fetchFiles();

    } catch (err) {
      console.error('[KnowledgeUpload] Error:', err);
      setStatus({ 
        type: 'error', 
        message: err instanceof Error ? err.message : 'Falha na comunicação com o servidor.' 
      });
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = '';
    }
  }

  return (
    <div className="space-y-6">
    <Card variant="bordered" className="p-6 bg-bg-secondary/50">
      <div className="flex items-start gap-4 mb-6">
        <div className="p-2 bg-accent/10 rounded-lg shrink-0">
          <UploadCloud className="text-accent" size={20} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-text-primary mb-1">Upload de Base de Conhecimento</h3>
          <p className="text-xs text-text-tertiary leading-relaxed">
            Envie manuais, regimentos e atas em PDF. Nossa IA irá processar o conteúdo para responder dúvidas baseadas nestes documentos.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <label className={`
          relative flex flex-col items-center justify-center w-full h-32 
          border-2 border-dashed rounded-xl transition-all duration-200
          ${uploading ? 'opacity-50 cursor-not-allowed border-border' : 'cursor-pointer border-border-strong hover:border-accent hover:bg-accent/5'}
        `}>
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
          
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <UploadCloud className={`mb-3 ${uploading ? 'animate-bounce text-text-tertiary' : 'text-accent'}`} size={24} />
            <p className="mb-1 text-xs font-bold text-text-secondary uppercase tracking-tight">
              {uploading ? 'Processando Documento...' : 'Clique para selecionar PDF'}
            </p>
            <p className="text-[10px] text-text-tertiary font-mono">PDF de até 200MB</p>
          </div>
        </label>

        {uploading && (
          <div className="space-y-2">
            <div className="flex justify-between items-center text-[10px] font-mono font-bold text-accent uppercase tracking-widest">
              <span>Indexando vetores...</span>
              <span>Wait</span>
            </div>
            <ProgressBar value={100} className="animate-pulse" />
          </div>
        )}

        {status && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-center gap-3 p-3 rounded-lg text-xs font-medium border ${
              status.type === 'success' 
                ? 'bg-success/5 border-success/20 text-success' 
                : 'bg-error/5 border-error/20 text-error'
            }`}
          >
            {status.type === 'success' ? <FileCheck size={16} /> : <AlertCircle size={16} />}
            {status.message}
          </motion.div>
        )}

        <div className="flex items-start gap-2 p-3 bg-bg-tertiary rounded-lg border border-border">
          <Info size={14} className="text-text-tertiary shrink-0 mt-0.5" />
          <p className="text-[10px] text-text-tertiary leading-relaxed font-sans">
            <strong>Dica:</strong> Documentos com texto claro (não escaneados como imagem) funcionam melhor. O processamento pode levar vários minutos dependendo do tamanho e quantidade de páginas do arquivo.
          </p>
        </div>
      </div>
    </Card>

    <Card variant="bordered" className="p-6 bg-bg-secondary/50">
        <div className="flex items-center gap-3 mb-4">
            <Database size={18} className="text-accent" />
            <h3 className="text-sm font-bold text-text-primary">Arquivos Indexados</h3>
        </div>
        
        {files.length === 0 ? (
            <p className="text-xs text-text-tertiary text-center py-4">Nenhum arquivo processado ainda.</p>
        ) : (
            <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                {files.map(f => (
                    <div key={f.id} className="flex items-center justify-between p-3 rounded-lg bg-bg-tertiary border border-border">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <FileCheck size={16} className="text-success shrink-0" />
                            <div className="flex flex-col shrink">
                                <span className="text-xs text-text-primary font-medium truncate" title={f.filename}>{f.filename}</span>
                                <span className="text-[10px] text-text-tertiary">{f.chunks_count} blocos processados</span>
                            </div>
                        </div>
                        <button 
                            onClick={() => handleDelete(f.filename, f.id)}
                            disabled={isDeleting === f.id}
                            title="Excluir documento e memória da IA"
                            className="p-1.5 rounded-md hover:bg-error/10 text-text-tertiary hover:text-error transition-colors disabled:opacity-50 ml-2"
                        >
                            {isDeleting === f.id ? <div className="w-3.5 h-3.5 border-2 border-error border-t-transparent rounded-full animate-spin"/> : <Trash2 size={14} />}
                        </button>
                    </div>
                ))}
            </div>
        )}
    </Card>
    </div>
  );
}
