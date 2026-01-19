import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const AUTH_KEY = 'imex_auth_user';

function getSessionToken(): string | null {
  try {
    const stored = localStorage.getItem(AUTH_KEY);
    if (stored) {
      const user = JSON.parse(stored);
      return user.sessionToken || null;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

export interface Solicitacao {
  id: string;
  codigo_lista: string;
  status: 'Rascunho' | 'Enviada' | 'EmSeparacao' | 'Parcial' | 'Concluida' | 'Cancelada';
  criado_por: string;
  criado_por_id: string;
  data_abertura: string | null;
  data_inicio_estoque: string | null;
  data_conclusao: string | null;
  observacoes_comercial: string | null;
  observacoes_estoque: string | null;
  created_at: string;
  updated_at: string;
}

export interface LinhasSolicitacao {
  id: string;
  solicitacao_id: string;
  pedido_cliente: string;
  item_cliente: string | null;
  codigo_item: string;
  fornecedor: string | null;
  qtd_solicitada: number;
  prioridade: number | null;
  qtd_disponivel_snapshot: number | null;
  qtd_reservada: number;
  qtd_separada: number;
  status_linha: 'Pendente' | 'FaltaPrioridade' | 'Separando' | 'Parcial' | 'Separado' | 'CompraNecessaria' | 'Cancelado';
  obs_comercial: string | null;
  obs_estoque: string | null;
  created_at: string;
  updated_at: string;
}

export interface Alocacao {
  id: string;
  linha_id: string;
  endereco_material_id: string;
  rua: number;
  coluna: number;
  nivel: number;
  posicao: number;
  qtd_retirada: number;
  data_hora: string;
  usuario_estoque: string;
  destino_local: string;
  status: 'Reservado' | 'Separado' | 'Devolvido';
  qtd_devolvida: number;
}

export interface Cancelamento {
  id: string;
  pedido_cliente: string;
  criado_por: string;
  criado_por_id: string;
  data_cancelamento: string;
  motivo: string | null;
  status: 'Aberto' | 'EmProcesso' | 'Concluido' | 'Cancelado';
  linhas?: CancelamentoLinha[];
}

export interface CancelamentoLinha {
  id: string;
  cancelamento_id: string;
  codigo_item: string;
  fornecedor: string | null;
  qtd_cancelada: number;
  qtd_devolvida_total: number;
  status_linha: 'PendenteDevolucao' | 'Devolvendo' | 'DevolvidoTotal';
}

export interface EnderecoEstoque {
  id: string;
  codigo: string;
  descricao: string;
  descricao_imex: string | null;
  rua: number;
  coluna: number;
  nivel: number;
  posicao: number;
  quantidade: number;
  qtd_reservada: number;
}

export interface MaterialTransaction {
  id: string;
  data_hora: string;
  tipo_transacao: string;
  codigo_item: string;
  fornecedor: string | null;
  qtd: number;
  endereco: string | null;
  local: string | null;
  referencia: string | null;
  usuario: string;
  observacao: string | null;
}

export interface LinhaImportacao {
  pedido_cliente: string;
  item_cliente?: string;
  qtd: number;
  codigo_item: string;
  fornecedor?: string;
}

async function invokeOperation<T>(action: string, params: Record<string, any> = {}): Promise<{ success: boolean; data?: T; error?: string }> {
  const sessionToken = getSessionToken();
  if (!sessionToken) {
    return { success: false, error: 'Sessão expirada. Faça login novamente.' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('separacao-material', {
      body: { action, sessionToken, ...params },
    });

    if (error) {
      console.error(`[useSeparacaoMaterial] ${action} error:`, error);
      return { success: false, error: error.message || 'Erro na operação' };
    }

    if (!data.success) {
      return { success: false, error: data.error || 'Erro desconhecido' };
    }

    return { success: true, data: data.data };
  } catch (err: any) {
    console.error(`[useSeparacaoMaterial] ${action} exception:`, err);
    return { success: false, error: err.message || 'Erro de conexão' };
  }
}

// ============ COMERCIAL ============

export async function criarSolicitacao(): Promise<{ success: boolean; data?: Solicitacao; error?: string }> {
  return invokeOperation<Solicitacao>('criar_solicitacao');
}

export async function adicionarLinha(
  solicitacaoId: string,
  linha: Omit<LinhaImportacao, 'codigo_item'> & { codigo_item: string }
): Promise<{ success: boolean; data?: LinhasSolicitacao; error?: string }> {
  return invokeOperation<LinhasSolicitacao>('adicionar_linha', { solicitacaoId, linha });
}

export async function importarLinhas(
  solicitacaoId: string,
  linhas: LinhaImportacao[]
): Promise<{ success: boolean; data?: { inserted: number; errors: string[] }; error?: string }> {
  return invokeOperation('importar_linhas', { solicitacaoId, linhas });
}

export async function enviarSolicitacao(solicitacaoId: string): Promise<{ success: boolean; error?: string }> {
  return invokeOperation('enviar_solicitacao', { solicitacaoId });
}

export async function definirPrioridade(
  linhaId: string,
  prioridade: number
): Promise<{ success: boolean; error?: string }> {
  return invokeOperation('definir_prioridade', { linhaId, prioridade });
}

export async function listarSolicitacoes(
  status?: string
): Promise<{ success: boolean; data?: Solicitacao[]; error?: string }> {
  return invokeOperation<Solicitacao[]>('listar_solicitacoes', { status });
}

export async function criarCancelamento(
  pedidoCliente: string,
  linhas: { codigo_item: string; fornecedor?: string; qtd_cancelada: number }[],
  motivo?: string
): Promise<{ success: boolean; data?: Cancelamento; error?: string }> {
  return invokeOperation<Cancelamento>('criar_cancelamento', { pedidoCliente, linhas, motivo });
}

export async function listarCancelamentos(
  status?: string
): Promise<{ success: boolean; data?: Cancelamento[]; error?: string }> {
  return invokeOperation<Cancelamento[]>('listar_cancelamentos', { status });
}

export async function detalheCancelamento(
  cancelamentoId: string
): Promise<{ success: boolean; data?: Cancelamento; error?: string }> {
  return invokeOperation<Cancelamento>('detalhe_cancelamento', { cancelamentoId });
}

export async function excluirLinha(linhaId: string): Promise<{ success: boolean; error?: string }> {
  return invokeOperation('excluir_linha', { linhaId });
}

export async function excluirSolicitacao(solicitacaoId: string): Promise<{ success: boolean; error?: string }> {
  return invokeOperation('excluir_solicitacao', { solicitacaoId });
}

// ============ ESTOQUE ============

export async function filaSeparacao(): Promise<{ success: boolean; data?: Solicitacao[]; error?: string }> {
  return invokeOperation<Solicitacao[]>('fila_separacao');
}

export async function detalheSolicitacao(
  solicitacaoId: string
): Promise<{ success: boolean; data?: { solicitacao: Solicitacao; linhas: LinhasSolicitacao[] }; error?: string }> {
  return invokeOperation('detalhe_solicitacao', { solicitacaoId });
}

export async function iniciarSeparacao(solicitacaoId: string): Promise<{ success: boolean; error?: string }> {
  return invokeOperation('iniciar_separacao', { solicitacaoId });
}

export async function buscarEnderecosCodigo(
  codigoItem: string
): Promise<{ success: boolean; data?: EnderecoEstoque[]; error?: string }> {
  return invokeOperation<EnderecoEstoque[]>('buscar_enderecos_codigo', { codigoItem });
}

export async function reservarEndereco(
  linhaId: string,
  enderecoMaterialId: string,
  qtdRetirada: number
): Promise<{ success: boolean; error?: string }> {
  return invokeOperation('reservar_endereco', { linhaId, enderecoMaterialId, qtdRetirada });
}

export async function confirmarSeparacao(
  linhaId: string,
  qtdSeparada?: number,
  obsEstoque?: string
): Promise<{ success: boolean; error?: string }> {
  return invokeOperation('confirmar_separacao', { linhaId, qtdSeparada, obsEstoque });
}

export async function enderecarDevolucao(
  cancelamentoLinhaId: string,
  enderecoMaterialId: string,
  qtdDevolvida: number
): Promise<{ success: boolean; error?: string }> {
  return invokeOperation('enderecear_devolucao', { cancelamentoLinhaId, enderecoMaterialId, qtdDevolvida });
}

export async function listarTransactions(filters?: {
  codigoItem?: string;
  referencia?: string;
  tipoTransacao?: string;
  dataInicio?: string;
  dataFim?: string;
}): Promise<{ success: boolean; data?: MaterialTransaction[]; error?: string }> {
  return invokeOperation<MaterialTransaction[]>('listar_transactions', filters || {});
}

export async function areaSeparacao(): Promise<{ success: boolean; data?: { codigo_item: string; qtd_em_separacao: number }[]; error?: string }> {
  return invokeOperation('area_separacao');
}

export async function buscarEnderecosDevolucao(
  codigoItem: string
): Promise<{ success: boolean; data?: EnderecoEstoque[]; error?: string }> {
  return invokeOperation<EnderecoEstoque[]>('buscar_enderecos_devolucao', { codigoItem });
}

// ============ HOOK ============

export function useSeparacaoMaterial() {
  const { user } = useAuth();
  const { toast } = useToast();

  const showError = (message: string) => {
    toast({
      title: 'Erro',
      description: message,
      variant: 'destructive',
    });
  };

  const showSuccess = (message: string) => {
    toast({
      title: 'Sucesso',
      description: message,
    });
  };

  return {
    user,
    showError,
    showSuccess,
    // Commercial
    criarSolicitacao,
    adicionarLinha,
    importarLinhas,
    enviarSolicitacao,
    definirPrioridade,
    listarSolicitacoes,
    criarCancelamento,
    listarCancelamentos,
    detalheCancelamento,
    excluirLinha,
    excluirSolicitacao,
    // Stock
    filaSeparacao,
    detalheSolicitacao,
    iniciarSeparacao,
    buscarEnderecosCodigo,
    reservarEndereco,
    confirmarSeparacao,
    enderecarDevolucao,
    listarTransactions,
    areaSeparacao,
    buscarEnderecosDevolucao,
  };
}
