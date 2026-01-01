-- Tabela para armazenar credenciais WebAuthn dos usuários
CREATE TABLE public.webauthn_credentials (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  credential_id text NOT NULL UNIQUE,
  public_key text NOT NULL,
  counter integer NOT NULL DEFAULT 0,
  device_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.webauthn_credentials ENABLE ROW LEVEL SECURITY;

-- Política: negar acesso via cliente (operações via edge function)
CREATE POLICY "Deny all client access to webauthn_credentials"
ON public.webauthn_credentials
AS RESTRICTIVE
FOR ALL
USING (false)
WITH CHECK (false);

-- Índice para buscar por user_id
CREATE INDEX idx_webauthn_credentials_user_id ON public.webauthn_credentials(user_id);