const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface KnowledgeResult {
  context: string | null;
  sources: Array<{ source: string; similarity: number }>;
}

export async function fetchRelevantContext(
  question: string,
  tenantId: string
): Promise<KnowledgeResult> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/query-knowledge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ question, tenant_id: tenantId }),
    });

    if (!res.ok) {
      console.error('[Knowledge Service] Error fetching context:', await res.text());
      return { context: null, sources: [] };
    }
    
    return await res.json();
  } catch (error) {
    console.error('[Knowledge Service] Network error:', error);
    return { context: null, sources: [] };
  }
}
