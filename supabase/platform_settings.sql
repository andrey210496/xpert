-- =============================================
-- XPERT - Platform Settings
-- =============================================

-- Tabela para configurações globais do sistema
CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Superadmins podem fazer tudo
CREATE POLICY "Superadmin manage platform settings"
  ON platform_settings FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND profile_type = 'superadmin'
  ));

-- Todos autenticados podem ler (necessário para cálculos no dashboard)
CREATE POLICY "Anyone read platform settings"
  ON platform_settings FOR SELECT
  USING (auth.role() = 'authenticated');

-- Seed inicial de preços
INSERT INTO platform_settings (key, value) VALUES 
('plan_prices', '{"starter": 199, "pro": 499, "enterprise": 1199}'::jsonb)
ON CONFLICT (key) DO NOTHING;
