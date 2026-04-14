import { supabase, isSupabaseConfigured } from './supabase';
import type { AgentDbConfig } from '../types';

let configCache: AgentDbConfig[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function fetchAgentConfigs(): Promise<AgentDbConfig[]> {

    const now = Date.now();
    if (configCache && now - cacheTimestamp < CACHE_TTL) {
        return configCache;
    }

    const { data, error } = await supabase
        .from('agent_configs')
        .select('*')
        .order('agent_type');

    if (error || !data) return configCache || [];

    configCache = data as AgentDbConfig[];
    cacheTimestamp = now;
    return configCache;
}

export async function getAgentConfig(agentType: string): Promise<AgentDbConfig | null> {
    const configs = await fetchAgentConfigs();
    return configs.find((c) => c.agent_type === agentType) || null;
}

export async function updateAgentConfig(
    agentType: string,
    updates: { system_prompt?: string; knowledge_base?: string; is_active?: boolean; display_name?: string }
): Promise<{ success: boolean; error?: string }> {

    const { error } = await supabase
        .from('agent_configs')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('agent_type', agentType);

    if (error) {
        return { success: false, error: error.message };
    }

    // Invalidate cache
    configCache = null;
    cacheTimestamp = 0;

    return { success: true };
}

export function invalidateConfigCache() {
    configCache = null;
    cacheTimestamp = 0;
}
