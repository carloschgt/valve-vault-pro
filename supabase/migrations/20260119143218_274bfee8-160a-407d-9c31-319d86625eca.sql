-- =====================================================================
-- MÓDULO DE SEPARAÇÃO DE MATERIAL + CANCELAMENTO/DEVOLUÇÃO
-- =====================================================================

-- 1) TABELA: material_transactions (Auditoria de Movimentações)
-- =====================================================================
CREATE TYPE public.tipo_transacao AS ENUM (
  'RECEBIMENTO',
  'ARMAZENAGEM_ENTRADA',
  'RESERVA_SAIDA_ARMAZENAGEM',
  'ENTRADA_AREA_SEPARACAO',
  'SEPARACAO_INICIO',
  'SEPARACAO_CONFIRMADA',
  'SEPARACAO_FIM',
  'CANCELAMENTO_CRIADO',
  'SAIDA_AREA_SEPARACAO',
  'DEVOLUCAO_ENTRADA_ARMAZENAGEM',
  'AJUSTE'
);

CREATE TABLE public.material_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_hora TIMESTAMPTZ NOT NULL DEFAULT now(),
  tipo_transacao tipo_transacao NOT NULL,
  codigo_item TEXT NOT NULL,
  fornecedor TEXT,
  qtd INTEGER NOT NULL,
  endereco TEXT,
  local TEXT,
  referencia TEXT,
  usuario TEXT NOT NULL,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for common queries
CREATE INDEX idx_material_transactions_codigo ON public.material_transactions(codigo_item);
CREATE INDEX idx_material_transactions_data ON public.material_transactions(data_hora DESC);
CREATE INDEX idx_material_transactions_referencia ON public.material_transactions(referencia);
CREATE INDEX idx_material_transactions_tipo ON public.material_transactions(tipo_transacao);

-- Enable RLS
ALTER TABLE public.material_transactions ENABLE ROW LEVEL SECURITY;

-- Deny all client access (only through edge functions)
CREATE POLICY "Deny all client access to material_transactions"
ON public.material_transactions
FOR ALL
USING (false)
WITH CHECK (false);

-- 2) TABELA: sep_solicitacoes (Cabeçalho da lista IMEX)
-- =====================================================================
CREATE TYPE public.status_solicitacao AS ENUM (
  'Rascunho',
  'Enviada',
  'EmSeparacao',
  'Parcial',
  'Concluida',
  'Cancelada'
);

CREATE TABLE public.sep_solicitacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_lista TEXT NOT NULL UNIQUE,
  status status_solicitacao NOT NULL DEFAULT 'Rascunho',
  criado_por TEXT NOT NULL,
  criado_por_id UUID NOT NULL,
  data_abertura TIMESTAMPTZ,
  data_inicio_estoque TIMESTAMPTZ,
  data_conclusao TIMESTAMPTZ,
  observacoes_comercial TEXT,
  observacoes_estoque TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Computed SLA columns via generated columns (PostgreSQL 12+)
-- sla_inicio_min: minutes between data_abertura and data_inicio_estoque
-- sla_total_min: minutes between data_abertura and data_conclusao

CREATE INDEX idx_sep_solicitacoes_status ON public.sep_solicitacoes(status);
CREATE INDEX idx_sep_solicitacoes_criado_por ON public.sep_solicitacoes(criado_por_id);
CREATE INDEX idx_sep_solicitacoes_data ON public.sep_solicitacoes(created_at DESC);

ALTER TABLE public.sep_solicitacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny all client access to sep_solicitacoes"
ON public.sep_solicitacoes
FOR ALL
USING (false)
WITH CHECK (false);

-- Trigger for updated_at
CREATE TRIGGER update_sep_solicitacoes_updated_at
BEFORE UPDATE ON public.sep_solicitacoes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 3) TABELA: sep_linhas (Linhas da lista – 1 linha por Pedido+Item+Código)
-- =====================================================================
CREATE TYPE public.status_linha_sep AS ENUM (
  'Pendente',
  'FaltaPrioridade',
  'Separando',
  'Parcial',
  'Separado',
  'CompraNecessaria',
  'Cancelado'
);

