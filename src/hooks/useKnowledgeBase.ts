import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import type { AgentType, KnowledgeDocument } from '../types/knowledge';
import { useAuth } from '../contexts/AuthContext';
import { generateId } from '../utils/formatters';

export function useKnowledgeBase(agentType: AgentType) {
    const { profile } = useAuth();
    const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    
    // Para polling quando existirem arquivos processando
    const pollingIntervalRef = useRef<number | null>(null);

    const fetchDocuments = useCallback(async () => {
        if (!isSupabaseConfigured()) {
            setIsLoading(false);
            return;
        }

        const { data, error } = await supabase
            .from('knowledge_documents')
            .select('*')
            .eq('agent_type', agentType)
            .order('created_at', { ascending: false });

        if (!error && data) {
            setDocuments(data as KnowledgeDocument[]);
        }
        setIsLoading(false);
    }, [agentType]);

    useEffect(() => {
        setIsLoading(true);
        fetchDocuments();
    }, [fetchDocuments]);

    // 1. Polling fallback (caso o Realtime falhe ou esteja desabilitado)
    useEffect(() => {
        const hasProcessing = documents.some(doc => doc.status === 'processing');
        
        if (hasProcessing && !pollingIntervalRef.current) {
            pollingIntervalRef.current = window.setInterval(() => {
                fetchDocuments();
            }, 5000); // Mais lento pois temos Realtime
        } else if (!hasProcessing && pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }

        return () => {
            if (pollingIntervalRef.current) {
                // Não limpamos aqui para manter o polling rodando nas re-renderizações
            }
        };
    }, [documents, fetchDocuments]);

    // 2. Realtime Subscription (Atualização instantânea)
    useEffect(() => {
        if (!isSupabaseConfigured()) return;

        const channel = supabase
            .channel(`knowledge_updates_${agentType}`)
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to all events
                    schema: 'public',
                    table: 'knowledge_documents',
                    filter: `agent_type=eq.${agentType}`
                },
                (payload) => {
                    console.log('Realtime update received:', payload);
                    fetchDocuments(); // Refresh list when anything changes
                }
            )
            .subscribe((status) => {
                console.log(`Realtime subscription status for ${agentType}:`, status);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [agentType, fetchDocuments]);

    // Cleanup completo ao desmontar o componente
    useEffect(() => {
        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
        };
    }, []);

    const uploadDocument = async (file: File) => {
        if (!profile?.id) throw new Error("Usuário não autenticado");
        if (file.type !== 'application/pdf') throw new Error("Apenas arquivos PDF são permitidos");
        if (file.size > 50 * 1024 * 1024) throw new Error("Arquivo excede limite de 50MB");

        setIsUploading(true);
        
        try {
            const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const uniqueId = generateId();
            const filePath = `${agentType}/${uniqueId}_${safeFileName}`;

            // 1. Upload to Storage
            const { error: uploadError } = await supabase.storage
                .from('knowledge-pdfs')
                .upload(filePath, file);

            if (uploadError) throw new Error(`Erro ao fazer upload: ${uploadError.message}`);

            // 2. Insert into knowledge_documents
            const newDoc = {
                agent_type: agentType,
                file_name: file.name,
                file_path: filePath,
                status: 'processing' as const,
                uploaded_by: profile.user_id 
            };

            const { data: insertedDoc, error: insertError } = await supabase
                .from('knowledge_documents')
                .insert(newDoc)
                .select()
                .single();

            if (insertError || !insertedDoc) {
                // Remove from storage due to DB fail
                await supabase.storage.from('knowledge-pdfs').remove([filePath]);
                throw new Error(`Erro ao salvar registro: ${insertError?.message}`);
            }

            console.log("Documento inserido no banco, atualizando lista local...");
            
            // 3. Atualizar lista local imediatamente para feedback visual
            setDocuments(prev => [insertedDoc as KnowledgeDocument, ...prev]);
            await fetchDocuments();

            // 4. Trigger Edge Function via fetch direto
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

            console.log("Chamando Edge Function para processamento...");
            fetch(`${supabaseUrl}/functions/v1/process-pdf`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseAnonKey}`,
                    'apikey': supabaseAnonKey,
                },
                body: JSON.stringify({ document_id: insertedDoc.id }),
            }).then(async (res) => {
                if (!res.ok) {
                    const errorText = await res.text();
                    console.error("Erro ao chamar Edge Function:", res.status, errorText);
                    supabase.from('knowledge_documents')
                        .update({ status: 'error', error_msg: `HTTP ${res.status}: ${errorText}` })
                        .eq('id', insertedDoc.id).then(() => fetchDocuments());
                } else {
                    console.log("Edge Function iniciada com sucesso.");
                    // O Realtime/Polling cuida das próximas atualizações de status
                }
            }).catch((err) => {
                console.error("Exceção ao chamar Edge Function:", err);
                supabase.from('knowledge_documents')
                    .update({ status: 'error', error_msg: err.message || 'Exceção desconhecida' })
                    .eq('id', insertedDoc.id).then(() => fetchDocuments());
            });

        } catch (error: any) {
            console.error("Erro no processo de upload:", error);
            setIsUploading(false);
            throw new Error(error.message || "Erro desconhecido ao realizar upload");
        } finally {
            setIsUploading(false);
        }
    };

    const deleteDocument = async (documentId: string, filePath: string) => {
        try {
            await supabase.storage.from('knowledge-pdfs').remove([filePath]);
            
            const { error } = await supabase
                .from('knowledge_documents')
                .delete()
                .eq('id', documentId);

            if (error) throw error;

            setDocuments(prev => prev.filter(d => d.id !== documentId));
        } catch (error: any) {
            console.error("Erro ao deletar", error);
            throw new Error(`Falha ao excluir o documento: ${error.message}`);
        }
    };

    return {
        documents,
        isLoading,
        isUploading,
        uploadDocument,
        deleteDocument,
        refetch: fetchDocuments
    };
}
