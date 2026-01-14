-- Tabela de perfis de usuário
CREATE TABLE public.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  descricao text,
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by text
);

-- Tabela de permissões por perfil
CREATE TABLE public.profile_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  menu_key text NOT NULL,
  can_access boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(profile_id, menu_key)
);

-- Índices
CREATE INDEX idx_profile_permissions_profile ON public.profile_permissions(profile_id);
CREATE INDEX idx_user_profiles_nome ON public.user_profiles(nome);

-- Habilitar RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_permissions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS - Negar acesso direto (usar Edge Functions)
CREATE POLICY "Deny all client access to user_profiles"
  ON public.user_profiles FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Deny all client access to profile_permissions"
  ON public.profile_permissions FOR ALL
  USING (false)
  WITH CHECK (false);

-- Trigger para updated_at
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir perfis existentes do sistema
INSERT INTO public.user_profiles (nome, descricao, is_system, created_by) VALUES
  ('admin', 'Administrador com acesso total ao sistema', true, 'system'),
  ('user', 'Usuário padrão com acesso básico', true, 'system'),
  ('estoque', 'Usuário do setor de estoque', true, 'system'),
  ('comercial', 'Usuário do setor comercial', true, 'system'),
  ('compras', 'Usuário do setor de compras', true, 'system');

-- Inserir permissões padrão para cada perfil
-- Admin: acesso total
INSERT INTO public.profile_permissions (profile_id, menu_key, can_access)
SELECT id, menu_key, true
FROM public.user_profiles, 
     unnest(ARRAY[
       'home', 'enderecamento', 'inventario', 'dashboard', 'estoque_atual', 
       'estoque_rua', 'etiquetas', 'solicitar_codigo', 'processar_codigos',
       'aprovacao_codigos', 'controle_inventario', 'relatorio_inventario',
       'ajuste_inventario', 'catalogo', 'fabricantes', 'gerenciamento_dados', 
       'admin_panel', 'catalogo_produto'
     ]) AS menu_key
WHERE nome = 'admin';

-- User: acesso básico
INSERT INTO public.profile_permissions (profile_id, menu_key, can_access)
SELECT id, menu_key, 
  CASE WHEN menu_key IN ('home', 'enderecamento', 'inventario', 'dashboard', 'estoque_rua', 'etiquetas', 'solicitar_codigo', 'catalogo_produto') 
       THEN true ELSE false END
FROM public.user_profiles,
     unnest(ARRAY[
       'home', 'enderecamento', 'inventario', 'dashboard', 'estoque_atual', 
       'estoque_rua', 'etiquetas', 'solicitar_codigo', 'processar_codigos',
       'aprovacao_codigos', 'controle_inventario', 'relatorio_inventario',
       'ajuste_inventario', 'catalogo', 'fabricantes', 'gerenciamento_dados', 
       'admin_panel', 'catalogo_produto'
     ]) AS menu_key
WHERE nome = 'user';

-- Estoque: acesso ao estoque
INSERT INTO public.profile_permissions (profile_id, menu_key, can_access)
SELECT id, menu_key,
  CASE WHEN menu_key IN ('home', 'enderecamento', 'inventario', 'dashboard', 'estoque_atual', 'estoque_rua', 'etiquetas', 'catalogo_produto')
       THEN true ELSE false END
FROM public.user_profiles,
     unnest(ARRAY[
       'home', 'enderecamento', 'inventario', 'dashboard', 'estoque_atual', 
       'estoque_rua', 'etiquetas', 'solicitar_codigo', 'processar_codigos',
       'aprovacao_codigos', 'controle_inventario', 'relatorio_inventario',
       'ajuste_inventario', 'catalogo', 'fabricantes', 'gerenciamento_dados', 
       'admin_panel', 'catalogo_produto'
     ]) AS menu_key
WHERE nome = 'estoque';

-- Comercial: acesso ao processamento de códigos
INSERT INTO public.profile_permissions (profile_id, menu_key, can_access)
SELECT id, menu_key,
  CASE WHEN menu_key IN ('home', 'processar_codigos', 'catalogo_produto')
       THEN true ELSE false END
FROM public.user_profiles,
     unnest(ARRAY[
       'home', 'enderecamento', 'inventario', 'dashboard', 'estoque_atual', 
       'estoque_rua', 'etiquetas', 'solicitar_codigo', 'processar_codigos',
       'aprovacao_codigos', 'controle_inventario', 'relatorio_inventario',
       'ajuste_inventario', 'catalogo', 'fabricantes', 'gerenciamento_dados', 
       'admin_panel', 'catalogo_produto'
     ]) AS menu_key
WHERE nome = 'comercial';

-- Compras: acesso ao estoque atual e rua
INSERT INTO public.profile_permissions (profile_id, menu_key, can_access)
SELECT id, menu_key,
  CASE WHEN menu_key IN ('home', 'estoque_atual', 'estoque_rua', 'catalogo_produto')
       THEN true ELSE false END
FROM public.user_profiles,
     unnest(ARRAY[
       'home', 'enderecamento', 'inventario', 'dashboard', 'estoque_atual', 
       'estoque_rua', 'etiquetas', 'solicitar_codigo', 'processar_codigos',
       'aprovacao_codigos', 'controle_inventario', 'relatorio_inventario',
       'ajuste_inventario', 'catalogo', 'fabricantes', 'gerenciamento_dados', 
       'admin_panel', 'catalogo_produto'
     ]) AS menu_key
WHERE nome = 'compras';