CREATE TABLE public.sep_linhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id UUID NOT NULL REFERENCES public.sep_solicitacoes(id) ON DELETE CASCADE,
  pedido_cliente TEXT NOT NULL,
  item_cliente TEXT,
  codigo_item TEXT NOT NULL,
  fornecedor TEXT,
  qtd_solicitada INTEGER NOT NULL CHECK (qtd_solicitada > 0),
  prioridade INTEGER,
  qtd_disponivel_snapshot INTEGER,
  qtd_reservada INTEGER NOT NULL DEFAULT 0,
  qtd_separada INTEGER NOT NULL DEFAULT 0,
  status_linha status_linha_sep NOT NULL DEFAULT 'Pendente',
  obs_estoque TEXT,
  obs_comercial TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sep_linhas_solicitacao ON public.sep_linhas(solicitacao_id);
CREATE INDEX idx_sep_linhas_codigo ON public.sep_linhas(codigo_item);
CREATE INDEX idx_sep_linhas_pedido ON public.sep_linhas(pedido_cliente);
CREATE INDEX idx_sep_linhas_status ON public.sep_linhas(status_linha);

ALTER TABLE public.sep_linhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny all client access to sep_linhas"
ON public.sep_linhas
FOR ALL
USING (false)
WITH CHECK (false);

CREATE TRIGGER update_sep_linhas_updated_at
BEFORE UPDATE ON public.sep_linhas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 4) TABELA: sep_alocacoes (De qual endereço o estoque retirou)
-- =====================================================================
CREATE TYPE public.status_alocacao AS ENUM (
  'Reservado',
  'Separado',
  'Devolvido'
);

CREATE TABLE public.sep_alocacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  linha_id UUID NOT NULL REFERENCES public.sep_linhas(id) ON DELETE CASCADE,
  endereco_material_id UUID NOT NULL REFERENCES public.enderecos_materiais(id),
  rua INTEGER NOT NULL,
  coluna INTEGER NOT NULL,
  nivel INTEGER NOT NULL,
  posicao INTEGER NOT NULL,
  qtd_retirada INTEGER NOT NULL CHECK (qtd_retirada > 0),
  qtd_devolvida INTEGER NOT NULL DEFAULT 0,
  data_hora TIMESTAMPTZ NOT NULL DEFAULT now(),
  usuario_estoque TEXT NOT NULL,
  destino_local TEXT NOT NULL DEFAULT 'AREA_SEPARACAO',
  status status_alocacao NOT NULL DEFAULT 'Reservado',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sep_alocacoes_linha ON public.sep_alocacoes(linha_id);
CREATE INDEX idx_sep_alocacoes_endereco ON public.sep_alocacoes(endereco_material_id);
CREATE INDEX idx_sep_alocacoes_status ON public.sep_alocacoes(status);

ALTER TABLE public.sep_alocacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny all client access to sep_alocacoes"
ON public.sep_alocacoes
FOR ALL
USING (false)
WITH CHECK (false);

-- 5) TABELA: area_separacao_resumo (Saldo físico na área de separação)
-- =====================================================================
CREATE TABLE public.area_separacao_resumo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_item TEXT NOT NULL UNIQUE,
  qtd_em_separacao INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_area_separacao_codigo ON public.area_separacao_resumo(codigo_item);

ALTER TABLE public.area_separacao_resumo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny all client access to area_separacao_resumo"
ON public.area_separacao_resumo
FOR ALL
USING (false)
WITH CHECK (false);

-- 6) TABELA: cancelamentos (Cabeçalho de cancelamento)
-- =====================================================================
CREATE TYPE public.status_cancelamento AS ENUM (
  'Aberto',
  'EmProcesso',
  'Concluido',
  'Cancelado'
);

