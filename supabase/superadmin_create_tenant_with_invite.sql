-- Script SQL para criar a função segura de geração de Condomínio com PIN Mestre
-- Execute isso no SQL Editor do Supabase

CREATE OR REPLACE FUNCTION superadmin_create_tenant_with_invite(
    p_tenant_name text,
    p_plan text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_tenant_id uuid;
    v_slug text;
    v_invite_code text;
BEGIN
    -- 1. Verificar se é SuperAdmin
    IF NOT is_superadmin() THEN
        RAISE EXCEPTION 'Acesso negado: apenas superadmins podem criar novos condomínios.';
    END IF;

    -- 2. Gerar Slug
    v_slug := lower(regexp_replace(p_tenant_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(md5(random()::text), 1, 4);

    -- 3. Criar o Condomínio (Tenant)
    INSERT INTO tenants (name, slug, plan, status, plan_tokens_total, token_balance)
    VALUES (
        p_tenant_name,
        v_slug,
        p_plan, 
        'active', 
        CASE p_plan
            WHEN 'starter' THEN 500000
            WHEN 'pro' THEN 2000000
            WHEN 'premium' THEN 1000000
            WHEN 'enterprise' THEN 10000000
            ELSE 500000
        END,
        CASE p_plan
            WHEN 'starter' THEN 500000
            WHEN 'pro' THEN 2000000
            WHEN 'premium' THEN 1000000
            WHEN 'enterprise' THEN 10000000
            ELSE 500000
        END
    )
    RETURNING id INTO v_tenant_id;

    -- 4. Gerar o Código de Convite (PIN Mestre para o Síndico)
    -- Exemplo: MASTER-4A82-M9F1
    v_invite_code := 'MASTER-' || upper(substr(md5(random()::text), 1, 4)) || '-' || upper(substr(md5(random()::text), 5, 4));

    INSERT INTO invite_codes (
        tenant_id,
        code,
        profile_type,
        max_uses,
        current_uses
    ) VALUES (
        v_tenant_id,
        v_invite_code,
        'admin', -- 'admin' is the síndico profile_type
        1,
        0
    );

    -- 5. Retornar JSON com sucesso e o código mestre
    RETURN jsonb_build_object(
        'success', true,
        'tenant_id', v_tenant_id,
        'master_code', v_invite_code
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$;
