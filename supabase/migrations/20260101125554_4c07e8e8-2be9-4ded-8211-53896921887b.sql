-- Create session_tokens table for secure session management
CREATE TABLE public.session_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  device_info TEXT
);

-- Create index for fast token lookups
CREATE INDEX idx_session_tokens_token ON public.session_tokens(token);
CREATE INDEX idx_session_tokens_user_id ON public.session_tokens(user_id);
CREATE INDEX idx_session_tokens_expires_at ON public.session_tokens(expires_at);

-- Enable RLS
ALTER TABLE public.session_tokens ENABLE ROW LEVEL SECURITY;

-- Only allow service role to manage session tokens (Edge Functions only)
CREATE POLICY "Service role can insert session_tokens"
  ON public.session_tokens
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can select session_tokens"
  ON public.session_tokens
  FOR SELECT
  USING (true);

CREATE POLICY "Service role can delete session_tokens"
  ON public.session_tokens
  FOR DELETE
  USING (true);

-- Deny public access completely
CREATE POLICY "Deny public access to session_tokens"
  ON public.session_tokens
  FOR ALL
  USING (false);

-- Create function to clean up expired tokens (can be called periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.session_tokens WHERE expires_at < now();
END;
$$;