-- 🎯 CORREÇÃO DEFINITIVA DO BANCO DE DADOS
-- O problema: O banco esperava que tenant_id fosse um UUID real,
-- mas os Agentes do Painel de Configuração usam 'agent:admin', 'agent:zelador', etc.
-- Este código muda o campo para TEXTO para aceitar ambos.

-- 1. Apagar e recriar a tabela de arquivos (ela é apenas uma listagem visual)
DROP TABLE IF EXISTS knowledge_files CASCADE;

CREATE TABLE knowledge_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL, -- ALTA PRIORIDADE: MUDANÇA PARA TEXTO
  filename TEXT NOT NULL,
  chunks_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE knowledge_files ENABLE ROW LEVEL SECURITY;

-- 2. Políticas Unificadas para SuperAdmins (você) e Admins de Tenant
CREATE POLICY "knowledge_files_policy" ON knowledge_files
  FOR ALL
  USING (
    (SELECT profile_type FROM profiles WHERE user_id = auth.uid() LIMIT 1) = 'superadmin'
    OR tenant_id = (SELECT tenant_id::text FROM profiles WHERE user_id = auth.uid() LIMIT 1)
  );

-- 3. (OPCIONAL) Atualizar a tabela de vetores (casos de uso futuros)
-- Se você ainda tiver a tabela knowledge_chunks, rode isso:
ALTER TABLE IF EXISTS knowledge_chunks 
  ALTER COLUMN tenant_id TYPE TEXT;
ALTER TABLE IF EXISTS knowledge_chunks 
  DROP CONSTRAINT IF EXISTS knowledge_chunks_tenant_id_fkey;
