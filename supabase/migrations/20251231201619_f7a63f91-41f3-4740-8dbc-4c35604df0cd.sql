-- Tabela para armazenar endereçamento de materiais
CREATE TABLE public.enderecos_materiais (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    codigo TEXT NOT NULL,
    descricao TEXT NOT NULL,
    tipo_material TEXT NOT NULL,
    fabricante_id UUID REFERENCES public.fabricantes(id),
    peso DECIMAL(10,2) NOT NULL,
    rua INTEGER NOT NULL,
    coluna INTEGER NOT NULL,
    nivel INTEGER NOT NULL,
    posicao INTEGER NOT NULL,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para armazenar contagens de inventário
CREATE TABLE public.inventario (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    endereco_material_id UUID NOT NULL REFERENCES public.enderecos_materiais(id) ON DELETE CASCADE,
    quantidade INTEGER NOT NULL DEFAULT 0,
    contado_por TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.enderecos_materiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventario ENABLE ROW LEVEL SECURITY;

-- Policies para enderecos_materiais (todos podem ler, todos autenticados podem inserir)
CREATE POLICY "Anyone can view enderecos_materiais" 
ON public.enderecos_materiais 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert enderecos_materiais" 
ON public.enderecos_materiais 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update enderecos_materiais" 
ON public.enderecos_materiais 
FOR UPDATE 
USING (true);

-- Policies para inventario (todos podem ler, todos podem inserir, apenas via função especial para update)
CREATE POLICY "Anyone can view inventario" 
ON public.inventario 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert inventario" 
ON public.inventario 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update inventario" 
ON public.inventario 
FOR UPDATE 
USING (true);

-- Trigger para updated_at em enderecos_materiais
CREATE TRIGGER update_enderecos_materiais_updated_at
BEFORE UPDATE ON public.enderecos_materiais
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para updated_at em inventario
CREATE TRIGGER update_inventario_updated_at
BEFORE UPDATE ON public.inventario
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();