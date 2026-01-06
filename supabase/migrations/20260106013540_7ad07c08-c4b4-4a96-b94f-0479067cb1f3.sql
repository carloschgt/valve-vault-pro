-- First, remove duplicates keeping only the most recent record for each endereco_material_id
DELETE FROM public.inventario a
USING public.inventario b
WHERE a.endereco_material_id = b.endereco_material_id
  AND a.id < b.id;

-- Now add the contagem_num column
ALTER TABLE public.inventario
ADD COLUMN IF NOT EXISTS contagem_num integer NOT NULL DEFAULT 1 CHECK (contagem_num >= 1 AND contagem_num <= 3);

-- Add unique constraint to prevent duplicate counts for same material/counting phase
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventario_unique_contagem 
ON public.inventario (endereco_material_id, contagem_num);

-- Create global counting config table
CREATE TABLE IF NOT EXISTS public.inventario_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contagem_ativa integer NOT NULL DEFAULT 1 CHECK (contagem_ativa >= 1 AND contagem_ativa <= 3),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by text
);

-- Enable RLS on config table
ALTER TABLE public.inventario_config ENABLE ROW LEVEL SECURITY;

-- Deny all client access (only via edge functions)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'inventario_config' 
    AND policyname = 'Deny all client access to inventario_config'
  ) THEN
    CREATE POLICY "Deny all client access to inventario_config" 
    ON public.inventario_config 
    AS RESTRICTIVE
    FOR ALL 
    USING (false) 
    WITH CHECK (false);
  END IF;
END $$;

-- Insert default config if not exists
INSERT INTO public.inventario_config (contagem_ativa)
SELECT 1
WHERE NOT EXISTS (SELECT 1 FROM public.inventario_config);

-- Add edit audit table for inventory changes
CREATE TABLE IF NOT EXISTS public.inventario_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inventario_id uuid NOT NULL,
  quantidade_anterior integer NOT NULL,
  quantidade_nova integer NOT NULL,
  motivo text NOT NULL,
  editado_por text NOT NULL,
  editado_em timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on audit table
ALTER TABLE public.inventario_audit ENABLE ROW LEVEL SECURITY;

-- Deny all client access to audit table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'inventario_audit' 
    AND policyname = 'Deny all client access to inventario_audit'
  ) THEN
    CREATE POLICY "Deny all client access to inventario_audit" 
    ON public.inventario_audit 
    AS RESTRICTIVE
    FOR ALL 
    USING (false) 
    WITH CHECK (false);
  END IF;
END $$;