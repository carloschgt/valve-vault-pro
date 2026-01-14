import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Loader2, History, User, Calendar, Edit, Plus, FileText } from 'lucide-react';
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
  aprovado_por: string | null;
  aprovado_em: string | null;
}

interface AuditResponse {
  data: AuditEntry[];
  itemInfo: ItemInfo | null;
  solicitacaoInfo: SolicitacaoInfo | null;
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
      if (!searchCodigo) return { data: [], itemInfo: null, solicitacaoInfo: null };
      
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
      };
    },
    enabled: !!searchCodigo,
    staleTime: 0, // Always refetch
    gcTime: 0, // Don't cache
  });

  const auditData = auditResponse?.data || [];
  const itemInfo = auditResponse?.itemInfo;
  const solicitacaoInfo = auditResponse?.solicitacaoInfo;

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

                {/* Solicitacao info if available */}
                {solicitacaoInfo && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="text-sm text-muted-foreground mb-2">Solicitação de Código:</div>
                    <div className="pl-2 text-sm space-y-1">
                      <div>
                        <span className="text-muted-foreground">Solicitado por:</span>
                        <span className="ml-2 font-medium">{solicitacaoInfo.solicitado_por}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({formatDate(solicitacaoInfo.created_at)})
                        </span>
                      </div>
                      {solicitacaoInfo.aprovado_por && (
                        <div>
                          <span className="text-muted-foreground">Aprovado por:</span>
                          <span className="ml-2 font-medium">{solicitacaoInfo.aprovado_por}</span>
                          {solicitacaoInfo.aprovado_em && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({formatDate(solicitacaoInfo.aprovado_em)})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
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
