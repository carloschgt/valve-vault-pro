-- Política para que apenas o service role possa manipular os tokens de reset
-- Não há necessidade de acesso público a essa tabela
CREATE POLICY "Service role full access on password_reset_tokens"
ON public.password_reset_tokens
FOR ALL
USING (false)
WITH CHECK (false);