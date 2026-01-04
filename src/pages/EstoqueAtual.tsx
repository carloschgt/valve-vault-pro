import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Package, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import logoImex from '@/assets/logo-imex.png';
import { supabase } from '@/integrations/supabase/client';

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

interface EstoqueItem {
  codigo: string;
  descricao: string;
  tipo_material: string;
  enderecos: {
    rua: number;
    coluna: number;
    nivel: number;
    posicao: number;
    quantidade: number;
    endereco_id: string;
  }[];
  qtd_total: number;
}

const EstoqueAtual = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.tipo === 'admin';

  const [search, setSearch] = useState('');
  const [estoque, setEstoque] = useState<EstoqueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isAdmin) {
      loadEstoque();
    }
  }, [isAdmin]);

  const loadEstoque = async () => {
    setIsLoading(true);
    try {
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        toast({
          title: 'Erro',
          description: 'Sessão expirada. Faça login novamente.',
          variant: 'destructive',
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('data-operations', {
        body: { action: 'estoque_atual', sessionToken, search },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setEstoque(data.data || []);
    } catch (error: any) {
      console.error('Erro ao carregar estoque:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao carregar estoque',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Recarregar quando busca mudar (com debounce)
  useEffect(() => {
    if (!isAdmin) return;
    
    const timer = setTimeout(() => {
      loadEstoque();
    }, 300);

    return () => clearTimeout(timer);
  }, [search, isAdmin]);

  if (!isAdmin) {
    return (
      <div className="flex h-screen flex-col bg-background">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2 shrink-0">
          <button
            onClick={() => navigate('/')}
            className="rounded-lg p-1.5 hover:bg-accent"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <img src={logoImex} alt="IMEX Solutions" className="h-6" />
          <h1 className="text-base font-bold">Estoque Atual</h1>
        </div>

        {/* Em desenvolvimento */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="rounded-full bg-amber-500/20 p-6 mb-4">
            <Package className="h-12 w-12 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Em Desenvolvimento</h2>
          <p className="text-muted-foreground max-w-sm">
            Esta funcionalidade estará disponível em breve para todos os usuários.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2 shrink-0">
        <button
          onClick={() => navigate('/')}
          className="rounded-lg p-1.5 hover:bg-accent"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <img src={logoImex} alt="IMEX Solutions" className="h-6" />
        <h1 className="text-base font-bold">Estoque Atual</h1>
      </div>

      {/* Search */}
      <div className="border-b border-border bg-card px-3 py-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por código ou descrição..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Tabela */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : estoque.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Package className="h-8 w-8 mb-2" />
            <p className="text-sm">Nenhum item com saldo em estoque</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="px-2 py-2 text-left font-semibold border-b border-border">Código</th>
                  <th className="px-2 py-2 text-left font-semibold border-b border-border">Descrição</th>
                  <th className="px-2 py-2 text-left font-semibold border-b border-border">Tipo</th>
                  <th className="px-1 py-2 text-center font-semibold border-b border-border">Rua</th>
                  <th className="px-1 py-2 text-center font-semibold border-b border-border">Col</th>
                  <th className="px-1 py-2 text-center font-semibold border-b border-border">Nív</th>
                  <th className="px-1 py-2 text-center font-semibold border-b border-border">Pos</th>
                  <th className="px-1 py-2 text-center font-semibold border-b border-border">Qtd</th>
                  <th className="px-2 py-2 text-center font-semibold border-b border-border bg-primary/10">Total</th>
                </tr>
              </thead>
              <tbody>
                {estoque.map((item, idx) => (
                  item.enderecos.map((end, endIdx) => (
                    <tr 
                      key={`${item.codigo}-${end.endereco_id}`}
                      className={`border-b border-border/50 ${endIdx === 0 && idx > 0 ? 'border-t-2 border-t-border' : ''}`}
                    >
                      {endIdx === 0 ? (
                        <>
                          <td 
                            className="px-2 py-1.5 font-medium text-foreground align-top"
                            rowSpan={item.enderecos.length}
                          >
                            {item.codigo}
                          </td>
                          <td 
                            className="px-2 py-1.5 text-muted-foreground align-top max-w-[120px] truncate"
                            rowSpan={item.enderecos.length}
                            title={item.descricao}
                          >
                            {item.descricao}
                          </td>
                          <td 
                            className="px-2 py-1.5 text-muted-foreground align-top"
                            rowSpan={item.enderecos.length}
                          >
                            {item.tipo_material}
                          </td>
                        </>
                      ) : null}
                      <td className="px-1 py-1.5 text-center">{String(end.rua).padStart(2, '0')}</td>
                      <td className="px-1 py-1.5 text-center">{String(end.coluna).padStart(2, '0')}</td>
                      <td className="px-1 py-1.5 text-center">{String(end.nivel).padStart(2, '0')}</td>
                      <td className="px-1 py-1.5 text-center">{String(end.posicao).padStart(2, '0')}</td>
                      <td className="px-1 py-1.5 text-center font-medium">{end.quantidade}</td>
                      {endIdx === 0 ? (
                        <td 
                          className="px-2 py-1.5 text-center font-bold text-primary bg-primary/5 align-top"
                          rowSpan={item.enderecos.length}
                        >
                          {item.qtd_total}
                        </td>
                      ) : null}
                    </tr>
                  ))
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default EstoqueAtual;
