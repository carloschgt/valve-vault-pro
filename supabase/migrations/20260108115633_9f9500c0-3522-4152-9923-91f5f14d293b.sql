-- Adicionar campos de tipo_material e peso na tabela solicitacoes_codigo
ALTER TABLE public.solicitacoes_codigo 
ADD COLUMN IF NOT EXISTS tipo_material text,
ADD COLUMN IF NOT EXISTS peso numeric;

-- Comentários explicativos
COMMENT ON COLUMN public.solicitacoes_codigo.tipo_material IS 'Tipo do material (obrigatório na solicitação)';
COMMENT ON COLUMN public.solicitacoes_codigo.peso IS 'Peso unitário do material em kg (opcional)';