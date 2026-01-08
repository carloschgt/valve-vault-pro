import { supabase } from '@/integrations/supabase/client';

// Helper to get session token from localStorage
function getSessionToken(): string | null {
  const stored = localStorage.getItem('imex_auth_user');
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored);
    return parsed.sessionToken || null;
  } catch {
    return null;
  }
}

interface SolicitacaoResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  existingItem?: { codigo: string; descricao: string };
  locked?: boolean;
  count?: number;
}

async function invokeFunction<T = any>(action: string, params: Record<string, any> = {}): Promise<SolicitacaoResult<T>> {
  const sessionToken = getSessionToken();
  if (!sessionToken) {
    return { success: false, error: 'Sessão não encontrada. Faça login novamente.' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('solicitacoes-codigo', {
      body: { action, sessionToken, ...params }
    });

    if (error) {
      console.error('Solicitações código error:', error);
      return { success: false, error: error.message || 'Erro ao conectar com o servidor' };
    }

    return data as SolicitacaoResult<T>;
  } catch (err) {
    console.error('Solicitações código exception:', err);
    return { success: false, error: 'Erro de conexão' };
  }
}

// Criar nova solicitação (user, admin)
export async function criarSolicitacao(descricao: string, fabricante_id?: string) {
  return invokeFunction('criar_solicitacao', { descricao, fabricante_id });
}

// Listar minhas solicitações (user, admin)
export async function minhasSolicitacoes() {
  return invokeFunction('listar_minhas');
}

// Listar solicitações pendentes (comercial)
export async function listarPendentes() {
  return invokeFunction('listar_pendentes');
}

// Listar para aprovação (admin)
export async function listarParaAprovacao() {
  return invokeFunction('listar_para_aprovacao');
}

// Bloquear solicitação para processar (comercial)
export async function bloquearSolicitacao(solicitacao_id: string) {
  return invokeFunction('bloquear', { solicitacao_id });
}

// Desbloquear solicitação (comercial)
export async function desbloquearSolicitacao(solicitacao_id: string) {
  return invokeFunction('desbloquear', { solicitacao_id });
}

// Salvar código criado (comercial)
export async function salvarCodigo(solicitacao_id: string, codigo: string) {
  return invokeFunction('salvar_codigo', { solicitacao_id, codigo });
}

// Aprovar código (admin)
export async function aprovarCodigo(solicitacao_id: string) {
  return invokeFunction('aprovar', { solicitacao_id });
}

// Rejeitar código (admin)
export async function rejeitarCodigo(solicitacao_id: string, motivo: string) {
  return invokeFunction('rejeitar', { solicitacao_id, motivo });
}

// Notificações
export async function listarNotificacoes() {
  return invokeFunction('listar_notificacoes');
}

export async function marcarNotificacaoLida(notificacao_id: string) {
  return invokeFunction('marcar_lida', { notificacao_id });
}

export async function marcarTodasNotificacoesLidas() {
  return invokeFunction('marcar_todas_lidas');
}

export async function contarNotificacoesNaoLidas() {
  return invokeFunction<number>('contar_nao_lidas');
}
