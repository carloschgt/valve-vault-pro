import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { UserStatus, UserRole } from '@/types/user';

/**
 * SECURITY MODEL DOCUMENTATION:
 * 
 * The user data stored in localStorage (including 'tipo') is used for UI/UX purposes ONLY.
 * Client-side authorization checks should NEVER be relied upon for security.
 * 
 * ACTUAL SECURITY is enforced server-side through:
 * 1. Edge Functions (admin-users/index.ts) - verifyAdminUser() validates admin status
 *    against the database before any privileged operation
 * 2. RLS Policies - All write operations use is_admin_user() function that queries
 *    the database directly, ignoring any client-supplied role information
 * 
 * If an attacker modifies localStorage to set tipo='admin':
 * - They can see admin UI elements (cosmetic only)
 * - All actual operations will fail with 403 errors
 * - No data can be modified/accessed beyond their real permissions
 */

interface User {
  id: string;
  nome: string;
  email: string;
  /** NOTE: This is for UI display only. Actual authorization uses server-side validation. */
  tipo: UserRole;
  /** User access status */
  status: UserStatus;
  /** Date until user is suspended (if applicable) */
  suspensoAte?: string | null;
  /** Secure session token for API authentication */
  sessionToken?: string;
}

interface CheckEmailResult {
  success: boolean;
  error?: string;
  exists?: boolean;
  approved?: boolean;
  userName?: string;
  status?: UserStatus;
  mustResetPassword?: boolean;
  resetToken?: string;
}

interface LoginResult {
  success: boolean;
  error?: string;
  pendingApproval?: boolean;
  status?: UserStatus;
  suspensoAte?: string | null;
  mustResetPassword?: boolean;
  resetToken?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  checkEmail: (email: string) => Promise<CheckEmailResult>;
  login: (email: string, senha: string) => Promise<LoginResult>;
  register: (email: string, senha: string, nome: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_KEY = 'imex_auth_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for stored session
    const stored = localStorage.getItem(AUTH_KEY);
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem(AUTH_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const getDeviceInfo = () => {
    const ua = navigator.userAgent;
    const platform = navigator.platform || 'Unknown';
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
    const browser = /Chrome/i.test(ua) ? 'Chrome' : /Firefox/i.test(ua) ? 'Firefox' : /Safari/i.test(ua) ? 'Safari' : 'Other';
    return `${platform} | ${browser} | ${isMobile ? 'Mobile' : 'Desktop'}`;
  };

  const checkEmail = async (email: string): Promise<CheckEmailResult> => {
    try {
      const { data, error } = await supabase.functions.invoke('auth', {
        body: { action: 'checkEmail', email },
      });

      if (error) {
        console.error('Check email invoke error:', error);
        return { success: false, error: 'Erro ao conectar com o servidor' };
      }

      if (!data.success) {
        return { success: false, error: data.error || 'Erro ao verificar email' };
      }

      return {
        success: true,
        exists: data.exists,
        approved: data.approved,
        userName: data.userName,
        status: data.status,
        mustResetPassword: data.mustResetPassword,
        resetToken: data.resetToken,
      };
    } catch (err) {
      console.error('Check email error:', err);
      return { success: false, error: 'Erro ao verificar email' };
    }
  };

  const login = async (email: string, senha: string): Promise<LoginResult> => {
    try {
      const deviceInfo = getDeviceInfo();
      const { data, error } = await supabase.functions.invoke('auth', {
        body: { action: 'login', email, senha, deviceInfo },
      });

      if (error) {
        console.error('Login invoke error:', error);
        return { success: false, error: 'Erro ao conectar com o servidor' };
      }

      if (!data.success) {
        return { 
          success: false, 
          error: data.error || 'Erro ao fazer login',
          pendingApproval: data.pendingApproval,
          status: data.status,
          suspensoAte: data.suspensoAte,
          mustResetPassword: data.mustResetPassword,
          resetToken: data.resetToken,
        };
      }

      const userData: User = {
        id: data.user.id,
        nome: data.user.nome,
        email: data.user.email,
        tipo: data.user.tipo as UserRole,
        status: data.user.status as UserStatus || 'ativo',
        suspensoAte: data.user.suspenso_ate,
        sessionToken: data.sessionToken,
      };

      setUser(userData);
      localStorage.setItem(AUTH_KEY, JSON.stringify(userData));

      return { success: true };
    } catch (err) {
      console.error('Login error:', err);
      return { success: false, error: 'Erro ao fazer login' };
    }
  };

  const register = async (email: string, senha: string, nome: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke('auth', {
        body: { action: 'register', email, senha, nome },
      });

      if (error) {
        console.error('Register invoke error:', error);
        return { success: false, error: 'Erro ao conectar com o servidor' };
      }

      if (!data.success) {
        return { success: false, error: data.error || 'Erro ao cadastrar' };
      }

      return { success: true };
    } catch (err) {
      console.error('Register error:', err);
      return { success: false, error: 'Erro ao cadastrar' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(AUTH_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, checkEmail, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
