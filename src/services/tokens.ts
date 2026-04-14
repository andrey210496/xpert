import { isSupabaseConfigured, supabase } from './supabase';

export async function checkTokenBalance(tenantId: string): Promise<{ hasBalance: boolean; balance: number }> {

    const { data, error } = await supabase
        .from('tenants')
        .select('token_balance')
        .eq('id', tenantId)
        .single();

    if (error || !data) {
        return { hasBalance: false, balance: 0 };
    }

    return { hasBalance: data.token_balance > 0, balance: data.token_balance };
}

export async function recordTokenUsage(params: {
    tenantId: string;
    profileId: string;
    conversationId: string;
    tokensInput: number;
    tokensOutput: number;
    model: string;
    profileType: string;
}): Promise<boolean> {

    const tokensTotal = params.tokensInput + params.tokensOutput;

    // Insert transaction
    const { error: txError } = await supabase.from('token_transactions').insert({
        tenant_id: params.tenantId,
        profile_id: params.profileId,
        conversation_id: params.conversationId,
        tokens_input: params.tokensInput,
        tokens_output: params.tokensOutput,
        tokens_total: tokensTotal,
        model: params.model,
        profile_type: params.profileType,
    });

    if (txError) {
        console.error('[Tokens] Error recording transaction:', txError);
        return false;
    }

    // Deduct from balance
    const { error: updateError } = await supabase.rpc('deduct_tokens', {
        p_tenant_id: params.tenantId,
        p_amount: tokensTotal,
    });

    if (updateError) {
        console.error('[Tokens] Error deducting tokens:', updateError);
    }

    return !updateError;
}

export async function checkDailyLimit(
    tenantId: string,
    profileType: string,
    currentUsage: number
): Promise<{ withinLimit: boolean; limit: number | null }> {

    const { data, error } = await supabase
        .from('token_limits')
        .select('daily_limit')
        .eq('tenant_id', tenantId)
        .eq('profile_type', profileType)
        .single();

    if (error || !data || !data.daily_limit) {
        return { withinLimit: true, limit: null };
    }

    return {
        withinLimit: currentUsage < data.daily_limit,
        limit: data.daily_limit,
    };
}
