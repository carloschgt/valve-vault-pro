-- =============================================
-- GESTÃO DE SALDO ALOCADO POR LOCAL (WIP/QUALIDADE/etc)
-- =============================================

-- 1) Tabela de alocações de estoque fora do estoque endereçado
CREATE TABLE public.estoque_alocacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL,
  local text NOT NULL CHECK (local IN ('WIP','QUALIDADE','QUALIDADE_REPROVADO','EXPEDICAO')),
  quantidade integer NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  UNIQUE (codigo, local)
);

-- 2) Tabela de auditoria de movimentos de estoque
CREATE TABLE public.estoque_movimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL,
  origem_local text NOT NULL CHECK (origem_local IN ('ESTOQUE','WIP','QUALIDADE','QUALIDADE_REPROVADO','EXPEDICAO')),
  origem_endereco_id uuid NULL,
  destino_local text NOT NULL CHECK (destino_local IN ('ESTOQUE','WIP','QUALIDADE','QUALIDADE_REPROVADO','EXPEDICAO','SAIDA_CLIENTE')),
  destino_endereco_id uuid NULL,
  quantidade integer NOT NULL CHECK (quantidade > 0),
  motivo text,
  nf_numero text NULL,
  referencia text NULL,
  criado_por text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- NF obrigatório quando destino_local='SAIDA_CLIENTE'
  CONSTRAINT nf_obrigatoria_saida_cliente CHECK (
    destino_local <> 'SAIDA_CLIENTE' OR (nf_numero IS NOT NULL AND length(trim(nf_numero)) > 0)
  )
);

-- 3) Índices para performance
CREATE INDEX idx_estoque_alocacoes_codigo ON public.estoque_alocacoes (codigo);
CREATE INDEX idx_estoque_movimentos_codigo_data ON public.estoque_movimentos (codigo, created_at DESC);
CREATE INDEX idx_estoque_movimentos_destino_data ON public.estoque_movimentos (destino_local, created_at DESC);

-- 4) Habilitar RLS e negar acesso direto do client
ALTER TABLE public.estoque_alocacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_movimentos ENABLE ROW LEVEL SECURITY;

-- Policy para negar acesso direto (acesso será via Edge Function com service role)
CREATE POLICY "Deny all client access to estoque_alocacoes" ON public.estoque_alocacoes
  AS RESTRICTIVE FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Deny all client access to estoque_movimentos" ON public.estoque_movimentos
  AS RESTRICTIVE FOR ALL
  USING (false)
  WITH CHECK (false);