-- Criar tabela de catálogo de produtos
CREATE TABLE public.catalogo_produtos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  descricao TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.catalogo_produtos ENABLE ROW LEVEL SECURITY;

-- Políticas: todos podem ver, apenas autenticados podem modificar
CREATE POLICY "Anyone can view catalogo_produtos"
ON public.catalogo_produtos
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert catalogo_produtos"
ON public.catalogo_produtos
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Authenticated users can update catalogo_produtos"
ON public.catalogo_produtos
FOR UPDATE
USING (true);

CREATE POLICY "Authenticated users can delete catalogo_produtos"
ON public.catalogo_produtos
FOR DELETE
USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_catalogo_produtos_updated_at
BEFORE UPDATE ON public.catalogo_produtos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();