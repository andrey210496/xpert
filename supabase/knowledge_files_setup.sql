-- Copie e cole este código no Editor SQL do seu Supabase
-- Ele cria a tabela que lista os PDFs que você fez upload na Base de Conhecimento.

CREATE TABLE IF NOT EXISTS knowledge_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  chunks_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar segurança a nível de linha (RLS)
ALTER TABLE knowledge_files ENABLE ROW LEVEL SECURITY;

-- Política: Todos do Tenant Podem Ler
CREATE POLICY "tenant_read_knowledge_files" ON knowledge_files
  FOR SELECT
  USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
  );

-- Política: SuperAdmins e Admins do Tenant Podem Inserir/Deletar
CREATE POLICY "admin_manage_knowledge_files" ON knowledge_files
  FOR ALL
  USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid() LIMIT 1)
    AND (
       SELECT EXISTS (
          SELECT 1 FROM profiles 
          WHERE user_id = auth.uid() AND profile_type IN ('admin', 'superadmin')
       )
    )
  );
