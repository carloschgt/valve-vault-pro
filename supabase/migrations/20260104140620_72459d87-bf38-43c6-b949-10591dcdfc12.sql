-- 1. Adicionar campo peso_kg no catálogo de produtos (se não existir)
ALTER TABLE public.catalogo_produtos 
ADD COLUMN IF NOT EXISTS peso_kg NUMERIC DEFAULT NULL;