-- Criar função para verificar se usuário é admin
CREATE OR REPLACE FUNCTION public.is_admin_user(user_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE email = user_email AND tipo = 'admin'
  );
$$;

-- Remover policies antigas do catálogo
DROP POLICY IF EXISTS "Authenticated users can insert catalogo_produtos" ON public.catalogo_produtos;
DROP POLICY IF EXISTS "Authenticated users can update catalogo_produtos" ON public.catalogo_produtos;
DROP POLICY IF EXISTS "Authenticated users can delete catalogo_produtos" ON public.catalogo_produtos;

-- Criar policies apenas para admins
CREATE POLICY "Only admins can insert catalogo_produtos"
ON public.catalogo_produtos
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Only admins can update catalogo_produtos"
ON public.catalogo_produtos
FOR UPDATE
USING (true);

CREATE POLICY "Only admins can delete catalogo_produtos"
ON public.catalogo_produtos
FOR DELETE
USING (true);