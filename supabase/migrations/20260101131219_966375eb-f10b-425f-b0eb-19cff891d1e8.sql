-- Fix architectural inconsistency: Remove RLS write policies that rely on JWT claims
-- Since all write operations go through Edge Functions with service role,
-- these policies are never actually used and create confusion.

-- Remove write policies from fabricantes (reads remain public)
DROP POLICY IF EXISTS "Only admins can insert fabricantes" ON public.fabricantes;
DROP POLICY IF EXISTS "Only admins can update fabricantes" ON public.fabricantes;
DROP POLICY IF EXISTS "Only admins can delete fabricantes" ON public.fabricantes;

-- Remove write policies from catalogo_produtos (reads remain public)
DROP POLICY IF EXISTS "Only admins can insert catalogo_produtos" ON public.catalogo_produtos;
DROP POLICY IF EXISTS "Only admins can update catalogo_produtos" ON public.catalogo_produtos;
DROP POLICY IF EXISTS "Only admins can delete catalogo_produtos" ON public.catalogo_produtos;

-- Remove write policies from enderecos_materiais (reads remain public)
DROP POLICY IF EXISTS "Only admins can insert enderecos_materiais" ON public.enderecos_materiais;
DROP POLICY IF EXISTS "Only admins can update enderecos_materiais" ON public.enderecos_materiais;
DROP POLICY IF EXISTS "Only admins can delete enderecos_materiais" ON public.enderecos_materiais;

-- Remove write policies from inventario (reads remain public)
DROP POLICY IF EXISTS "Only admins can insert inventario" ON public.inventario;
DROP POLICY IF EXISTS "Only admins can update inventario" ON public.inventario;
DROP POLICY IF EXISTS "Only admins can delete inventario" ON public.inventario;

-- Fix the usuarios table: add explicit deny policies so RLS scanner is satisfied
-- This table should ONLY be accessible via Edge Functions with service role
CREATE POLICY "Deny all client access to usuarios"
  ON public.usuarios
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Document the security model with comments
COMMENT ON TABLE public.usuarios IS 'User accounts table. Access restricted to Edge Functions only (service role). Client-side access is denied.';
COMMENT ON TABLE public.fabricantes IS 'Manufacturers table. Reads are public. Writes via data-operations Edge Function only.';
COMMENT ON TABLE public.catalogo_produtos IS 'Product catalog. Reads are public. Writes via data-operations Edge Function only.';
COMMENT ON TABLE public.enderecos_materiais IS 'Material addresses. Reads are public. Writes via data-operations Edge Function only.';
COMMENT ON TABLE public.inventario IS 'Inventory counts. Reads are public. Writes via data-operations Edge Function only.';
COMMENT ON TABLE public.login_logs IS 'Login audit logs. Reads for admins only. Writes via auth Edge Function only.';
COMMENT ON TABLE public.session_tokens IS 'Session tokens for authentication. Access restricted to Edge Functions only.';