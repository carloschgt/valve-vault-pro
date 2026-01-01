-- Fix broken RLS policies for catalogo_produtos
-- Drop existing broken policies
DROP POLICY IF EXISTS "Only admins can insert catalogo_produtos" ON public.catalogo_produtos;
DROP POLICY IF EXISTS "Only admins can update catalogo_produtos" ON public.catalogo_produtos;
DROP POLICY IF EXISTS "Only admins can delete catalogo_produtos" ON public.catalogo_produtos;

-- Create proper admin-only policies using is_admin_user function
CREATE POLICY "Only admins can insert catalogo_produtos"
ON public.catalogo_produtos FOR INSERT
WITH CHECK (public.is_admin_user(((current_setting('request.jwt.claims'::text, true))::json ->> 'email'::text)));

CREATE POLICY "Only admins can update catalogo_produtos"
ON public.catalogo_produtos FOR UPDATE
USING (public.is_admin_user(((current_setting('request.jwt.claims'::text, true))::json ->> 'email'::text)));

CREATE POLICY "Only admins can delete catalogo_produtos"
ON public.catalogo_produtos FOR DELETE
USING (public.is_admin_user(((current_setting('request.jwt.claims'::text, true))::json ->> 'email'::text)));