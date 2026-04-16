-- =============================================
-- TRIGGER: ROBUST USER REGISTRATION
-- =============================================
-- Automates the creation of a public.profiles row when auth.users is populated.

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
  v_code_profile_type TEXT;
BEGIN
  -- Safely extract metadata with COALESCE
  v_role := COALESCE(new.raw_user_meta_data->>'profile_type', 'morador');
  v_full_name := COALESCE(new.raw_user_meta_data->>'full_name', 'Usuário');
  v_phone := new.raw_user_meta_data->>'phone';
  v_tenant_name := new.raw_user_meta_data->>'tenant_name';
  v_invite_code := new.raw_user_meta_data->>'invite_code';

  -- 🚨 SECURITY BLOCK
  IF v_role = 'superadmin' THEN
    RAISE EXCEPTION 'Registration as superadmin is explicitly denied via client API.';
  END IF;

  -- Verify invite code BEFORE creating any tenant (fixes Master PIN logic)
  IF v_invite_code IS NOT NULL AND v_invite_code != '' THEN
      SELECT id, tenant_id, profile_type INTO v_invite_code_id, v_tenant_id, v_code_profile_type
      FROM public.invite_codes
      WHERE code = v_invite_code AND current_uses < max_uses;

      IF v_tenant_id IS NOT NULL THEN
          -- Inherit the profile type from the invite code (promotes to admin via Master PIN)
          v_role := v_code_profile_type;
          -- Consume code
          UPDATE public.invite_codes SET current_uses = current_uses + 1 WHERE id = v_invite_code_id;
      ELSE
          v_tenant_id := NULL;
      END IF;
  END IF;

  -- If NO invite code was used and they selected 'admin', they are trying to create a new Tenant
  IF v_tenant_id IS NULL AND v_role = 'admin' THEN
    IF v_tenant_name IS NULL OR v_tenant_name = '' THEN
      v_tenant_name := 'Condomínio ' || v_full_name;
    END IF;

    -- Create Tenant
    INSERT INTO public.tenants (name, slug, admin_user_id)
    VALUES (
      v_tenant_name, 
      lower(regexp_replace(v_tenant_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(md5(random()::text), 1, 4), 
      new.id
    )
    RETURNING id INTO v_tenant_id;
  END IF;

  -- Validate profile type safely
  IF v_role NOT IN ('admin', 'morador', 'zelador', 'prestador') THEN
    v_role := 'morador'; 
  END IF;

  -- Create Profile safely
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
