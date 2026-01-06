-- Remove a política que bloqueia todo acesso
DROP POLICY IF EXISTS "Deny all client access to catalogo_produtos" ON public.catalogo_produtos;

-- Cria política que permite SELECT para todos (leitura pública)
CREATE POLICY "Allow public read access to catalogo_produtos" 
ON public.catalogo_produtos 
FOR SELECT 
USING (true);

-- Mantém INSERT/UPDATE/DELETE apenas via edge functions (service_role)