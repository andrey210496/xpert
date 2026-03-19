export type AgentType = 'morador' | 'zelador' | 'prestador' | 'sindico';

export type DocumentStatus = 'processing' | 'active' | 'error';

export interface KnowledgeDocument {
    id: string;
    agent_type: AgentType;
    file_name: string;
    file_path: string;
    status: DocumentStatus;
    chunk_count: number;
    error_msg: string | null;
    uploaded_by: string;
    created_at: string;
    updated_at: string;
}
