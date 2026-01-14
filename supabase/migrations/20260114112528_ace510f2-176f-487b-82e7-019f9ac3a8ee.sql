-- Remover a constraint fixa para permitir perfis dinâmicos
ALTER TABLE public.usuarios DROP CONSTRAINT usuarios_tipo_check;