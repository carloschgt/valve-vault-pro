-- Criar enum para status do usuário
CREATE TYPE public.user_status AS ENUM ('pendente', 'ativo', 'suspenso', 'negado');

-- Adicionar coluna status à tabela usuarios
ALTER TABLE public.usuarios 
ADD COLUMN status public.user_status NOT NULL DEFAULT 'pendente';

-- Adicionar coluna suspenso_ate para quando o usuário estiver suspenso
ALTER TABLE public.usuarios 
ADD COLUMN suspenso_ate TIMESTAMP WITH TIME ZONE;

-- Adicionar coluna para rastrear quando o usuário foi notificado sobre aprovação
ALTER TABLE public.usuarios 
ADD COLUMN notificado_aprovacao BOOLEAN NOT NULL DEFAULT false;

-- Migrar dados existentes: aprovado=true => status='ativo', aprovado=false => status='pendente'
UPDATE public.usuarios SET status = 'ativo' WHERE aprovado = true;
UPDATE public.usuarios SET status = 'pendente' WHERE aprovado = false;

-- Criar índice para facilitar busca por status
CREATE INDEX idx_usuarios_status ON public.usuarios(status);