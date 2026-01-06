-- Tabela para controle de contagem por rua
CREATE TABLE public.inventario_config_rua (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rua INTEGER NOT NULL,
  contagem_ativa INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by TEXT,
  UNIQUE(rua)
);

-- Tabela para seleção de itens específicos para contagem
-- Permite admin selecionar quais códigos devem ser contados em cada fase/rua
CREATE TABLE public.inventario_selecao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  endereco_material_id UUID NOT NULL REFERENCES public.enderecos_materiais(id) ON DELETE CASCADE,
  contagem_num INTEGER NOT NULL,
  rua INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by TEXT NOT NULL,
  UNIQUE(endereco_material_id, contagem_num)
);

-- Enable RLS
ALTER TABLE public.inventario_config_rua ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventario_selecao ENABLE ROW LEVEL SECURITY;

-- RLS policies - deny direct client access (use edge functions)
CREATE POLICY "Deny all client access to inventario_config_rua" 
ON public.inventario_config_rua 
FOR ALL 
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny all client access to inventario_selecao" 
ON public.inventario_selecao 
FOR ALL 
USING (false)
WITH CHECK (false);

-- Trigger for updated_at on inventario_config_rua
CREATE TRIGGER update_inventario_config_rua_updated_at
BEFORE UPDATE ON public.inventario_config_rua
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();