CREATE TABLE public.cancelamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_cliente TEXT NOT NULL,
  criado_por TEXT NOT NULL,
  criado_por_id UUID NOT NULL,
  data_cancelamento TIMESTAMPTZ NOT NULL DEFAULT now(),
  motivo TEXT,
  status status_cancelamento NOT NULL DEFAULT 'Aberto',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cancelamentos_pedido ON public.cancelamentos(pedido_cliente);
CREATE INDEX idx_cancelamentos_status ON public.cancelamentos(status);
CREATE INDEX idx_cancelamentos_criado ON public.cancelamentos(criado_por_id);

ALTER TABLE public.cancelamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny all client access to cancelamentos"
ON public.cancelamentos
FOR ALL
USING (false)
WITH CHECK (false);

CREATE TRIGGER update_cancelamentos_updated_at
BEFORE UPDATE ON public.cancelamentos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 7) TABELA: cancelamentos_linhas (Linhas do cancelamento)
-- =====================================================================
CREATE TYPE public.status_linha_cancelamento AS ENUM (
  'PendenteDevolucao',
  'Devolvendo',
  'DevolvidoTotal'
);

CREATE TABLE public.cancelamentos_linhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cancelamento_id UUID NOT NULL REFERENCES public.cancelamentos(id) ON DELETE CASCADE,
  codigo_item TEXT NOT NULL,
  fornecedor TEXT,
  qtd_cancelada INTEGER NOT NULL CHECK (qtd_cancelada > 0),
  qtd_devolvida_total INTEGER NOT NULL DEFAULT 0,
  status_linha status_linha_cancelamento NOT NULL DEFAULT 'PendenteDevolucao',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cancelamentos_linhas_cancelamento ON public.cancelamentos_linhas(cancelamento_id);
CREATE INDEX idx_cancelamentos_linhas_codigo ON public.cancelamentos_linhas(codigo_item);
CREATE INDEX idx_cancelamentos_linhas_status ON public.cancelamentos_linhas(status_linha);

ALTER TABLE public.cancelamentos_linhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny all client access to cancelamentos_linhas"
ON public.cancelamentos_linhas
FOR ALL
USING (false)
WITH CHECK (false);

CREATE TRIGGER update_cancelamentos_linhas_updated_at
BEFORE UPDATE ON public.cancelamentos_linhas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 8) TABELA: devolucoes_alocacoes (Endereçamento da devolução)
-- =====================================================================
CREATE TABLE public.devolucoes_alocacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cancelamento_linha_id UUID NOT NULL REFERENCES public.cancelamentos_linhas(id) ON DELETE CASCADE,
  endereco_material_id UUID NOT NULL REFERENCES public.enderecos_materiais(id),
  rua INTEGER NOT NULL,
  coluna INTEGER NOT NULL,
  nivel INTEGER NOT NULL,
  posicao INTEGER NOT NULL,
  qtd_devolvida INTEGER NOT NULL CHECK (qtd_devolvida > 0),
  data_hora TIMESTAMPTZ NOT NULL DEFAULT now(),
  usuario_estoque TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_devolucoes_alocacoes_linha ON public.devolucoes_alocacoes(cancelamento_linha_id);
CREATE INDEX idx_devolucoes_alocacoes_endereco ON public.devolucoes_alocacoes(endereco_material_id);

ALTER TABLE public.devolucoes_alocacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny all client access to devolucoes_alocacoes"
ON public.devolucoes_alocacoes
FOR ALL
USING (false)
WITH CHECK (false);

-- 9) Adicionar campo qtd_reservada ao inventario para rastrear reservas
-- =====================================================================
ALTER TABLE public.inventario 
ADD COLUMN IF NOT EXISTS qtd_reservada INTEGER NOT NULL DEFAULT 0;