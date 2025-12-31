import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  nome: string;
  email: string;
  tipo: 'admin' | 'user';
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, senha: string) => Promise<{ success: boolean; error?: string; needsPassword?: boolean }>;
  logout: () => void;
  setPassword: (email: string, senha: string) => Promise<{ success: boolean; error?: string }>;
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

  const login = async (email: string, senha: string): Promise<{ success: boolean; error?: string; needsPassword?: boolean }> => {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      // Fetch user data from Google Sheets via edge function
      const { data, error } = await supabase.functions.invoke('google-sheets', {
        body: { action: 'getData', sheetName: 'USUARIOS' },
      });

      if (error) {
        return { success: false, error: 'Erro ao conectar com o servidor' };
      }

      const rows: string[][] = data.values || [];
      if (rows.length < 2) {
        return { success: false, error: 'Nenhum usuário cadastrado' };
      }

      // Find user by email (column B = index 1)
      const userRow = rows.slice(1).find(row => 
        row[1]?.toLowerCase().trim() === email.toLowerCase().trim()
      );

      if (!userRow) {
        return { success: false, error: 'Email não encontrado' };
      }

      const nome = userRow[0] || '';
      const storedPassword = userRow[2] || '';
      const tipo = (userRow[3]?.toLowerCase().trim() === 'admin' ? 'admin' : 'user') as 'admin' | 'user';

      // Check if user needs to set password (first login)
      if (!storedPassword) {
        return { success: false, needsPassword: true };
      }

      // Validate password
      if (storedPassword !== senha) {
        return { success: false, error: 'Senha incorreta' };
      }

      const userData: User = { nome, email: userRow[1], tipo };
      setUser(userData);
      localStorage.setItem(AUTH_KEY, JSON.stringify(userData));

      return { success: true };
    } catch (err) {
      console.error('Login error:', err);
      return { success: false, error: 'Erro ao fazer login' };
    }
  };

  const setPassword = async (email: string, senha: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      // Call edge function to update password
      const { data, error } = await supabase.functions.invoke('google-sheets', {
        body: { action: 'setPassword', email, senha },
      });

      if (error || data?.error) {
        return { success: false, error: data?.error || 'Erro ao definir senha' };
      }

      // Auto-login after setting password
      return await login(email, senha);
    } catch (err) {
      console.error('Set password error:', err);
      return { success: false, error: 'Erro ao definir senha' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(AUTH_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, setPassword }}>
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
