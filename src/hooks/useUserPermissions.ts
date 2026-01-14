import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Menu keys que correspondem às rotas
export const MENU_KEYS = {
  home: 'home',
  enderecamento: 'enderecamento',
  inventario: 'inventario',
  dashboard: 'dashboard',
  estoque_atual: 'estoque_atual',
  estoque_rua: 'estoque_rua',
  etiquetas: 'etiquetas',
  catalogo_produto: 'catalogo_produto',
  solicitar_codigo: 'solicitar_codigo',
  processar_codigos: 'processar_codigos',
  aprovacao_codigos: 'aprovacao_codigos',
  controle_inventario: 'controle_inventario',
  relatorio_inventario: 'relatorio_inventario',
  ajuste_inventario: 'ajuste_inventario',
  catalogo: 'catalogo',
  fabricantes: 'fabricantes',
  gerenciamento_dados: 'gerenciamento_dados',
  admin_panel: 'admin_panel',
} as const;

export type MenuKey = keyof typeof MENU_KEYS;

interface UserPermissions {
  permissions: Record<string, boolean>;
  isLoading: boolean;
  hasPermission: (menuKey: string) => boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

export function useUserPermissions(): UserPermissions {
  const { user } = useAuth();
  
  const isAdmin = user?.tipo === 'admin';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const { data: permissions = {}, isLoading } = useQuery({
    queryKey: ['user_permissions', user?.tipo],
    queryFn: async () => {
      if (!user?.tipo) return {};
      
      // Admin e Super Admin têm acesso total
      if (isAdmin || isSuperAdmin) {
        const allPermissions: Record<string, boolean> = {};
        Object.keys(MENU_KEYS).forEach(key => {
          allPermissions[key] = true;
        });
        return allPermissions;
      }
      
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { 
          action: 'getUserPermissions', 
          userTipo: user.tipo,
          adminEmail: user.email // Required for the Edge Function
        },
      });
      
      if (error) {
        console.error('Error fetching permissions:', error);
        return {};
      }
      
      return data.permissions || {};
    },
    enabled: !!user?.tipo,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const hasPermission = (menuKey: string): boolean => {
    // Admin e Super Admin sempre têm acesso
    if (isAdmin || isSuperAdmin) return true;
    
    return permissions[menuKey] === true;
  };

  return {
    permissions,
    isLoading,
    hasPermission,
    isAdmin,
    isSuperAdmin,
  };
}
