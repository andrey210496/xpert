-- =============================================
-- NUCLEAR FIX: Chat History Persistence for ALL Users
-- =============================================
-- This script drops ALL known policy variants for conversations and messages
-- (from schema.sql, update_policies.sql, fix_access_control.sql, multi_tenant_consolidation.sql,
--  full_database_setup.sql, and fix_chat_history.sql)
-- and replaces them with profile_id-based policies that work for users WITH or WITHOUT a tenant.

-- =============================================
-- STEP 1: DROP ALL KNOWN CONVERSATION POLICIES
-- =============================================
DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can insert own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can delete own conversations" ON conversations;
DROP POLICY IF EXISTS "Users view own tenant conversations" ON conversations;
DROP POLICY IF EXISTS "Users insert own tenant conversations" ON conversations;
DROP POLICY IF EXISTS "Users update own tenant conversations" ON conversations;
DROP POLICY IF EXISTS "Users view own conversations" ON conversations;
DROP POLICY IF EXISTS "Users insert own conversations" ON conversations;
DROP POLICY IF EXISTS "Users update own conversations" ON conversations;

-- =============================================
-- STEP 2: DROP ALL KNOWN MESSAGE POLICIES
-- =============================================
DROP POLICY IF EXISTS "Users can view own messages" ON messages;
DROP POLICY IF EXISTS "Users can insert own messages" ON messages;
DROP POLICY IF EXISTS "Users view messages from own tenant" ON messages;
DROP POLICY IF EXISTS "Users insert messages into own tenant" ON messages;
DROP POLICY IF EXISTS "Users view own messages" ON messages;
DROP POLICY IF EXISTS "Users insert own messages" ON messages;

-- =============================================
-- STEP 3: HELPER FUNCTION (profile_id lookup)
-- =============================================
CREATE OR REPLACE FUNCTION get_user_profile_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- =============================================
-- STEP 4: NEW CONVERSATION POLICIES (profile-based)
-- =============================================

-- SELECT: user sees their own conversations + superadmin sees all
CREATE POLICY "Users can view own conversations"
  ON conversations FOR SELECT
  USING (
    profile_id = get_user_profile_id()
    OR is_superadmin()
  );

-- INSERT: user can create conversations linked to their own profile
-- tenant_id CAN be NULL (for leads)
CREATE POLICY "Users can insert own conversations"
  ON conversations FOR INSERT
  WITH CHECK (
    profile_id = get_user_profile_id()
  );

-- UPDATE: user can update their own conversations
CREATE POLICY "Users can update own conversations"
  ON conversations FOR UPDATE
  USING (
    profile_id = get_user_profile_id()
  );

-- DELETE: user can delete their own conversations
CREATE POLICY "Users can delete own conversations"
  ON conversations FOR DELETE
  USING (
    profile_id = get_user_profile_id()
  );

-- =============================================
-- STEP 5: NEW MESSAGE POLICIES (profile-based)
-- =============================================

-- SELECT: user sees messages from their own conversations
CREATE POLICY "Users can view own messages"
  ON messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE profile_id = get_user_profile_id()
    )
    OR is_superadmin()
  );

-- INSERT: user can insert messages into their own conversations
CREATE POLICY "Users can insert own messages"
  ON messages FOR INSERT
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM conversations WHERE profile_id = get_user_profile_id()
    )
  );
