-- CRITICAL FIX: Remove overly permissive RLS policy on usuarios table
-- This policy currently allows ANYONE to read all user data including password hashes

-- Drop the dangerous policy that allows public access
DROP POLICY IF EXISTS "Service role can manage usuarios" ON public.usuarios;

-- The usuarios table should ONLY be accessed via Edge Functions using service role key
-- No client-side direct access is needed for this application architecture
-- Edge Functions (auth, admin-users) already use SUPABASE_SERVICE_ROLE_KEY which bypasses RLS

-- RLS remains enabled, but with no permissive policies, 
-- only service role (used by Edge Functions) can access the table