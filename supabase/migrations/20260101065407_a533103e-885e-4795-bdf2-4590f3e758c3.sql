-- Adicionar campo de aprovação na tabela usuarios
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS aprovado boolean NOT NULL DEFAULT false;

-- Criar tabela de logs de login
CREATE TABLE public.login_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  user_email text NOT NULL,
  user_nome text NOT NULL,
  device_info text,
  logged_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.login_logs ENABLE ROW LEVEL SECURITY;

-- Apenas service role pode inserir (via edge function)
CREATE POLICY "Service role can manage login_logs" 
  ON public.login_logs 
  FOR ALL 
  USING (true)
  WITH CHECK (true);

-- Admins podem visualizar
CREATE POLICY "Admins can view login_logs" 
  ON public.login_logs 
  FOR SELECT 
  USING (public.is_admin_user(current_setting('request.jwt.claims', true)::json->>'email'));

-- Criar índice para busca por usuário
CREATE INDEX idx_login_logs_user_id ON public.login_logs(user_id);
CREATE INDEX idx_login_logs_logged_at ON public.login_logs(logged_at DESC);