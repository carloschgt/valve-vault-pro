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

const AUTH_KEY = 'auth_user';

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

  const { data: auditData, isLoading, refetch } = useQuery({
    queryKey: ['auditoria_itens', searchCodigo],
    queryFn: async () => {
      if (!searchCodigo) return [];
      
      const sessionToken = getSessionToken();
      if (!sessionToken) throw new Error('Não autenticado');
      
      const { data, error } = await supabase.functions.invoke('data-operations', {
        body: {
          action: 'auditoria_item',
          sessionToken,
          codigo: searchCodigo,
        },
      });
      
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao buscar auditoria');
      
      return data.data as AuditEntry[];
    },
    enabled: !!searchCodigo,
  });

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
        ) : !auditData || auditData.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum registro de auditoria encontrado para o código <strong>{searchCodigo}</strong>.</p>
            <p className="text-sm mt-2">Isso pode significar que o item foi cadastrado antes do sistema de auditoria.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Histórico do código: <span className="text-primary">{searchCodigo}</span>
              </h2>
              <Badge variant="secondary">{auditData.length} registro(s)</Badge>
            </div>

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
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditoriaItens;
