-- =============================================
-- TRIGGER: ROBUST USER REGISTRATION
-- =============================================
-- Automates the creation of a public.profiles row when auth.users is populated.
-- Prevents "auth orphans" by rolling back the transaction on failure.
-- BULLETPROOF VERSION: Handles missing JSON metadata safely.

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
  -- Safely extract metadata with COALESCE to avoid NULL constraint crashes
  v_role := COALESCE(new.raw_user_meta_data->>'profile_type', 'morador');
  v_full_name := COALESCE(new.raw_user_meta_data->>'full_name', 'Usuário');
  v_phone := new.raw_user_meta_data->>'phone';
  v_tenant_name := new.raw_user_meta_data->>'tenant_name';
  v_invite_code := new.raw_user_meta_data->>'invite_code';

  -- 🚨 SECURITY BLOCK
  IF v_role = 'superadmin' THEN
    RAISE EXCEPTION 'Registration as superadmin is explicitly denied via client API.';
  END IF;

  -- Validate profile type safely
  IF v_role NOT IN ('admin', 'morador', 'zelador', 'prestador') THEN
    v_role := 'morador'; -- fallback safely instead of crashing
  END IF;

  -- Handle Tenant Linking
  IF v_role = 'admin' THEN
    IF v_tenant_name IS NULL OR v_tenant_name = '' THEN
      v_tenant_name := 'Condomínio ' || v_full_name; -- prevent crash if name missing
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
    IF v_invite_code IS NULL OR v_invite_code = '' THEN
        -- Safest path for leads: null tenant
        v_tenant_id := NULL;
    ELSE
        -- Validate invite code
        SELECT id, tenant_id INTO v_invite_code_id, v_tenant_id
        FROM public.invite_codes
        WHERE code = v_invite_code;

        -- If code is invalid, fallback to NULL tenant rather than crashing the whole auth signup
        IF v_tenant_id IS NULL THEN
            v_tenant_id := NULL;
        ELSE
            -- Consume code if found
            UPDATE public.invite_codes SET current_uses = current_uses + 1 WHERE id = v_invite_code_id;
        END IF;
    END IF;
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
