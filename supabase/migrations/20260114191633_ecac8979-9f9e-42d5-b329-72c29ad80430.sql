-- Create audit table for tracking changes to enderecos_materiais
CREATE TABLE public.enderecos_materiais_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  endereco_material_id UUID NOT NULL,
  codigo TEXT NOT NULL,
  acao TEXT NOT NULL, -- 'criacao', 'alteracao_descricao', 'alteracao_descricao_imex', 'alteracao_status', 'alteracao_endereco'
  campo_alterado TEXT, -- which field was changed
  valor_anterior TEXT, -- previous value
  valor_novo TEXT, -- new value
  usuario_nome TEXT NOT NULL,
  usuario_email TEXT NOT NULL,
  usuario_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.enderecos_materiais_audit ENABLE ROW LEVEL SECURITY;

-- Only allow access via service role (edge functions)
CREATE POLICY "Deny all client access to enderecos_materiais_audit" 
ON public.enderecos_materiais_audit 
FOR ALL 
USING (false)
WITH CHECK (false);

-- Create index for faster lookups by codigo
CREATE INDEX idx_enderecos_materiais_audit_codigo ON public.enderecos_materiais_audit(codigo);
CREATE INDEX idx_enderecos_materiais_audit_endereco_material_id ON public.enderecos_materiais_audit(endereco_material_id);
CREATE INDEX idx_enderecos_materiais_audit_created_at ON public.enderecos_materiais_audit(created_at DESC);