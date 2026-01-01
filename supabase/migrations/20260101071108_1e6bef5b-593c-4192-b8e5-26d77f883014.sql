-- Fix overly permissive RLS policies for fabricantes, enderecos_materiais, and inventario
-- Restrict write operations to admin users only

-- Drop existing overly permissive policies for fabricantes
DROP POLICY IF EXISTS "Authenticated users can insert fabricantes" ON public.fabricantes;
DROP POLICY IF EXISTS "Authenticated users can update fabricantes" ON public.fabricantes;
DROP POLICY IF EXISTS "Authenticated users can delete fabricantes" ON public.fabricantes;

-- Create admin-only policies for fabricantes
CREATE POLICY "Only admins can insert fabricantes" ON public.fabricantes
FOR INSERT WITH CHECK (
  public.is_admin_user((current_setting('request.jwt.claims', true)::json->>'email'))
);

CREATE POLICY "Only admins can update fabricantes" ON public.fabricantes
FOR UPDATE USING (
  public.is_admin_user((current_setting('request.jwt.claims', true)::json->>'email'))
);

CREATE POLICY "Only admins can delete fabricantes" ON public.fabricantes
FOR DELETE USING (
  public.is_admin_user((current_setting('request.jwt.claims', true)::json->>'email'))
);

-- Drop existing overly permissive policies for enderecos_materiais
DROP POLICY IF EXISTS "Authenticated users can insert enderecos_materiais" ON public.enderecos_materiais;
DROP POLICY IF EXISTS "Authenticated users can update enderecos_materiais" ON public.enderecos_materiais;

-- Create admin-only policies for enderecos_materiais
CREATE POLICY "Only admins can insert enderecos_materiais" ON public.enderecos_materiais
FOR INSERT WITH CHECK (
  public.is_admin_user((current_setting('request.jwt.claims', true)::json->>'email'))
);

CREATE POLICY "Only admins can update enderecos_materiais" ON public.enderecos_materiais
FOR UPDATE USING (
  public.is_admin_user((current_setting('request.jwt.claims', true)::json->>'email'))
);

CREATE POLICY "Only admins can delete enderecos_materiais" ON public.enderecos_materiais
FOR DELETE USING (
  public.is_admin_user((current_setting('request.jwt.claims', true)::json->>'email'))
);

-- Drop existing overly permissive policies for inventario
DROP POLICY IF EXISTS "Authenticated users can insert inventario" ON public.inventario;
DROP POLICY IF EXISTS "Authenticated users can update inventario" ON public.inventario;

-- Create admin-only policies for inventario
CREATE POLICY "Only admins can insert inventario" ON public.inventario
FOR INSERT WITH CHECK (
  public.is_admin_user((current_setting('request.jwt.claims', true)::json->>'email'))
);

CREATE POLICY "Only admins can update inventario" ON public.inventario
FOR UPDATE USING (
  public.is_admin_user((current_setting('request.jwt.claims', true)::json->>'email'))
);

CREATE POLICY "Only admins can delete inventario" ON public.inventario
FOR DELETE USING (
  public.is_admin_user((current_setting('request.jwt.claims', true)::json->>'email'))
);