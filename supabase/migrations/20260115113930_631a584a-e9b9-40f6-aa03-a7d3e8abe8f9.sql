-- Add new fields to catalogo_produtos for IMEX description and unit value
ALTER TABLE public.catalogo_produtos 
ADD COLUMN IF NOT EXISTS descricao_imex TEXT,
ADD COLUMN IF NOT EXISTS valor_unitario NUMERIC(12, 2);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_catalogo_produtos_valor ON public.catalogo_produtos(valor_unitario) WHERE valor_unitario IS NOT NULL;