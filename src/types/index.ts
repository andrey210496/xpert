// ===== Database Entities =====

export interface Tenant {
    id: string;
    name: string;
    slug: string;
    admin_user_id: string;
    token_balance: number;
    plan: 'trial' | 'premium';
    plan_tokens_total: number;
    settings: Record<string, unknown>;
    tenant_context?: string;
    created_at: string;
    updated_at: string;
}

export type ProfileType = 'admin' | 'morador' | 'zelador' | 'prestador' | 'superadmin';

export interface Profile {
    id: string;
    user_id: string;
    tenant_id: string;
    full_name: string;
    phone: string;
    profile_type: ProfileType;
    is_active: boolean;
    daily_token_usage: number;
    last_usage_reset: string;
    created_at: string;
}

export interface Conversation {
    id: string;
    profile_id: string;
    tenant_id: string;
    agent_type: ProfileType;
    title: string;
    tokens_used: number;
    created_at: string;
    updated_at: string;
}

export interface Message {
    id: string;
    conversation_id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    tokens_input?: number;
    tokens_output?: number;
    model?: string;
    created_at: string;
}

export interface TokenTransaction {
    id: string;
    tenant_id: string;
    profile_id: string;
    conversation_id: string;
    tokens_input: number;
    tokens_output: number;
    tokens_total: number;
    model: string;
    profile_type: ProfileType;
    created_at: string;
}

export interface TokenLimit {
    id: string;
    tenant_id: string;
    profile_type: ProfileType;
    daily_limit: number;
    monthly_limit: number;
}

export interface Lead {
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
    email: string;
    status: 'new' | 'contacted' | 'converted' | 'lost';
    source: string;
    created_at: string;
}

// ===== Agent Configuration =====

export interface Capability {
    icon: string;    // nome do ícone Lucide
    label: string;   // 2-4 palavras
    detail: string;  // 1 linha curta
}

export interface AgentConfig {
    type: ProfileType;
    name: string;
    title: string;
    description: string;
    icon: string;
    color: string;
    systemPrompt: string;
    capabilities: Capability[];
    suggestedQuestions: string[];
}

export interface AgentDbConfig {
    id: string;
    agent_type: string;
    display_name: string;
    system_prompt: string;
    knowledge_base: string;
    is_active: boolean;
    updated_at: string;
}

// ===== Auth =====

export interface AuthUser {
    id: string;
    email: string;
}

export interface AuthState {
    user: AuthUser | null;
    profile: Profile | null;
    tenant: Tenant | null;
    isLoading: boolean;
    isAuthenticated: boolean;
}

// ===== Chat =====

export interface ChatState {
    conversations: Conversation[];
    currentConversation: Conversation | null;
    messages: Message[];
    isStreaming: boolean;
    guestMessageCount: number;
}

// ===== Lead Form =====

export interface LeadFormData {
    first_name: string;
    last_name: string;
    phone: string;
    email: string;
}

// ===== Token Dashboard =====

export interface TokenUsageData {
    date: string;
    total: number;
    admin: number;
    morador: number;
    zelador: number;
    prestador: number;
}

export interface ProfileUsageSummary {
    profile_type: ProfileType;
    total_tokens: number;
    percentage: number;
    color: string;
}
