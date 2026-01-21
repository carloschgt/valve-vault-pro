-- Atualizar a constraint para incluir o novo status 'removido_pendencia'
ALTER TABLE public.solicitacoes_codigo DROP CONSTRAINT solicitacoes_codigo_status_check;

ALTER TABLE public.solicitacoes_codigo ADD CONSTRAINT solicitacoes_codigo_status_check 
CHECK (status = ANY (ARRAY['pendente'::text, 'em_processamento'::text, 'codigo_gerado'::text, 'aprovado'::text, 'rejeitado'::text, 'removido_pendencia'::text]));