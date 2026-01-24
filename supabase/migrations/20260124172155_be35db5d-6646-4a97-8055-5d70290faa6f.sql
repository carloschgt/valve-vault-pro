-- =============================================
-- ADICIONAR OIA COMO LOCAL DE ALOCAÇÃO FORA DO ESTOQUE
-- =============================================

-- 1) Atualizar constraint da tabela estoque_alocacoes para incluir OIA
ALTER TABLE public.estoque_alocacoes DROP CONSTRAINT IF EXISTS estoque_alocacoes_local_check;
ALTER TABLE public.estoque_alocacoes ADD CONSTRAINT estoque_alocacoes_local_check 
  CHECK (local IN ('WIP','QUALIDADE','QUALIDADE_REPROVADO','EXPEDICAO','OIA'));

-- 2) Atualizar constraint origem_local da tabela estoque_movimentos para incluir OIA
ALTER TABLE public.estoque_movimentos DROP CONSTRAINT IF EXISTS estoque_movimentos_origem_local_check;
ALTER TABLE public.estoque_movimentos ADD CONSTRAINT estoque_movimentos_origem_local_check 
  CHECK (origem_local IN ('ESTOQUE','WIP','QUALIDADE','QUALIDADE_REPROVADO','EXPEDICAO','OIA'));

-- 3) Atualizar constraint destino_local da tabela estoque_movimentos para incluir OIA
ALTER TABLE public.estoque_movimentos DROP CONSTRAINT IF EXISTS estoque_movimentos_destino_local_check;
ALTER TABLE public.estoque_movimentos ADD CONSTRAINT estoque_movimentos_destino_local_check 
  CHECK (destino_local IN ('ESTOQUE','WIP','QUALIDADE','QUALIDADE_REPROVADO','EXPEDICAO','OIA','SAIDA_CLIENTE'));