import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Loader2, History, User, Calendar, Edit, Plus, FileText, Package, TrendingUp, TrendingDown, MapPin, ArrowRightLeft, Truck, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import logoImex from '@/assets/logo-imex.png';

const AUTH_KEY = 'imex_auth_user';

function getSessionToken(): string | null {
  try {
    const stored = localStorage.getItem(AUTH_KEY);
    if (!stored) return null;
    const userData = JSON.parse(stored);
    return userData.sessionToken || null;
  } catch {
    return null;
  }
}

interface AuditEntry {
  id: string;
  endereco_material_id: string;
  codigo: string;
  acao: string;
  campo_alterado: string | null;
  valor_anterior: string | null;
  valor_novo: string | null;
  usuario_nome: string;
  usuario_email: string;
  created_at: string;
}

interface ItemInfo {
  id: string;
  codigo: string;
  descricao: string;
  descricao_imex: string | null;
  peso: number;
  tipo_material: string;
  rua: number | null;
  coluna: number | null;
  nivel: number | null;
  posicao: number | null;
  created_by: string;
  created_at: string;
  ativo: boolean;
  fabricante_nome: string | null;
  pendente?: boolean;
  status?: string;
}

interface SolicitacaoInfo {
  solicitado_por: string;
  solicitado_por_id: string;
  created_at: string;
  processado_por: string | null;
  processado_por_id: string | null;
  processado_em: string | null;
  aprovado_por: string | null;
  aprovado_por_id: string | null;
  aprovado_em: string | null;
}

interface InventarioEntry {
  id: string;
  quantidade: number;
  contagem_num: number;
  contado_por: string;
  created_at: string;
  updated_at: string;
  comentario: string | null;
}

interface InventarioAuditEntry {
  id: string;
  inventario_id: string;
  quantidade_anterior: number;
  quantidade_nova: number;
  editado_por: string;
  editado_em: string;
  motivo: string;
}

interface MaterialTransaction {
  id: string;
  data_hora: string;
  tipo_transacao: string;
  qtd: number;
  endereco: string | null;
  local: string | null;
  referencia: string | null;
  usuario: string;
  observacao: string | null;
  fornecedor: string | null;
}

interface AuditResponse {
  data: AuditEntry[];
  itemInfo: ItemInfo | null;
  solicitacaoInfo: SolicitacaoInfo | null;
  inventarioData: InventarioEntry[];
  inventarioAuditData: InventarioAuditEntry[];
  materialTransactions: MaterialTransaction[];
}

const ACAO_LABELS: Record<string, { label: string; color: string }> = {
  criacao: { label: 'Criação', color: 'bg-green-100 text-green-800' },
  alteracao_codigo: { label: 'Alteração de Código', color: 'bg-blue-100 text-blue-800' },
  alteracao_descricao: { label: 'Alteração de Descrição', color: 'bg-yellow-100 text-yellow-800' },
  alteracao_descricao_imex: { label: 'Alteração de Desc. Imex', color: 'bg-purple-100 text-purple-800' },
  alteracao_status: { label: 'Alteração de Status', color: 'bg-orange-100 text-orange-800' },
  alteracao_endereco: { label: 'Alteração de Endereço', color: 'bg-cyan-100 text-cyan-800' },
  alteracao_peso: { label: 'Alteração de Peso', color: 'bg-pink-100 text-pink-800' },
  alteracao_tipo_material: { label: 'Alteração de Tipo', color: 'bg-indigo-100 text-indigo-800' },
  alteracao_fabricante: { label: 'Alteração de Fabricante', color: 'bg-teal-100 text-teal-800' },
};

