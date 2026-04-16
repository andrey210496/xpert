-- Comando completo e à prova de falhas:
CREATE OR REPLACE FUNCTION record_chat_usage(
    p_conv_id UUID, 
    p_tokens_input INT, 
    p_tokens_output INT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_tenant_id UUID;
  v_profile_id UUID;
  v_profile_type TEXT;
  v_total_tokens INT;
BEGIN
  v_total_tokens := p_tokens_input + p_tokens_output;

  SELECT tenant_id, profile_id INTO v_tenant_id, v_profile_id
  FROM conversations
  WHERE id = p_conv_id;

  -- 1. Atualizar a Conversa (independente de ter condomínio ou não)
  UPDATE conversations
  SET tokens_used = tokens_used + v_total_tokens,
      updated_at = now()
  WHERE id = p_conv_id;

  -- 2. Atualizar o uso diário do Perfil
  IF v_profile_id IS NOT NULL THEN
      SELECT profile_type INTO v_profile_type FROM profiles WHERE id = v_profile_id;

      UPDATE profiles
      SET daily_token_usage = daily_token_usage + v_total_tokens
      WHERE id = v_profile_id;
  END IF;

  -- 3. DEBITAR do Saldo do Condomínio APENAS SE ELE TIVER UM
  IF v_tenant_id IS NOT NULL THEN
      UPDATE tenants
      SET token_balance = GREATEST(0, token_balance - v_total_tokens),
          updated_at = now()
      WHERE id = v_tenant_id;
  END IF;

  -- 4. Registrar a Transação na Tabela (tenant_id pode ficar nulo como custo fixo da plataforma)
  INSERT INTO token_transactions (
      tenant_id,
      profile_id,
      conversation_id,
      tokens_input,
      tokens_output,
      tokens_total,
      profile_type,
      model
  ) VALUES (
      v_tenant_id,
      v_profile_id,
      p_conv_id,
      p_tokens_input,
      p_tokens_output,
      v_total_tokens,
      v_profile_type,
      'openrouter/gpt-4o-mini'
  );

END;
$$;
