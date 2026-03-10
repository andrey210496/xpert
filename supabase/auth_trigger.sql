-- =============================================
-- TRIGGER: ROBUST USER REGISTRATION
-- =============================================
-- Automates the creation of a public.profiles row when auth.users is populated.
-- Prevents "auth orphans" by rolling back the transaction on failure.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_role TEXT;
  v_full_name TEXT;
  v_phone TEXT;
  v_tenant_name TEXT;
  v_invite_code TEXT;
  v_tenant_id UUID;
  v_invite_code_id UUID;
BEGIN
  -- Extract metadata
  v_role := new.raw_user_meta_data->>'profile_type';
  v_full_name := new.raw_user_meta_data->>'full_name';
  v_phone := new.raw_user_meta_data->>'phone';
  v_tenant_name := new.raw_user_meta_data->>'tenant_name';
  v_invite_code := new.raw_user_meta_data->>'invite_code';

  -- 🚨 SECURITY BLOCK
  IF v_role = 'superadmin' THEN
    RAISE EXCEPTION 'Registration as superadmin is explicitly denied via client API.';
  END IF;

  -- Validate profile type
  IF v_role NOT IN ('admin', 'morador', 'zelador', 'prestador') THEN
    RAISE EXCEPTION 'Invalid profile type: %', v_role;
  END IF;

  -- Handle Tenant Linking
  IF v_role = 'admin' THEN
    IF v_tenant_name IS NULL OR v_tenant_name = '' THEN
      RAISE EXCEPTION 'Nome do condomínio é obrigatório para o síndico.';
    END IF;

    -- Create Tenant
    INSERT INTO public.tenants (name, slug, admin_user_id)
    VALUES (
      v_tenant_name, 
      lower(regexp_replace(v_tenant_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(md5(random()::text), 1, 4), 
      new.id
    )
    RETURNING id INTO v_tenant_id;

  ELSE
    -- For 'morador', 'zelador', 'prestador'
    -- If there's NO invite code, check if it's a direct lead conversion.
    -- (Lead conversions skip invite checks but require valid profile_type)
    IF v_invite_code IS NULL OR v_invite_code = '' THEN
        -- Only allow if they are just lacking tenant linkage for now, meaning tenant_id will be NULL.
        -- We will insert them with no tenant_id, allowing the superadmin to assign them later.
        v_tenant_id := NULL;
    ELSE
        -- Validate invite code
        SELECT id, tenant_id INTO v_invite_code_id, v_tenant_id
        FROM public.invite_codes
        WHERE code = v_invite_code;

        IF v_tenant_id IS NULL THEN
            RAISE EXCEPTION 'Código de convite inválido ou inexistente.';
        END IF;

        -- Check if profile matches code
        IF NOT EXISTS (
            SELECT 1 FROM public.invite_codes
            WHERE id = v_invite_code_id AND profile_type = v_role
        ) THEN
            RAISE EXCEPTION 'Este código não é válido para a função %', v_role;
        END IF;

        -- Consume code
        UPDATE public.invite_codes SET current_uses = current_uses + 1 WHERE id = v_invite_code_id;
    END IF;
  END IF;

  -- Create Profile
  INSERT INTO public.profiles (user_id, tenant_id, full_name, phone, profile_type, is_active)
  VALUES (new.id, v_tenant_id, v_full_name, v_phone, v_role, true);

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger binding
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
