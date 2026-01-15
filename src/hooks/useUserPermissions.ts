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
  auditoria_itens: 'auditoria_itens',
  // Permissão especial para bypass do bloqueio de inventário
  bypass_inventario_block: 'bypass_inventario_block',
  // Permissão para visualizar valores financeiros (valor unitário e valor total)
  ver_valores: 'ver_valores',
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
  // SUPER_ADMIN check: role must be exactly 'SUPER_ADMIN'
  // Also check if tipo is 'admin' AND the protected email for legacy sessions
  const PROTECTED_SUPER_ADMIN_EMAIL = "carlos.teixeira@imexsolutions.com.br";
  const isSuperAdmin = user?.role === 'SUPER_ADMIN' || 
    (user?.tipo === 'admin' && user?.email?.toLowerCase() === PROTECTED_SUPER_ADMIN_EMAIL);

  // Debug log for troubleshooting
  if (user) {
    console.log('[useUserPermissions] User check:', {
      email: user.email,
      tipo: user.tipo,
      role: user.role,
      isAdmin,
      isSuperAdmin,
    });
  }

  const { data: permissions = {}, isLoading, refetch } = useQuery({
    queryKey: ['user_permissions', user?.tipo, user?.id],
    queryFn: async () => {
      if (!user?.tipo) {
        console.log('[useUserPermissions] No user tipo, returning empty permissions');
        return {};
      }
      
      // Admin e Super Admin têm acesso total
      if (isAdmin || isSuperAdmin) {
        console.log('[useUserPermissions] Admin/SuperAdmin detected, granting all permissions');
        const allPermissions: Record<string, boolean> = {};
        Object.keys(MENU_KEYS).forEach(key => {
          allPermissions[key] = true;
        });
        return allPermissions;
      }
      
      console.log('[useUserPermissions] Fetching permissions for tipo:', user.tipo);
      
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { 
          action: 'getUserPermissions', 
          userTipo: user.tipo,
          adminEmail: user.email
        },
      });
      
      if (error) {
        console.error('[useUserPermissions] Error fetching permissions:', error);
        return {};
      }
      
      console.log('[useUserPermissions] Received permissions:', data);
      
      if (data?.profileNotFound) {
        console.warn('[useUserPermissions] Profile not found for tipo:', user.tipo);
      }
      
      return data?.permissions || {};
    },
    enabled: !!user?.tipo,
    staleTime: 60 * 1000, // Cache for 1 minute only (reduced from 5 minutes)
    refetchOnWindowFocus: true, // Refetch when user returns to the tab
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
