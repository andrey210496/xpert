-- =============================================
-- SQL Function for SuperAdmin Dashboard
-- =============================================

-- Este script deve ser executado no SQL Editor do Supabase.
-- Ele consolida o total de usuários e o consumo de tokens por data.

CREATE OR REPLACE FUNCTION get_platform_usage_stats()
RETURNS TABLE (
  total_users_count BIGINT,
  total_tokens_consumed_count BIGINT,
  daily_usage_json JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM profiles)::bigint,
    (SELECT COALESCE(SUM(tokens_total), 0) FROM token_transactions)::bigint,
    (
      SELECT jsonb_agg(d) FROM (
        SELECT 
          to_char(days.day, 'DD/MM') as date,
          COALESCE(SUM(tt.tokens_total), 0)::bigint as tokens
        FROM (
          SELECT generate_series(
            now()::date - interval '6 days',
            now()::date,
            '1 day'::interval
          )::date as day
        ) days
        LEFT JOIN token_transactions tt ON date_trunc('day', tt.created_at)::date = days.day
        GROUP BY days.day
        ORDER BY days.day
      ) d
    ) as daily_usage;
END;
$$;
