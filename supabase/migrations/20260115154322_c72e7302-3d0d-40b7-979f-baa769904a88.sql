-- Adicionar campo descricao_imex na tabela solicitacoes_codigo
ALTER TABLE public.solicitacoes_codigo 
ADD COLUMN descricao_imex text DEFAULT NULL;