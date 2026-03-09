-- =============================================
-- RPC: Register Lead User (without tenant)
-- =============================================
-- Creates a user profile without requiring a tenant or invite code.
-- Used when a lead converts to a registered user through the chat flow.

CREATE OR REPLACE FUNCTION register_lead_user(
  p_user_id UUID,
  p_full_name TEXT,
  p_phone TEXT,
  p_profile_type TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_profile JSONB;
BEGIN
  -- Validate profile type
  IF p_profile_type NOT IN ('admin', 'morador', 'zelador', 'prestador') THEN
    RAISE EXCEPTION 'Invalid profile type: %', p_profile_type;
  END IF;

  -- Insert profile WITHOUT tenant
  INSERT INTO profiles (user_id, tenant_id, full_name, phone, profile_type, is_active)
  VALUES (p_user_id, NULL, p_full_name, p_phone, p_profile_type, true);

  -- Return inserted profile
  SELECT row_to_json(p)::jsonb INTO v_new_profile
  FROM profiles p
  WHERE p.user_id = p_user_id
  LIMIT 1;

  RETURN v_new_profile;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Perfil já existe para este usuário.';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao registrar usuário: %', SQLERRM;
END;
$$;

-- =============================================
-- ALTER: Add profile_type column to leads table
-- =============================================
ALTER TABLE leads ADD COLUMN IF NOT EXISTS profile_type TEXT;
