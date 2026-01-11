-- =====================================================
-- MEGA HARDENING: Segurança de Autenticação e Sessões
-- =====================================================

-- A) Adicionar colunas na tabela usuarios para hardening
ALTER TABLE public.usuarios 
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'USER',
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS password_salt TEXT,
ADD COLUMN IF NOT EXISTS password_algo TEXT DEFAULT 'sha256',
ADD COLUMN IF NOT EXISTS password_iterations INT,
ADD COLUMN IF NOT EXISTS password_updated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS failed_attempts INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS last_login_ip TEXT NULL;

-- Migrar dados de 'tipo' para 'role' (manter 'tipo' para compatibilidade frontend)
UPDATE public.usuarios SET role = UPPER(tipo) WHERE role = 'USER';
UPDATE public.usuarios SET role = 'ADMIN' WHERE tipo = 'admin';
UPDATE public.usuarios SET role = 'USER' WHERE tipo = 'user';
UPDATE public.usuarios SET role = 'ESTOQUE' WHERE tipo = 'estoque';
UPDATE public.usuarios SET role = 'COMERCIAL' WHERE tipo = 'comercial';

-- Sincronizar is_active com aprovado
UPDATE public.usuarios SET is_active = aprovado WHERE is_active = TRUE;

-- B) Adicionar coluna token_hash na tabela session_tokens para sessões seguras
ALTER TABLE public.session_tokens
ADD COLUMN IF NOT EXISTS token_hash TEXT,
ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS ip TEXT NULL,
ADD COLUMN IF NOT EXISTS user_agent TEXT NULL;

-- Criar índice único para token_hash (tokens futuros)
CREATE UNIQUE INDEX IF NOT EXISTS idx_session_tokens_token_hash ON public.session_tokens(token_hash) WHERE token_hash IS NOT NULL;

-- C) Criar tabela de rate limiting persistente
CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
    key TEXT PRIMARY KEY,
    window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
    attempts INT NOT NULL DEFAULT 1,
    blocked_until TIMESTAMPTZ NULL
);

-- Habilitar RLS (negar acesso direto do cliente)
ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny all client access to auth_rate_limits"
ON public.auth_rate_limits
FOR ALL
USING (false)
WITH CHECK (false);

-- D) Criar tabela de eventos de auditoria
CREATE TABLE IF NOT EXISTS public.auth_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id UUID NULL,
    event_type TEXT NOT NULL,
    ip TEXT NULL,
    user_agent TEXT NULL,
    detail JSONB NULL
);

-- Índices para consultas de auditoria
CREATE INDEX IF NOT EXISTS idx_auth_events_user_id ON public.auth_events(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_events_event_type ON public.auth_events(event_type);
CREATE INDEX IF NOT EXISTS idx_auth_events_created_at ON public.auth_events(created_at DESC);

-- Habilitar RLS (negar acesso direto do cliente)
ALTER TABLE public.auth_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny all client access to auth_events"
ON public.auth_events
FOR ALL
USING (false)
WITH CHECK (false);

-- E) Criar tabela de solicitações de mudança de senha
CREATE TABLE IF NOT EXISTS public.password_change_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    requested_by_user_id UUID NULL,
    target_user_id UUID NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('RESET', 'CHANGE')),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    decided_by_user_id UUID NULL,
    decided_at TIMESTAMPTZ NULL,
    reason TEXT NULL,
    expires_at TIMESTAMPTZ NULL
);

-- Índices para consultas
CREATE INDEX IF NOT EXISTS idx_password_change_requests_status ON public.password_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_password_change_requests_target ON public.password_change_requests(target_user_id);

-- Habilitar RLS (negar acesso direto do cliente)
ALTER TABLE public.password_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny all client access to password_change_requests"
ON public.password_change_requests
FOR ALL
USING (false)
WITH CHECK (false);

-- F) SUPER_ADMIN BOOTSTRAP: Garantir carlos.teixeira@imexsolutions.com.br como SUPER_ADMIN
UPDATE public.usuarios 
SET 
    role = 'SUPER_ADMIN',
    tipo = 'admin',
    is_active = TRUE,
    aprovado = TRUE,
    status = 'ativo'
WHERE email = 'carlos.teixeira@imexsolutions.com.br';

-- Se não existir, inserir (só se a tabela permitir - pode falhar se houver campos obrigatórios)
-- O fallback será feito na edge function auth/index.ts
INSERT INTO public.usuarios (
    nome, 
    email, 
    senha_hash,
    tipo, 
    role, 
    is_active, 
    aprovado, 
    status
)
SELECT 
    'Carlos Teixeira',
    'carlos.teixeira@imexsolutions.com.br',
    '', -- Senha vazia, forçará reset
    'admin',
    'SUPER_ADMIN',
    TRUE,
    TRUE,
    'ativo'
WHERE NOT EXISTS (
    SELECT 1 FROM public.usuarios WHERE email = 'carlos.teixeira@imexsolutions.com.br'
);

-- Registrar evento de bootstrap
INSERT INTO public.auth_events (event_type, detail)
SELECT 
    'SUPER_ADMIN_ENSURED',
    jsonb_build_object(
        'email', 'carlos.teixeira@imexsolutions.com.br',
        'action', 'migration_bootstrap',
        'timestamp', now()
    )
WHERE EXISTS (
    SELECT 1 FROM public.usuarios WHERE email = 'carlos.teixeira@imexsolutions.com.br'
);

-- G) Criar função para limpar rate limits expirados (executar periodicamente)
CREATE OR REPLACE FUNCTION public.cleanup_expired_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.auth_rate_limits 
    WHERE blocked_until < now() - interval '1 hour';
END;
$$;

-- H) Criar função para limpar sessões expiradas/revogadas
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions_v2()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.session_tokens 
    WHERE expires_at < now() - interval '7 days'
       OR revoked_at < now() - interval '1 day';
END;
$$;