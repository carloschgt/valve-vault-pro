-- Remove overly permissive service role policy that allows anyone to read login_logs
DROP POLICY IF EXISTS "Service role can manage login_logs" ON public.login_logs;

-- Add explicit denial for public access (service role bypasses RLS anyway)
CREATE POLICY "Deny public access to login_logs"
  ON public.login_logs
  FOR SELECT
  USING (false);

-- Add policy for service role INSERT operations (for Edge Functions)
CREATE POLICY "Service role can insert login_logs"
  ON public.login_logs
  FOR INSERT
  WITH CHECK (true);

-- Add policy for service role DELETE operations (for Edge Functions)  
CREATE POLICY "Service role can delete login_logs"
  ON public.login_logs
  FOR DELETE
  USING (true);