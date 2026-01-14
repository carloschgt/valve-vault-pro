-- Atualizar a constraint usuarios_tipo_check para incluir 'compras'
ALTER TABLE public.usuarios DROP CONSTRAINT usuarios_tipo_check;

ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_tipo_check 
CHECK (tipo = ANY (ARRAY['admin'::text, 'user'::text, 'estoque'::text, 'comercial'::text, 'compras'::text]));