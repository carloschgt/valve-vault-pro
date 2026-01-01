import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface User {
  id: string;
  nome: string;
  email: string;
  tipo: 'admin' | 'user';
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, senha: string) => Promise<{ success: boolean; error?: string }>;
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

  const login = async (email: string, senha: string): Promise<{ success: boolean; error?: string }> => {
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
        return { success: false, error: data.error || 'Erro ao fazer login' };
      }

      const userData: User = {
        id: data.user.id,
        nome: data.user.nome,
        email: data.user.email,
        tipo: data.user.tipo as 'admin' | 'user',
      };

      setUser(userData);
      localStorage.setItem(AUTH_KEY, JSON.stringify(userData));

      return { success: true };
    } catch (err) {
      console.error('Login error:', err);
      return { success: false, error: 'Erro ao fazer login' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(AUTH_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
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
