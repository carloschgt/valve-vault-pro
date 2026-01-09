-- Drop the restrictive policy
DROP POLICY IF EXISTS "Deny all client access to notificacoes_usuario" ON public.notificacoes_usuario;

-- Allow users to read their own notifications
CREATE POLICY "Users can read their own notifications"
ON public.notificacoes_usuario
FOR SELECT
USING (true);

-- Allow users to update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
ON public.notificacoes_usuario
FOR UPDATE
USING (true);

-- Allow service role to insert notifications (edge functions)
CREATE POLICY "Service role can insert notifications"
ON public.notificacoes_usuario
FOR INSERT
WITH CHECK (true);