const TIPO_TRANSACAO_LABELS: Record<string, { label: string; color: string; icon: 'in' | 'out' | 'move' | 'alert' }> = {
  RECEBIMENTO: { label: 'Recebimento', color: 'bg-green-100 text-green-800', icon: 'in' },
  ARMAZENAGEM_ENTRADA: { label: 'Entrada Armazenagem', color: 'bg-green-100 text-green-800', icon: 'in' },
  RESERVA_SAIDA_ARMAZENAGEM: { label: 'Reserva Saída', color: 'bg-amber-100 text-amber-800', icon: 'out' },
  ENTRADA_AREA_SEPARACAO: { label: 'Entrada Área Sep.', color: 'bg-blue-100 text-blue-800', icon: 'move' },
  SEPARACAO_INICIO: { label: 'Separação Início', color: 'bg-blue-100 text-blue-800', icon: 'move' },
  SEPARACAO_CONFIRMADA: { label: 'Separação Confirmada', color: 'bg-blue-100 text-blue-800', icon: 'move' },
  SEPARACAO_FIM: { label: 'Separação Fim', color: 'bg-blue-100 text-blue-800', icon: 'out' },
  CANCELAMENTO_CRIADO: { label: 'Cancelamento Criado', color: 'bg-red-100 text-red-800', icon: 'alert' },
  SAIDA_AREA_SEPARACAO: { label: 'Saída Área Sep.', color: 'bg-red-100 text-red-800', icon: 'out' },
  DEVOLUCAO_ENTRADA_ARMAZENAGEM: { label: 'Devolução Armazenagem', color: 'bg-purple-100 text-purple-800', icon: 'in' },
  AJUSTE: { label: 'Ajuste', color: 'bg-orange-100 text-orange-800', icon: 'move' },
};

