const API_BASE_URL = import.meta.env.VITE_API_URL || '';

interface KnowledgeResult {
  context: string | null;
  sources: Array<{ source: string; similarity: number }>;
}

export async function fetchRelevantContext(
  question: string,
  tenantId: string
): Promise<KnowledgeResult> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/knowledge/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
