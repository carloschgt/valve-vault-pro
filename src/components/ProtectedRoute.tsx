import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import AccessBlockedScreen from '@/components/AccessBlockedScreen';
import { ForcePasswordChange } from '@/components/ForcePasswordChange';

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
  allowRoles?: string[];
}

export function ProtectedRoute({ children, adminOnly = false, allowRoles }: ProtectedRouteProps) {
  const { user, isLoading, handleSessionExpired } = useAuth();

  // Listen for session-expired events from data operations
  useEffect(() => {
    const handleExpired = () => {
      handleSessionExpired();
    };
    
    window.addEventListener('session-expired', handleExpired);
    return () => window.removeEventListener('session-expired', handleExpired);
  }, [handleSessionExpired]);

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

  // Force password change - block access until password is changed
  if (user.forcePasswordChange) {
    return <ForcePasswordChange />;
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
