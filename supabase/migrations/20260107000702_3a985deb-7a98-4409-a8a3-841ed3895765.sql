-- Add column to block stock view for common users during inventory
ALTER TABLE public.inventario_config 
ADD COLUMN bloquear_visualizacao_estoque boolean NOT NULL DEFAULT false;