-- Adicionar campo de comentário na tabela enderecos_materiais
ALTER TABLE public.enderecos_materiais 
ADD COLUMN IF NOT EXISTS comentario TEXT;

-- Adicionar campo de comentário na tabela inventario
ALTER TABLE public.inventario 
ADD COLUMN IF NOT EXISTS comentario TEXT;