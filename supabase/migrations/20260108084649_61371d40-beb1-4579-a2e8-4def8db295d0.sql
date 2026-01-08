-- Tabela de solicitações de código
CREATE TABLE public.solicitacoes_codigo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_solicitacao SERIAL,
  descricao TEXT NOT NULL,
  fabricante_id UUID REFERENCES public.fabricantes(id),
  solicitado_por TEXT NOT NULL,
  solicitado_por_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_processamento', 'codigo_gerado', 'aprovado', 'rejeitado')),
  codigo_gerado TEXT,
  processado_por TEXT,
  processado_por_id UUID,
  processado_em TIMESTAMP WITH TIME ZONE,
  aprovado_por TEXT,
  aprovado_por_id UUID,
  aprovado_em TIMESTAMP WITH TIME ZONE,
  motivo_rejeicao TEXT,
  locked_by_id UUID,
  locked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Trigger para updated_at
CREATE TRIGGER update_solicitacoes_codigo_updated_at
BEFORE UPDATE ON public.solicitacoes_codigo
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de notificações do usuário
CREATE TABLE public.notificacoes_usuario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  lida BOOLEAN NOT NULL DEFAULT false,
  dados JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.solicitacoes_codigo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes_usuario ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Deny all client access (usar edge functions)
CREATE POLICY "Deny all client access to solicitacoes_codigo"
ON public.solicitacoes_codigo
FOR ALL
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny all client access to notificacoes_usuario"
ON public.notificacoes_usuario
FOR ALL
USING (false)
WITH CHECK (false);

-- Habilitar realtime para as tabelas
ALTER PUBLICATION supabase_realtime ADD TABLE public.solicitacoes_codigo;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes_usuario;

-- Index para melhor performance
CREATE INDEX idx_solicitacoes_codigo_status ON public.solicitacoes_codigo(status);
CREATE INDEX idx_solicitacoes_codigo_solicitado_por_id ON public.solicitacoes_codigo(solicitado_por_id);
CREATE INDEX idx_notificacoes_usuario_user_id ON public.notificacoes_usuario(user_id);
CREATE INDEX idx_notificacoes_usuario_lida ON public.notificacoes_usuario(lida);