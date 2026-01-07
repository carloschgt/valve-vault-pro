import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Package, Loader2, ScanLine, X, MapPin, Scale, Tag, Factory } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import logoImex from '@/assets/logo-imex.png';
import { supabase } from '@/integrations/supabase/client';
import { QRScanner } from '@/components/QRScanner';

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

interface MaterialDetail {
  codigo: string;
  descricao: string;
  tipo_material: string;
  peso: number;
  fabricante: string;
  endereco: string;
  rua: number;
  coluna: number;
  nivel: number;
  posicao: number;
  quantidade: number;
  endereco_id: string;
}

interface QRData {
  cod?: string;
  codigo?: string;
  end?: string;
  endereco?: string;
  desc?: string;
  descricao?: string;
  fab?: string;
  fabricante?: string;
  tipo?: string;
  tipoMaterial?: string;
  peso?: number;
}

const EstoqueAtual = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.tipo === 'admin';

  const [search, setSearch] = useState('');
  const [estoque, setEstoque] = useState<EstoqueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [scannedMaterial, setScannedMaterial] = useState<MaterialDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [bloqueadoParaUsuarios, setBloqueadoParaUsuarios] = useState(false);
  const [isCheckingConfig, setIsCheckingConfig] = useState(true);

  // Check inventory config for stock view block
  useEffect(() => {
    const checkConfig = async () => {
      setIsCheckingConfig(true);
      try {
        const sessionToken = getSessionToken();
        if (!sessionToken) return;

        const { data, error } = await supabase.functions.invoke('data-operations', {
          body: { action: 'inventario_config_get', sessionToken },
        });

        if (!error && data?.success && data?.data) {
          setBloqueadoParaUsuarios(data.data.bloquear_visualizacao_estoque || false);
        }
      } catch (error) {
        console.error('Erro ao verificar configuração:', error);
      } finally {
        setIsCheckingConfig(false);
      }
    };
    checkConfig();
  }, []);

  useEffect(() => {
    if (isAdmin && !isCheckingConfig) {
      loadEstoque();
    } else if (!isAdmin && !isCheckingConfig && !bloqueadoParaUsuarios) {
      loadEstoque();
    }
  }, [isAdmin, isCheckingConfig, bloqueadoParaUsuarios]);

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
        body: { action: 'estoque_atual', sessionToken, search, _t: Date.now() },
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

  const handleQRScan = async (data: string) => {
    setShowScanner(false);
    setIsLoadingDetail(true);
    
    try {
      // Parse QR data
      let qrData: QRData;
      try {
        qrData = JSON.parse(data);
      } catch {
        toast({
          title: 'Erro',
          description: 'QR Code inválido',
          variant: 'destructive',
        });
        setIsLoadingDetail(false);
        return;
      }

      const codigo = qrData.cod || qrData.codigo;
      const endereco = qrData.end || qrData.endereco;

      if (!codigo) {
        toast({
          title: 'Erro',
          description: 'QR Code não contém código do material',
          variant: 'destructive',
        });
        setIsLoadingDetail(false);
        return;
      }

      const sessionToken = getSessionToken();
      if (!sessionToken) {
        toast({
          title: 'Erro',
          description: 'Sessão expirada. Faça login novamente.',
          variant: 'destructive',
        });
        setIsLoadingDetail(false);
        return;
      }

      // Buscar detalhes do material com endereço específico
      const { data: result, error } = await supabase.functions.invoke('data-operations', {
        body: { 
          action: 'estoque_detalhe', 
          sessionToken, 
          codigo,
          endereco 
        },
      });

      if (error) throw error;
      if (!result.success) throw new Error(result.error);

      if (!result.data) {
        toast({
          title: 'Não encontrado',
          description: 'Material não encontrado no estoque',
          variant: 'destructive',
        });
        setIsLoadingDetail(false);
        return;
      }

      setScannedMaterial(result.data);
    } catch (error: any) {
      console.error('Erro ao buscar material:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao buscar material',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Recarregar quando busca mudar (com debounce)
  useEffect(() => {
    if (isCheckingConfig) return;
    if (!isAdmin && bloqueadoParaUsuarios) return;
    
    const timer = setTimeout(() => {
      loadEstoque();
    }, 300);

    return () => clearTimeout(timer);
  }, [search, isAdmin, isCheckingConfig, bloqueadoParaUsuarios]);

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
          <h1 className="text-base font-bold">Estoque Atual</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  // Show blocked message for non-admin users when inventory is in progress
  if (!isAdmin && bloqueadoParaUsuarios) {
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

        {/* Inventory in progress message */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="rounded-full bg-amber-500/20 p-6 mb-4">
            <Package className="h-12 w-12 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Inventário em Andamento</h2>
          <p className="text-muted-foreground max-w-sm">
            Está sendo realizado um inventário oficial. Os dados de estoque não podem ser visualizados até que o resultado oficial seja ajustado e publicado.
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
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar... (use * como coringa, ex: 002*)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowScanner(true)}
            className="h-9 w-9 shrink-0"
          >
            <ScanLine className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Material Detail Modal */}
      {(scannedMaterial || isLoadingDetail) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-lg w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h2 className="font-bold text-lg">Detalhes do Material</h2>
              <button
                onClick={() => setScannedMaterial(null)}
                className="rounded-lg p-1.5 hover:bg-accent"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isLoadingDetail ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : scannedMaterial ? (
              <div className="p-4 space-y-4">
                {/* Código e Descrição */}
                <div className="bg-primary/10 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Tag className="h-4 w-4 text-primary" />
                    <span className="text-xs font-medium text-muted-foreground uppercase">Código</span>
                  </div>
                  <p className="text-xl font-bold text-foreground">{scannedMaterial.codigo}</p>
                  <p className="text-sm text-muted-foreground mt-1">{scannedMaterial.descricao}</p>
                </div>

                {/* Endereço e Quantidade */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground uppercase">Endereço</span>
                    </div>
                    <p className="text-lg font-bold text-foreground">{scannedMaterial.endereco}</p>
                    <p className="text-xs text-muted-foreground">
                      R{String(scannedMaterial.rua).padStart(2, '0')} - 
                      C{String(scannedMaterial.coluna).padStart(2, '0')} - 
                      N{String(scannedMaterial.nivel).padStart(2, '0')} - 
                      P{String(scannedMaterial.posicao).padStart(2, '0')}
                    </p>
                  </div>

                  <div className="bg-green-500/10 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Package className="h-4 w-4 text-green-600" />
                      <span className="text-xs font-medium text-muted-foreground uppercase">Quantidade</span>
                    </div>
                    <p className="text-2xl font-bold text-green-600">{scannedMaterial.quantidade}</p>
                    <p className="text-xs text-muted-foreground">unidades</p>
                  </div>
                </div>

                {/* Atributos */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <span className="text-xs font-medium text-muted-foreground uppercase block mb-1">Tipo</span>
                    <p className="text-sm font-semibold text-foreground">{scannedMaterial.tipo_material}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="flex items-center gap-1 mb-1">
                      <Scale className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground uppercase">Peso Unit.</span>
                    </div>
                    <p className="text-sm font-semibold text-foreground">{scannedMaterial.peso} kg</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="flex items-center gap-1 mb-1">
                      <Factory className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground uppercase">Fabricante</span>
                    </div>
                    <p className="text-sm font-semibold text-foreground truncate" title={scannedMaterial.fabricante}>
                      {scannedMaterial.fabricante}
                    </p>
                  </div>
                </div>

                {/* Close Button */}
                <Button 
                  className="w-full" 
                  onClick={() => setScannedMaterial(null)}
                >
                  Fechar
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* QR Scanner */}
      {showScanner && (
        <QRScanner
          onScan={handleQRScan}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Tabela */}
      <div className="flex-1 flex flex-col min-h-0">
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
          <>
            {/* Header fixo */}
            <div className="overflow-x-auto shrink-0 bg-card border-b-2 border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="px-1.5 py-2 text-left font-semibold bg-card w-[52px] min-w-[52px]">Código</th>
                    <th className="px-1.5 py-2 text-left font-semibold bg-card">Descrição</th>
                    <th className="px-1 py-2 text-left font-semibold bg-card w-[45px] min-w-[45px]">Tipo</th>
                    <th className="px-0.5 py-2 text-center font-semibold bg-card w-[28px] min-w-[28px]">R</th>
                    <th className="px-0.5 py-2 text-center font-semibold bg-card w-[28px] min-w-[28px]">C</th>
                    <th className="px-0.5 py-2 text-center font-semibold bg-card w-[28px] min-w-[28px]">N</th>
                    <th className="px-0.5 py-2 text-center font-semibold bg-card w-[28px] min-w-[28px]">P</th>
                    <th className="px-0.5 py-2 text-center font-semibold bg-card w-[32px] min-w-[32px]">Qtd</th>
                    <th className="px-1 py-2 text-center font-semibold bg-primary/10 w-[38px] min-w-[38px]">Total</th>
                  </tr>
                </thead>
              </table>
            </div>
            {/* Body com scroll */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-xs">
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
                              className="px-1.5 py-1.5 font-medium text-foreground align-top w-[52px] min-w-[52px]"
                              rowSpan={item.enderecos.length}
                            >
                              {item.codigo}
                            </td>
                            <td 
                              className="px-1.5 py-1.5 text-muted-foreground align-top break-words"
                              rowSpan={item.enderecos.length}
                            >
                              {item.descricao}
                            </td>
                            <td 
                              className="px-1 py-1.5 text-muted-foreground align-top w-[45px] min-w-[45px]"
                              rowSpan={item.enderecos.length}
                            >
                              {item.tipo_material}
                            </td>
                          </>
                        ) : null}
                        <td className="px-0.5 py-1.5 text-center w-[28px] min-w-[28px]">{String(end.rua).padStart(2, '0')}</td>
                        <td className="px-0.5 py-1.5 text-center w-[28px] min-w-[28px]">{String(end.coluna).padStart(2, '0')}</td>
                        <td className="px-0.5 py-1.5 text-center w-[28px] min-w-[28px]">{String(end.nivel).padStart(2, '0')}</td>
                        <td className="px-0.5 py-1.5 text-center w-[28px] min-w-[28px]">{String(end.posicao).padStart(2, '0')}</td>
                        <td className="px-0.5 py-1.5 text-center font-medium w-[32px] min-w-[32px]">{end.quantidade}</td>
                        {endIdx === 0 ? (
                          <td 
                            className="px-1 py-1.5 text-center font-bold text-primary bg-primary/5 align-top w-[38px] min-w-[38px]"
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
          </>
        )}
      </div>
    </div>
  );
};

export default EstoqueAtual;
