import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Loader2, Download, Filter, Calendar, Package, ArrowRightLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import logoImex from '@/assets/logo-imex.png';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

interface Transaction {
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

const TIPOS_TRANSACAO = [
  { value: 'all', label: 'Todos os tipos' },
  { value: 'RECEBIMENTO', label: 'Recebimento' },
  { value: 'ARMAZENAGEM_ENTRADA', label: 'Armazenagem (Entrada)' },
  { value: 'RESERVA_SAIDA_ARMAZENAGEM', label: 'Reserva (Saída Armazenagem)' },
  { value: 'ENTRADA_AREA_SEPARACAO', label: 'Entrada Área Separação' },
  { value: 'SEPARACAO_INICIO', label: 'Separação Início' },
  { value: 'SEPARACAO_CONFIRMADA', label: 'Separação Confirmada' },
  { value: 'SEPARACAO_FIM', label: 'Separação Fim' },
  { value: 'CANCELAMENTO_CRIADO', label: 'Cancelamento Criado' },
  { value: 'SAIDA_AREA_SEPARACAO', label: 'Saída Área Separação' },
  { value: 'DEVOLUCAO_ENTRADA_ARMAZENAGEM', label: 'Devolução (Entrada Armazenagem)' },
  { value: 'AJUSTE', label: 'Ajuste' },
];

const getTipoColor = (tipo: string) => {
  switch (tipo) {
    case 'RECEBIMENTO':
    case 'ARMAZENAGEM_ENTRADA':
    case 'DEVOLUCAO_ENTRADA_ARMAZENAGEM':
      return 'bg-green-500/10 text-green-700 border-green-500/30';
    case 'RESERVA_SAIDA_ARMAZENAGEM':
    case 'SAIDA_AREA_SEPARACAO':
      return 'bg-red-500/10 text-red-700 border-red-500/30';
    case 'SEPARACAO_INICIO':
    case 'SEPARACAO_CONFIRMADA':
    case 'SEPARACAO_FIM':
    case 'ENTRADA_AREA_SEPARACAO':
      return 'bg-blue-500/10 text-blue-700 border-blue-500/30';
    case 'CANCELAMENTO_CRIADO':
      return 'bg-amber-500/10 text-amber-700 border-amber-500/30';
    case 'AJUSTE':
      return 'bg-purple-500/10 text-purple-700 border-purple-500/30';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const getTipoLabel = (tipo: string) => {
  const found = TIPOS_TRANSACAO.find(t => t.value === tipo);
  return found?.label || tipo;
};

const MaterialTransactions = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    setIsLoading(true);
    try {
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        toast({
          title: 'Erro',
          description: 'Sessão expirada. Faça login novamente.',
          variant: 'destructive',
        });
        navigate('/login');
        return;
      }

      const { data, error } = await supabase.functions.invoke('separacao-material', {
        body: { action: 'listar_transactions', sessionToken, limit: 500 },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setTransactions(data.data || []);
    } catch (error: any) {
      console.error('Erro ao carregar transações:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao carregar transações',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Filtrar transações
  const filteredTransactions = transactions.filter(tx => {
    // Filtro por tipo
    if (tipoFilter !== 'all' && tx.tipo_transacao !== tipoFilter) {
      return false;
    }

    // Filtro por busca (código, referência, usuário)
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      const hasWildcard = search.includes('*');
      
      if (hasWildcard) {
        const escaped = search.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
        const regexPattern = escaped.replace(/\*/g, '.*');
        const regex = new RegExp(regexPattern, 'i');
        
        return (
          regex.test(tx.codigo_item || '') ||
          regex.test(tx.referencia || '') ||
          regex.test(tx.usuario || '') ||
          regex.test(tx.endereco || '')
        );
      } else {
        return (
          tx.codigo_item?.toLowerCase().includes(searchLower) ||
          tx.referencia?.toLowerCase().includes(searchLower) ||
          tx.usuario?.toLowerCase().includes(searchLower) ||
          tx.endereco?.toLowerCase().includes(searchLower)
        );
      }
    }

    return true;
  });

  const formatDateTime = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd/MM/yy HH:mm", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const handleExport = () => {
    if (filteredTransactions.length === 0) {
      toast({
        title: 'Aviso',
        description: 'Nenhuma transação para exportar',
        variant: 'destructive',
      });
      return;
    }

    // Simple CSV export
    const headers = ['Data/Hora', 'Tipo', 'Código', 'Qtd', 'Endereço', 'Referência', 'Usuário', 'Observação'];
    const rows = filteredTransactions.map(tx => [
      formatDateTime(tx.data_hora),
      getTipoLabel(tx.tipo_transacao),
      tx.codigo_item,
      tx.qtd,
      tx.endereco || tx.local || '-',
      tx.referencia || '-',
      tx.usuario,
      tx.observacao || '-',
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `transacoes_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Sucesso',
      description: `${filteredTransactions.length} transações exportadas`,
    });
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border bg-card px-3 py-2 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/')}
            className="rounded-lg p-1.5 hover:bg-accent"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <img src={logoImex} alt="IMEX Solutions" className="h-6" />
          <h1 className="text-base font-bold">Movimentações</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? 'bg-primary/10' : ''}
          >
            <Filter className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={filteredTransactions.length === 0}
            className="gap-1"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">CSV</span>
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="border-b border-border bg-card px-3 py-2 shrink-0 space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar código, referência, usuário... (use * como coringa)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>

        {showFilters && (
          <div className="flex gap-2 flex-wrap">
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="w-[200px] h-9">
                <SelectValue placeholder="Tipo de transação" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_TRANSACAO.map(tipo => (
                  <SelectItem key={tipo.value} value={tipo.value}>
                    {tipo.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ArrowRightLeft className="h-3 w-3" />
          <span>{filteredTransactions.length} transações</span>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto p-3 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Package className="h-8 w-8 mb-2" />
            <p className="text-sm">Nenhuma transação encontrada</p>
          </div>
        ) : (
          filteredTransactions.map(tx => (
            <div
              key={tx.id}
              className="rounded-lg border border-border bg-card p-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={`text-xs ${getTipoColor(tx.tipo_transacao)}`}>
                      {getTipoLabel(tx.tipo_transacao)}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDateTime(tx.data_hora)}
                    </span>
                  </div>
                  
                  <div className="mt-2 flex items-center gap-3 text-sm">
                    <span className="font-semibold text-foreground">{tx.codigo_item}</span>
                    <span className={`font-bold ${tx.qtd >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.qtd >= 0 ? '+' : ''}{tx.qtd}
                    </span>
                  </div>

                  <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                    {(tx.endereco || tx.local) && (
                      <p>📍 {tx.endereco || tx.local}</p>
                    )}
                    {tx.referencia && (
                      <p>🔗 {tx.referencia}</p>
                    )}
                    <p>👤 {tx.usuario}</p>
                    {tx.observacao && (
                      <p className="italic">💬 {tx.observacao}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MaterialTransactions;
