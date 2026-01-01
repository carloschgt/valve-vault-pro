-- Adicionar campos para inativação de endereços/materiais
ALTER TABLE public.enderecos_materiais
ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS inativado_por text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS data_inativacao timestamp with time zone DEFAULT NULL;

-- Adicionar campo para inativação de catálogo de produtos
ALTER TABLE public.catalogo_produtos
ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS inativado_por text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS data_inativacao timestamp with time zone DEFAULT NULL;