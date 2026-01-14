-- Adicionar campo descrição_imex na tabela enderecos_materiais
ALTER TABLE public.enderecos_materiais 
ADD COLUMN IF NOT EXISTS descricao_imex TEXT;

-- Comentário para documentação
COMMENT ON COLUMN public.enderecos_materiais.descricao_imex IS 'Descrição IMEX do material, cadastrada pelo time comercial durante processamento de código';