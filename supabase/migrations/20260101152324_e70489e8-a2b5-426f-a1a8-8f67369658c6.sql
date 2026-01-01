-- Fix security: Remove public SELECT policies and restrict access to service role only

-- ============================================
-- 1. DROP all public SELECT policies
-- ============================================

DROP POLICY IF EXISTS "Anyone can view catalogo_produtos" ON public.catalogo_produtos;
DROP POLICY IF EXISTS "Anyone can view enderecos_materiais" ON public.enderecos_materiais;
DROP POLICY IF EXISTS "Anyone can view inventario" ON public.inventario;
DROP POLICY IF EXISTS "Anyone can view fabricantes" ON public.fabricantes;

-- ============================================
-- 2. Fix session_tokens - remove conflicting policies
-- ============================================

-- Drop the overly permissive service role SELECT policy that's causing exposure
DROP POLICY IF EXISTS "Service role can select session_tokens" ON public.session_tokens;
DROP POLICY IF EXISTS "Deny public access to session_tokens" ON public.session_tokens;
DROP POLICY IF EXISTS "Service role can insert session_tokens" ON public.session_tokens;
DROP POLICY IF EXISTS "Service role can delete session_tokens" ON public.session_tokens;

-- Create a single deny policy for session_tokens (service role bypasses RLS anyway)
CREATE POLICY "Deny all client access to session_tokens"
ON public.session_tokens
FOR ALL
USING (false)
WITH CHECK (false);

-- ============================================
-- 3. Create deny-all policies for business data tables
--    (Service role from Edge Functions will bypass RLS)
-- ============================================

-- catalogo_produtos: deny all client access
CREATE POLICY "Deny all client access to catalogo_produtos"
ON public.catalogo_produtos
FOR ALL
USING (false)
WITH CHECK (false);

-- enderecos_materiais: deny all client access  
CREATE POLICY "Deny all client access to enderecos_materiais"
ON public.enderecos_materiais
FOR ALL
USING (false)
WITH CHECK (false);

-- inventario: deny all client access
CREATE POLICY "Deny all client access to inventario"
ON public.inventario
FOR ALL
USING (false)
WITH CHECK (false);

-- fabricantes: deny all client access
CREATE POLICY "Deny all client access to fabricantes"
ON public.fabricantes
FOR ALL
USING (false)
WITH CHECK (false);