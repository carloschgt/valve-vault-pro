-- Tabela para tokens de redefinição de senha
CREATE TABLE public.password_reset_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice para busca por token
CREATE INDEX idx_password_reset_tokens_token ON public.password_reset_tokens(token);

-- Índice para busca por user_id
CREATE INDEX idx_password_reset_tokens_user_id ON public.password_reset_tokens(user_id);

-- RLS
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Adicionar tipo de notificação para reset de senha nos admins
-- A tabela notificacoes_usuario já existe, vamos usar ela