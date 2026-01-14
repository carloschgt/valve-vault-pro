import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPermissions, MENU_KEYS } from '@/hooks/useUserPermissions';
import { Loader2 } from 'lucide-react';
import AccessBlockedScreen from '@/components/AccessBlockedScreen';
import { ForcePasswordChange } from '@/components/ForcePasswordChange';

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
  allowRoles?: string[];
  requiredPermission?: keyof typeof MENU_KEYS;
}

export function ProtectedRoute({ children, adminOnly = false, allowRoles, requiredPermission }: ProtectedRouteProps) {
  const { user, isLoading, handleSessionExpired } = useAuth();
  const { hasPermission, isAdmin, isSuperAdmin, isLoading: permissionsLoading } = useUserPermissions();

  // Listen for session-expired events from data operations
  useEffect(() => {
    const handleExpired = () => {
      handleSessionExpired();
    };
    
    window.addEventListener('session-expired', handleExpired);
    return () => window.removeEventListener('session-expired', handleExpired);
  }, [handleSessionExpired]);

  if (isLoading || permissionsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check user status - block access if not 'ativo'
  if (user.status && user.status !== 'ativo') {
    return <AccessBlockedScreen status={user.status} suspendedUntil={user.suspensoAte} />;
  }

  // Force password change - block access until password is changed
  if (user.forcePasswordChange) {
    return <ForcePasswordChange />;
  }

  // Admin-only routes - check if user is admin or super admin
  if (adminOnly && !isAdmin && !isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  // Permission-based access (dynamic permissions from profile)
  if (requiredPermission && !hasPermission(MENU_KEYS[requiredPermission])) {
    return <Navigate to="/" replace />;
  }

  // Legacy role-based access (for backwards compatibility, but uses dynamic permissions now)
  // Map allowRoles to permission keys
  if (allowRoles) {
    const roleToPermissionMap: Record<string, keyof typeof MENU_KEYS> = {
      'admin': 'admin_panel',
      'user': 'home',
      'estoque': 'inventario',
      'comercial': 'processar_codigos',
      'compras': 'estoque_atual',
    };
    
    // If user is admin/super admin, always allow
    if (isAdmin || isSuperAdmin) {
      return <>{children}</>;
    }
    
    // Check if user has any of the required permissions based on their profile
    const hasRequiredPermission = allowRoles.some(role => {
      const permKey = roleToPermissionMap[role];
      return permKey ? hasPermission(MENU_KEYS[permKey]) : false;
    });
    
    // Also check if user's tipo is in allowRoles (legacy compatibility)
    if (!hasRequiredPermission && !allowRoles.includes(user.tipo)) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}
