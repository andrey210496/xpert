import { useState } from 'react';
import { UploadCloud, FileCheck, AlertCircle, Info } from 'lucide-react';
import { motion } from 'framer-motion';
import { ProgressBar, Card } from '../ui';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface Props {
  tenantId: string;
}

export function KnowledgeUpload({ tenantId }: Props) {
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ingest-knowledge`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao processar documento.');

      setStatus({
        type: 'success',
        message: `Sucesso! "${file.name}" foi indexado em ${data.chunks} partes.`,
      });
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
            <p className="text-[10px] text-text-tertiary font-mono">PDF até 10MB</p>
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
            <strong>Dica:</strong> Documentos com texto claro (não escaneados como imagem) funcionam melhor. O processamento pode levar alguns segundos dependendo do tamanho do arquivo.
          </p>
        </div>
      </div>
    </Card>
  );
}
