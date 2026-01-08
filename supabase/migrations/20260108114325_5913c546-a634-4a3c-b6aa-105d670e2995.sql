-- Remove a constraint antiga
ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_tipo_check;

-- Adiciona a nova constraint com todos os perfis permitidos
ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_tipo_check 
CHECK (tipo = ANY (ARRAY['admin'::text, 'user'::text, 'estoque'::text, 'comercial'::text]));