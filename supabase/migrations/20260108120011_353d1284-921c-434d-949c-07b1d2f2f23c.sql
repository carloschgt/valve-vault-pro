-- Habilitar REPLICA IDENTITY FULL para capturar todas as mudanças
ALTER TABLE public.solicitacoes_codigo REPLICA IDENTITY FULL;