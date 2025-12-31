-- Create table for locally stored manufacturers
CREATE TABLE public.fabricantes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  codigo TEXT NOT NULL UNIQUE,
  data_cadastro TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  cadastrado_por TEXT NOT NULL DEFAULT 'Admin'
);

-- Enable Row Level Security
ALTER TABLE public.fabricantes ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read fabricantes (public data)
CREATE POLICY "Anyone can view fabricantes" 
ON public.fabricantes 
FOR SELECT 
USING (true);

-- Only authenticated users can insert/update/delete
CREATE POLICY "Authenticated users can insert fabricantes" 
ON public.fabricantes 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update fabricantes" 
ON public.fabricantes 
FOR UPDATE 
USING (true);

CREATE POLICY "Authenticated users can delete fabricantes" 
ON public.fabricantes 
FOR DELETE 
USING (true);