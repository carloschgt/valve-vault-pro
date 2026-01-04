import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import AccessBlockedScreen from '@/components/AccessBlockedScreen';

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
  allowRoles?: string[];
}

export function ProtectedRoute({ children, adminOnly = false, allowRoles }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
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

  // Admin-only routes
  if (adminOnly && user.tipo !== 'admin') {
    return <Navigate to="/" replace />;
  }

  // Role-based access
  if (allowRoles && !allowRoles.includes(user.tipo)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
