import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, QrCode, Package, Loader2, MapPin, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import logoImex from '@/assets/logo-imex.png';
import { supabase } from '@/integrations/supabase/client';
import { QRScanner } from '@/components/QRScanner';
import { getInventarioConfig } from '@/hooks/useDataOperations';

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

interface MaterialRua {
  id: string;
  codigo: string;
  descricao: string;
  tipo_material: string;
  coluna: number;
  nivel: number;
  posicao: number;
  peso: number;
  fabricante_nome: string | null;
  quantidade_inventario: number | null;
}

const EstoqueRua = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.tipo === 'admin';

  const [rua, setRua] = useState('');
  const [ruaSelecionada, setRuaSelecionada] = useState<number | null>(null);
  const [materiais, setMateriais] = useState<MaterialRua[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [bloqueadoParaUsuarios, setBloqueadoParaUsuarios] = useState(false);
  const [isCheckingConfig, setIsCheckingConfig] = useState(true);

  // Verificar configuração de bloqueio
  useEffect(() => {
    const checkConfig = async () => {
      if (isAdmin) {
        setIsCheckingConfig(false);
        return;
      }
      try {
        const result = await getInventarioConfig();
        if (result.success && result.data) {
          setBloqueadoParaUsuarios(result.data.bloquear_visualizacao_estoque === true);
        }
      } catch (error) {
        console.error('Erro ao verificar config:', error);
      } finally {
        setIsCheckingConfig(false);
      }
    };
    checkConfig();
  }, [isAdmin]);

  // Carregar rua da URL se presente
  useEffect(() => {
    const ruaParam = searchParams.get('rua');
    if (ruaParam && !isCheckingConfig) {
      const ruaNum = parseInt(ruaParam);
      if (!isNaN(ruaNum) && ruaNum > 0) {
        setRua(ruaParam);
        setRuaSelecionada(ruaNum);
        buscarMateriaisRua(ruaNum);
      }
    }
  }, [searchParams, isCheckingConfig]);

  const buscarMateriaisRua = async (ruaNum: number) => {
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
        body: { action: 'materiais_por_rua', sessionToken, rua: ruaNum },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setMateriais(data.data || []);
      setRuaSelecionada(ruaNum);

      if ((data.data || []).length === 0) {
        toast({
          title: 'Nenhum material',
          description: `Não há materiais cadastrados na Rua ${String(ruaNum).padStart(2, '0')}`,
        });
      }
    } catch (error: any) {
      console.error('Erro ao buscar materiais:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao buscar materiais da rua',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBuscar = () => {
    const ruaNum = parseInt(rua, 10);
    if (isNaN(ruaNum) || ruaNum < 1) {
      toast({
        title: 'Rua inválida',
        description: 'Digite um número de rua válido',
        variant: 'destructive',
      });
      return;
    }
    buscarMateriaisRua(ruaNum);
  };

  const handleQRScan = (data: string) => {
    setShowScanner(false);
    
    try {
      // Primeiro tenta extrair da URL (formato gerado pela identificação de rua)
      // Exemplo: https://site.com/estoque-rua?rua=1
      const urlMatch = data.match(/[?&]rua=(\d+)/i);
      if (urlMatch) {
        const ruaNum = parseInt(urlMatch[1], 10);
        setRua(String(ruaNum));
        buscarMateriaisRua(ruaNum);
        return;
      }

      // Tenta parsear como JSON
      let parsed: any;
      try {
        parsed = JSON.parse(data);
      } catch {
        // Se não for JSON, tenta extrair rua do texto
        const match = data.match(/rua[:\s]*(\d+)/i);
        if (match) {
          const ruaNum = parseInt(match[1], 10);
          setRua(String(ruaNum));
          buscarMateriaisRua(ruaNum);
          return;
        }
        throw new Error('Formato de QR code não reconhecido');
      }

      // Extrai rua do JSON (suporta diferentes formatos)
      const ruaValue = parsed.rua || parsed.r || parsed.RUA;
      if (ruaValue) {
        const ruaNum = parseInt(String(ruaValue), 10);
        if (!isNaN(ruaNum)) {
          setRua(String(ruaNum));
          buscarMateriaisRua(ruaNum);
          return;
        }
      }

      throw new Error('QR code não contém informação de rua');
    } catch (error: any) {
      toast({
        title: 'Erro ao ler QR Code',
        description: error.message || 'QR code inválido',
        variant: 'destructive',
      });
    }
  };

  const formatEndereco = (coluna: number, nivel: number, posicao: number) => {
    return `${String(coluna).padStart(2, '0')}.${String(nivel).padStart(2, '0')}.${String(posicao).padStart(2, '0')}`;
  };

  // Show loading while checking config
  if (isCheckingConfig) {
    return (
      <div className="flex h-screen flex-col bg-background">
        <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2 shrink-0">
          <button
            onClick={() => navigate('/')}
            className="rounded-lg p-1.5 hover:bg-accent"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <img src={logoImex} alt="IMEX Solutions" className="h-6" />
          <h1 className="text-base font-bold">Consulta por Rua</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  // Bloqueio para usuários comuns durante inventário
  if (!isAdmin && bloqueadoParaUsuarios) {
    return (
      <div className="flex h-screen flex-col bg-background">
        <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2 shrink-0">
          <button
            onClick={() => navigate('/')}
            className="rounded-lg p-1.5 hover:bg-accent"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <img src={logoImex} alt="IMEX Solutions" className="h-6" />
          <h1 className="text-base font-bold">Consulta por Rua</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="rounded-full bg-amber-500/10 p-6 mb-4">
            <AlertTriangle className="h-12 w-12 text-amber-500" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Inventário em Andamento</h2>
          <p className="text-muted-foreground max-w-sm">
            Os dados de estoque estão temporariamente indisponíveis enquanto o inventário oficial está sendo realizado.
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            Aguarde a conclusão do inventário para acessar as informações.
          </p>
          <Button onClick={() => navigate('/')} className="mt-6">
            Voltar ao Menu
          </Button>
        </div>
      </div>
    );
  }

  // Show loading while auth is loading
  if (authLoading) {
    return (
      <div className="flex h-screen flex-col bg-background">
        <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2 shrink-0">
          <button
            onClick={() => navigate('/')}
            className="rounded-lg p-1.5 hover:bg-accent"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <img src={logoImex} alt="IMEX Solutions" className="h-6" />
          <h1 className="text-base font-bold">Consulta por Rua</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
        <h1 className="text-base font-bold">Consulta por Rua</h1>
      </div>

      {/* Busca */}
      <div className="border-b border-border bg-card px-3 py-3 shrink-0">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="number"
              inputMode="numeric"
              placeholder="Número da Rua"
              value={rua}
              onChange={(e) => setRua(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
              className="pl-9 h-10"
            />
          </div>
          <Button onClick={handleBuscar} disabled={isLoading} className="h-10">
            Buscar
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowScanner(true)}
            className="h-10 w-10 shrink-0"
            title="Ler QR Code"
          >
            <QrCode className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : ruaSelecionada === null ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground p-4 text-center">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <QrCode className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">Consulta de Estoque por Rua</h2>
            <p className="text-sm max-w-xs">
              Digite o número da rua ou escaneie o QR Code para ver todos os materiais disponíveis.
            </p>
          </div>
        ) : materiais.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Package className="h-8 w-8 mb-2" />
            <p className="text-sm">Nenhum material na Rua {String(ruaSelecionada).padStart(2, '0')}</p>
          </div>
        ) : (
          <div className="p-3">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-foreground">
                Rua {String(ruaSelecionada).padStart(2, '0')}
              </h2>
              <span className="text-sm text-muted-foreground">
                {materiais.length} {materiais.length === 1 ? 'material' : 'materiais'}
              </span>
            </div>

            <div className="space-y-2">
              {materiais.map((material) => (
                <div
                  key={material.id}
                  className="rounded-lg border border-border bg-card p-3"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-semibold text-primary">
                          {material.codigo}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {material.tipo_material}
                        </span>
                      </div>
                      <p className="text-sm text-foreground truncate" title={material.descricao}>
                        {material.descricao}
                      </p>
                      {material.fabricante_nome && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {material.fabricante_nome}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-muted-foreground">Qtd</div>
                      <div className="text-lg font-bold text-primary">
                        {material.quantidade_inventario ?? 0}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-2 mt-2">
                    <span>
                      Endereço: <span className="font-mono font-medium text-foreground">
                        {formatEndereco(material.coluna, material.nivel, material.posicao)}
                      </span>
                    </span>
                    {material.peso > 0 && (
                      <span>Peso: {material.peso} kg</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* QR Scanner Modal */}
      {showScanner && (
        <QRScanner
          onScan={handleQRScan}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
};

export default EstoqueRua;
