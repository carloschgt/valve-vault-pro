-- Fix overly permissive RLS policies on notificacoes_usuario
-- This app uses edge functions with service role, so we deny direct client access

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Allow authenticated users to read notifications" ON public.notificacoes_usuario;
DROP POLICY IF EXISTS "Allow authenticated users to update notifications" ON public.notificacoes_usuario;
DROP POLICY IF EXISTS "Allow insert for service role" ON public.notificacoes_usuario;

-- Create restrictive policies that deny all client access
-- The edge functions use service role which bypasses RLS
CREATE POLICY "Deny all client access to notificacoes_usuario"
ON public.notificacoes_usuario
FOR ALL
USING (false)
WITH CHECK (false);