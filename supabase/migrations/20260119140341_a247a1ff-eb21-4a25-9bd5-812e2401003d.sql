-- Add input validation to SECURITY DEFINER functions

-- Update is_admin_user function with input validation
CREATE OR REPLACE FUNCTION public.is_admin_user(user_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  email_lower TEXT;
BEGIN
  -- Validate input: NULL check and length limit
  IF user_email IS NULL OR length(user_email) > 320 THEN
    RETURN FALSE;
  END IF;
  
  email_lower := lower(trim(user_email));
  
  -- Validate email format (basic check)
  IF email_lower !~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$' THEN
    RETURN FALSE;
  END IF;
  
  RETURN EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE email = email_lower AND tipo = 'admin'
  );
END;
$$;

-- Update get_user_id_by_email function with input validation
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(user_email TEXT)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  email_lower TEXT;
  user_uuid UUID;
BEGIN
  -- Validate input: NULL check and length limit
  IF user_email IS NULL OR length(user_email) > 320 THEN
    RETURN NULL;
  END IF;
  
  email_lower := lower(trim(user_email));
  
  -- Validate email format (basic check)
  IF email_lower !~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$' THEN
    RETURN NULL;
  END IF;
  
  SELECT id INTO user_uuid FROM public.usuarios 
  WHERE email = email_lower LIMIT 1;
  
  RETURN user_uuid;
END;
$$;