const AuditoriaItens = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [searchCodigo, setSearchCodigo] = useState('');
  const [searchInput, setSearchInput] = useState('');
  
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const { data: auditResponse, isLoading, refetch } = useQuery({
    queryKey: ['auditoria_itens', searchCodigo],
    queryFn: async (): Promise<AuditResponse> => {
      if (!searchCodigo) return { data: [], itemInfo: null, solicitacaoInfo: null, inventarioData: [], inventarioAuditData: [], materialTransactions: [] };
      
      const sessionToken = getSessionToken();
      console.log('[Auditoria] Searching for:', searchCodigo, 'with token:', sessionToken ? 'present' : 'missing');
      if (!sessionToken) throw new Error('Não autenticado');
      
      const { data, error } = await supabase.functions.invoke('data-operations', {
        body: {
          action: 'auditoria_item',
          sessionToken,
          codigo: searchCodigo,
        },
      });
      
      console.log('[Auditoria] Response:', data, error);
      
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao buscar auditoria');
      
      return {
        data: data.data as AuditEntry[],
        itemInfo: data.itemInfo as ItemInfo | null,
        solicitacaoInfo: data.solicitacaoInfo as SolicitacaoInfo | null,
        inventarioData: (data.inventarioData || []) as InventarioEntry[],
        inventarioAuditData: (data.inventarioAuditData || []) as InventarioAuditEntry[],
        materialTransactions: (data.materialTransactions || []) as MaterialTransaction[],
      };
    },
    enabled: !!searchCodigo,
    staleTime: 0, // Always refetch
    gcTime: 0, // Don't cache
  });

  const auditData = auditResponse?.data || [];
  const itemInfo = auditResponse?.itemInfo;
  const solicitacaoInfo = auditResponse?.solicitacaoInfo;
  const inventarioData = auditResponse?.inventarioData || [];
  const inventarioAuditData = auditResponse?.inventarioAuditData || [];
  const materialTransactions = auditResponse?.materialTransactions || [];

  const handleSearch = () => {
    if (!searchInput.trim()) {
      toast({
        title: 'Digite um código',
        description: 'Informe o código do item para consultar o histórico.',
        variant: 'destructive',
      });
      return;
    }
    setSearchCodigo(searchInput.trim().toUpperCase());
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-xl font-bold text-destructive mb-2">Acesso Negado</h1>
          <p className="text-muted-foreground mb-4">Apenas Super Administradores podem acessar esta página.</p>
          <Button onClick={() => navigate('/')}>Voltar ao Início</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img src={logoImex} alt="Logo IMEX" className="h-8" />
            <div>
              <h1 className="text-lg font-semibold">Auditoria de Itens</h1>
              <p className="text-xs text-muted-foreground">Histórico de alterações</p>
            </div>
          </div>
          <History className="h-6 w-6 text-primary" />
        </div>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-border bg-muted/30">
        <div className="flex gap-2">
          <Input
            placeholder="Digite o código do item..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1 uppercase"
          />
          <Button onClick={handleSearch} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            <span className="ml-2 hidden sm:inline">Buscar</span>
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {!searchCodigo ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Digite o código de um item para consultar seu histórico de alterações.</p>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !itemInfo && auditData.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum item encontrado com o código <strong>{searchCodigo}</strong>.</p>
            <p className="text-sm mt-2">Verifique se o código está correto.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Item Info Card */}
            {itemInfo && (
              <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Informações do Item: <span className="text-primary">{itemInfo.codigo}</span>
                  {itemInfo.pendente && (
                    <Badge className="bg-amber-100 text-amber-800 ml-2">Pendente de Endereçamento</Badge>
                  )}
                </h2>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Descrição:</span>
                    <span className="ml-2 font-medium">{itemInfo.descricao}</span>
                  </div>
                  {itemInfo.descricao_imex && (
                    <div>
                      <span className="text-muted-foreground">Descrição IMEX:</span>
                      <span className="ml-2 font-medium">{itemInfo.descricao_imex}</span>
                    </div>
                  )}
                  {itemInfo.peso != null && (
                    <div>
                      <span className="text-muted-foreground">Peso:</span>
                      <span className="ml-2 font-medium">{itemInfo.peso} kg</span>
                    </div>
                  )}
                  {itemInfo.tipo_material && (
                    <div>
                      <span className="text-muted-foreground">Tipo:</span>
                      <span className="ml-2 font-medium">{itemInfo.tipo_material}</span>
                    </div>
                  )}
                  {itemInfo.fabricante_nome && (
                    <div>
                      <span className="text-muted-foreground">Fabricante:</span>
                      <span className="ml-2 font-medium">{itemInfo.fabricante_nome}</span>
                    </div>
                  )}
                  {itemInfo.rua != null && itemInfo.coluna != null && itemInfo.nivel != null && itemInfo.posicao != null && (
                    <div>
                      <span className="text-muted-foreground">Endereço:</span>
                      <span className="ml-2 font-medium">
                        R{String(itemInfo.rua).padStart(2, '0')}.C{String(itemInfo.coluna).padStart(2, '0')}.N{String(itemInfo.nivel).padStart(2, '0')}.P{String(itemInfo.posicao).padStart(2, '0')}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    {itemInfo.pendente ? (
                      <Badge className="bg-amber-100 text-amber-800 ml-2">
                        {itemInfo.status === 'codigo_gerado' ? 'Código Gerado - Aguardando Endereçamento' : itemInfo.status}
                      </Badge>
                    ) : (
                      <Badge className={itemInfo.ativo ? 'bg-green-100 text-green-800 ml-2' : 'bg-red-100 text-red-800 ml-2'}>
                        {itemInfo.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Created by info */}
                <div className="mt-4 pt-3 border-t border-border">
                  <div className="flex items-center gap-2 text-sm">
                    <Plus className="h-4 w-4 text-green-600" />
                    <Badge className="bg-green-100 text-green-800">Cadastro Original</Badge>
                  </div>
                  <div className="mt-2 pl-6 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{itemInfo.created_by}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {formatDate(itemInfo.created_at)}
                    </div>
                  </div>
                </div>

                {/* Solicitacao info if available - Timeline completa */}
                {solicitacaoInfo && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                      <History className="h-4 w-4 text-primary" />
                      Linha do Tempo do Item
                    </div>
                    <div className="pl-2 space-y-3">
                      {/* Step 1: Solicitação */}
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">1</div>
                          <div className="w-0.5 h-full bg-border mt-1" />
                        </div>
                        <div className="flex-1 pb-3">
                          <Badge className="bg-blue-100 text-blue-800 mb-1">Solicitação Criada</Badge>
                          <div className="text-sm">
                            <span className="font-medium">{solicitacaoInfo.solicitado_por}</span>
                            <span className="text-muted-foreground ml-2 text-xs">
                              {formatDate(solicitacaoInfo.created_at)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">Criou a descrição do item e solicitou um código</p>
                        </div>
                      </div>

                      {/* Step 2: Processamento (geração do código) */}
                      {solicitacaoInfo.processado_por && (
                        <div className="flex items-start gap-3">
                          <div className="flex flex-col items-center">
                            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-sm">2</div>
                            <div className="w-0.5 h-full bg-border mt-1" />
                          </div>
                          <div className="flex-1 pb-3">
                            <Badge className="bg-purple-100 text-purple-800 mb-1">Código Gerado</Badge>
                            <div className="text-sm">
                              <span className="font-medium">{solicitacaoInfo.processado_por}</span>
                              {solicitacaoInfo.processado_em && (
                                <span className="text-muted-foreground ml-2 text-xs">
                                  {formatDate(solicitacaoInfo.processado_em)}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Atribuiu o código ao item</p>
                          </div>
                        </div>
                      )}

                      {/* Step 3: Aprovação */}
                      {solicitacaoInfo.aprovado_por && (
                        <div className="flex items-start gap-3">
                          <div className="flex flex-col items-center">
                            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-sm">
                              {solicitacaoInfo.processado_por ? '3' : '2'}
                            </div>
                            <div className="w-0.5 h-full bg-border mt-1" />
                          </div>
                          <div className="flex-1 pb-3">
                            <Badge className="bg-green-100 text-green-800 mb-1">Aprovado</Badge>
                            <div className="text-sm">
                              <span className="font-medium">{solicitacaoInfo.aprovado_por}</span>
                              {solicitacaoInfo.aprovado_em && (
                                <span className="text-muted-foreground ml-2 text-xs">
                                  {formatDate(solicitacaoInfo.aprovado_em)}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Aprovou o código gerado</p>
                          </div>
                        </div>
                      )}

                      {/* Step 4: Endereçamento (se já foi endereçado) */}
                      {itemInfo && !itemInfo.pendente && itemInfo.rua != null && (
                        <div className="flex items-start gap-3">
                          <div className="flex flex-col items-center">
                            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-sm">
                              {solicitacaoInfo.processado_por && solicitacaoInfo.aprovado_por ? '4' : 
                               solicitacaoInfo.processado_por || solicitacaoInfo.aprovado_por ? '3' : '2'}
                            </div>
                            {inventarioData.length > 0 && <div className="w-0.5 h-full bg-border mt-1" />}
                          </div>
                          <div className="flex-1 pb-3">
                            <Badge className="bg-orange-100 text-orange-800 mb-1">Endereçado</Badge>
                            <div className="text-sm">
                              <span className="font-medium">{itemInfo.created_by}</span>
                              <span className="text-muted-foreground ml-2 text-xs">
                                {formatDate(itemInfo.created_at)}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Endereçou o item em R{String(itemInfo.rua).padStart(2, '0')}.C{String(itemInfo.coluna).padStart(2, '0')}.N{String(itemInfo.nivel).padStart(2, '0')}.P{String(itemInfo.posicao).padStart(2, '0')}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Step 5+: Inventário */}
                      {inventarioData.map((inv, index) => {
                        const stepNumber = (solicitacaoInfo.processado_por ? 1 : 0) + 
                                          (solicitacaoInfo.aprovado_por ? 1 : 0) + 
                                          (itemInfo && !itemInfo.pendente && itemInfo.rua != null ? 1 : 0) + 
                                          2 + index;
                        const auditsForThisInv = inventarioAuditData.filter(a => a.inventario_id === inv.id);
                        
                        return (
                          <div key={inv.id}>
                            {/* Contagem inicial */}
                            <div className="flex items-start gap-3">
                              <div className="flex flex-col items-center">
                                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm">
                                  <Package className="h-4 w-4" />
                                </div>
                                {(auditsForThisInv.length > 0 || index < inventarioData.length - 1) && (
                                  <div className="w-0.5 h-full bg-border mt-1" />
                                )}
                              </div>
                              <div className="flex-1 pb-3">
                                <Badge className="bg-emerald-100 text-emerald-800 mb-1">
                                  Inventário - Contagem {inv.contagem_num}
                                </Badge>
                                <div className="text-sm">
                                  <span className="font-medium">{inv.contado_por}</span>
                                  <span className="text-muted-foreground ml-2 text-xs">
                                    {formatDate(inv.created_at)}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Registrou quantidade: <span className="font-semibold text-emerald-700">{inv.quantidade}</span>
                                  {inv.comentario && <span className="ml-1">- {inv.comentario}</span>}
                                </p>
                              </div>
                            </div>

                            {/* Ajustes de inventário */}
                            {auditsForThisInv.map((audit, auditIndex) => (
                              <div key={audit.id} className="flex items-start gap-3">
                                <div className="flex flex-col items-center">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                                    audit.quantidade_nova > audit.quantidade_anterior 
                                      ? 'bg-green-100 text-green-700' 
                                      : 'bg-red-100 text-red-700'
                                  }`}>
                                    {audit.quantidade_nova > audit.quantidade_anterior 
                                      ? <TrendingUp className="h-4 w-4" />
                                      : <TrendingDown className="h-4 w-4" />
                                    }
                                  </div>
                                  {auditIndex < auditsForThisInv.length - 1 && (
                                    <div className="w-0.5 h-full bg-border mt-1" />
                                  )}
                                </div>
                                <div className="flex-1 pb-3">
                                  <Badge className={audit.quantidade_nova > audit.quantidade_anterior 
                                    ? 'bg-green-100 text-green-800 mb-1' 
                                    : 'bg-red-100 text-red-800 mb-1'
                                  }>
                                    Ajuste de Inventário
                                  </Badge>
                                  <div className="text-sm">
                                    <span className="font-medium">{audit.editado_por}</span>
                                    <span className="text-muted-foreground ml-2 text-xs">
                                      {formatDate(audit.editado_em)}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Alterou de <span className="font-semibold text-red-600">{audit.quantidade_anterior}</span>
                                    {' '}para <span className="font-semibold text-green-600">{audit.quantidade_nova}</span>
                                    {audit.motivo && <span className="ml-1">- {audit.motivo}</span>}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Material Transactions (Movimentações) */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                Movimentações de Material
              </h2>
              <Badge variant="secondary">{materialTransactions.length} movimentação(ões)</Badge>
            </div>

            {materialTransactions.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground bg-muted/30 rounded-lg">
                <ArrowRightLeft className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhuma movimentação registrada para este item.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {materialTransactions.map((tx) => {
                  const tipoInfo = TIPO_TRANSACAO_LABELS[tx.tipo_transacao] || { label: tx.tipo_transacao, color: 'bg-gray-100 text-gray-800', icon: 'move' };
                  
                  return (
                    <div key={tx.id} className="bg-card border border-border rounded-lg p-3 shadow-sm">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {tipoInfo.icon === 'in' ? (
                            <TrendingUp className="h-4 w-4 text-green-600" />
                          ) : tipoInfo.icon === 'out' ? (
                            <TrendingDown className="h-4 w-4 text-red-600" />
                          ) : tipoInfo.icon === 'alert' ? (
                            <AlertCircle className="h-4 w-4 text-amber-600" />
                          ) : (
                            <ArrowRightLeft className="h-4 w-4 text-blue-600" />
                          )}
                          <Badge className={tipoInfo.color}>{tipoInfo.label}</Badge>
                          <span className={`font-bold text-sm ${tx.qtd >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {tx.qtd >= 0 ? '+' : ''}{tx.qtd}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatDate(tx.data_hora)}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {(tx.endereco || tx.local) && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">Local:</span>
                            <span className="font-medium">{tx.endereco || tx.local}</span>
                          </div>
                        )}
                        {tx.referencia && (
                          <div className="flex items-center gap-1">
                            <FileText className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">Ref:</span>
                            <span className="font-medium">{tx.referencia}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">{tx.usuario}</span>
                        </div>
                        {tx.observacao && (
                          <div className="col-span-2 text-muted-foreground italic">
                            💬 {tx.observacao}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Audit History */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Histórico de Alterações
              </h2>
              <Badge variant="secondary">{auditData.length} alteração(ões)</Badge>
            </div>

            {auditData.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground bg-muted/30 rounded-lg">
                <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhuma alteração registrada após o cadastro original.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {auditData.map((entry) => {
                  const acaoInfo = ACAO_LABELS[entry.acao] || { label: entry.acao, color: 'bg-gray-100 text-gray-800' };
                  
                  return (
                    <div key={entry.id} className="bg-card border border-border rounded-lg p-4 shadow-sm">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {entry.acao === 'criacao' ? (
                            <Plus className="h-4 w-4 text-green-600" />
                          ) : (
                            <Edit className="h-4 w-4 text-blue-600" />
                          )}
                          <Badge className={acaoInfo.color}>{acaoInfo.label}</Badge>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatDate(entry.created_at)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mb-3 text-sm">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{entry.usuario_nome}</span>
                        <span className="text-muted-foreground">({entry.usuario_email})</span>
                      </div>

                      {entry.campo_alterado && (
                        <div className="bg-muted/50 rounded-md p-3 text-sm">
                          <div className="text-muted-foreground mb-1">
                            Campo: <span className="font-medium text-foreground">{entry.campo_alterado}</span>
                          </div>
                          {entry.valor_anterior && (
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">De:</span>
                              <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs">
                                {entry.valor_anterior}
                              </span>
                            </div>
                          )}
                          {entry.valor_novo && (
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-muted-foreground">Para:</span>
                              <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs">
                                {entry.valor_novo}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditoriaItens;
