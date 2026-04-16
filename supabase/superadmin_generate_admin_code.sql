-- Script para adaptar o banco para aceitar códigos de convite para 'admin' e criar a RPC

-- 1. Atualizar a Trava (Constraint) para aceitar 'admin'
ALTER TABLE invite_codes DROP CONSTRAINT IF EXISTS invite_codes_profile_type_check;

ALTER TABLE invite_codes ADD CONSTRAINT invite_codes_profile_type_check 
CHECK (profile_type IN ('admin', 'morador', 'zelador', 'prestador'));

-- 2. Criar Função para Gerar Código Mestre Extra
CREATE OR REPLACE FUNCTION superadmin_generate_admin_code(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_invite_code text;
BEGIN
    -- Verificar se é SuperAdmin
    IF NOT is_superadmin() THEN
        RAISE EXCEPTION 'Acesso negado: apenas superadmins podem gerar pinos mestre.';
    END IF;

    -- Gerar o Código de Convite (PIN Extra para o Síndico ou Sub-Síndicos)
    v_invite_code := 'MASTER-' || upper(substr(md5(random()::text), 1, 4)) || '-' || upper(substr(md5(random()::text), 5, 4));

    INSERT INTO invite_codes (
        tenant_id,
        code,
        profile_type,
        max_uses,
        current_uses
    ) VALUES (
        p_tenant_id,
        v_invite_code,
        'admin',
        1,
        0
    );

    RETURN jsonb_build_object(
        'success', true,
        'code', v_invite_code
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$;
