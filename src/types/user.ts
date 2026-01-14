// Status do usuário
export type UserStatus = 'pendente' | 'ativo' | 'suspenso' | 'negado';

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  pendente: 'Pendente',
  ativo: 'Ativo',
  suspenso: 'Suspenso',
  negado: 'Negado',
};

export const USER_STATUS_COLORS: Record<UserStatus, string> = {
  pendente: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  ativo: 'bg-green-100 text-green-800 border-green-300',
  suspenso: 'bg-orange-100 text-orange-800 border-orange-300',
  negado: 'bg-red-100 text-red-800 border-red-300',
};

// Tipos de perfil/role (tipo = perfil de acesso, role = nível de segurança)
export type UserRole = 'admin' | 'user' | 'estoque' | 'comercial' | 'compras';

// Role de segurança (armazenado separadamente)
export type SecurityRole = 'SUPER_ADMIN' | 'ADMIN' | 'USER';

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  user: 'Usuário',
  estoque: 'Estoque',
  comercial: 'Comercial',
  compras: 'Compras',
};

export const SECURITY_ROLE_LABELS: Record<SecurityRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Administrador',
  USER: 'Usuário',
};

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  tipo: UserRole;
  status: UserStatus;
  aprovado: boolean;
  suspenso_ate: string | null;
  notificado_aprovacao: boolean;
  created_at: string;
  updated_at: string;
  // Security fields
  locked_until?: string | null;
  failed_attempts?: number;
}
