-- =============================================
-- XPERT - RAG Knowledge Base Setup (v2 — gte-small)
-- =============================================

-- 1.1 — Habilitar pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 1.2 — Recriar tabela com dimensão correta (384 para gte-small)
-- Se a tabela já existia com vector(1024), remova primeiro
DROP TABLE IF EXISTS knowledge_chunks;

CREATE TABLE knowledge_chunks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  source        TEXT NOT NULL,
  chunk_index   INT NOT NULL,
  content       TEXT NOT NULL,
  embedding     VECTOR(384),
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 1.3 — Índice HNSW para similarity search
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx
  ON knowledge_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 1.4 — Unique constraint para upsert seguro
CREATE UNIQUE INDEX IF NOT EXISTS knowledge_chunks_source_idx
  ON knowledge_chunks (tenant_id, source, chunk_index);

-- 1.5 — Row Level Security
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- Síndico/admin do tenant pode ver e inserir
-- Ajustado para o schema XPERT: usa a tabela 'profiles' e helper 'is_admin()'
CREATE POLICY "tenant_admin_access" ON knowledge_chunks
  FOR ALL
  USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
    AND (SELECT EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND (profile_type = 'admin' OR profile_type = 'superadmin')))
  );

-- Todos os usuários do tenant podem ler
CREATE POLICY "tenant_user_read" ON knowledge_chunks
  FOR SELECT
  USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
  );

-- 1.6 — Função de similarity search
-- Remove versão anterior se existir (mudou a dimensão do vetor)
DROP FUNCTION IF EXISTS match_knowledge;

CREATE OR REPLACE FUNCTION match_knowledge(
  query_embedding  VECTOR(384),
  p_tenant_id      UUID,
  match_count      INT   DEFAULT 5,
  match_threshold  FLOAT DEFAULT 0.65
)
RETURNS TABLE (
  id          UUID,
  source      TEXT,
  content     TEXT,
  similarity  FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.source,
    kc.content,
    1 - (kc.embedding <=> query_embedding) AS similarity
  FROM knowledge_chunks kc
  WHERE
    kc.tenant_id = p_tenant_id
    AND 1 - (kc.embedding <=> query_embedding) > match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
