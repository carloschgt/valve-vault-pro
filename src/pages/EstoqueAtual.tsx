import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Search, Package, Loader2, ScanLine, X, MapPin, Scale, Tag, Factory, Download, Warehouse, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useUserPermissions, MENU_KEYS } from '@/hooks/useUserPermissions';
import logoImex from '@/assets/logo-imex.png';
import { supabase } from '@/integrations/supabase/client';
import { QRScanner } from '@/components/QRScanner';
import { exportEstoqueToExcel } from '@/utils/exportEstoqueExcel';

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
  descricao_imex: string | null;
  tipo_material: string;
  enderecos: {
    rua: number;
    coluna: number;
    nivel: number;
    posicao: number;
    quantidade: number;
    qtd_reservada: number;
    endereco_id: string;
  }[];
  qtd_total: number;
  qtd_reservada_total: number;
  valor_unitario: number | null;
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

interface ResumoEstoque {
  codigo: string;
  estoque_enderecado: {
    endereco_id: string;
    rua: number;
    coluna: number;
    nivel: number;
    posicao: number;
    quantidade: number;
    qtd_reservada: number;
    disponivel: number;
  }[];
  totais: {
    total_estoque_enderecado: number;
    total_reservado: number;
    total_disponivel: number;
  };
  alocacoes: {
    WIP: number;
    QUALIDADE: number;
    QUALIDADE_REPROVADO: number;
    EXPEDICAO: number;
  };
  total_geral: number;
}

const EstoqueAtual = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const { hasPermission, isAdmin, isLoading: permissionsLoading } = useUserPermissions();
  
  // Verifica se o usuário pode ver estoque durante inventário
  const canBypassInventoryBlock = hasPermission(MENU_KEYS.bypass_inventario_block);
  // Verifica se o usuário pode ver valores financeiros
  const canSeeValues = hasPermission(MENU_KEYS.ver_valores);

  // Initialize search from URL parameter if present
  const initialSearch = searchParams.get('search') || '';
  const [search, setSearch] = useState(initialSearch);
  const [estoque, setEstoque] = useState<EstoqueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [scannedMaterial, setScannedMaterial] = useState<MaterialDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [bloqueadoParaUsuarios, setBloqueadoParaUsuarios] = useState(false);
  const [isCheckingConfig, setIsCheckingConfig] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  
  // Detalhe por item (drawer com alocações)
  const [selectedItem, setSelectedItem] = useState<EstoqueItem | null>(null);
  const [resumoDetalhe, setResumoDetalhe] = useState<ResumoEstoque | null>(null);
  const [isLoadingResumo, setIsLoadingResumo] = useState(false);

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
    // Admin ou usuários com permissão bypass sempre podem ver
    if ((isAdmin || canBypassInventoryBlock) && !isCheckingConfig) {
      loadEstoque();
    } else if (!isAdmin && !canBypassInventoryBlock && !isCheckingConfig && !bloqueadoParaUsuarios) {
      loadEstoque();
    }
  }, [isAdmin, canBypassInventoryBlock, isCheckingConfig, bloqueadoParaUsuarios]);

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
    // Se estiver bloqueado e usuário não tem bypass, não carrega
    if (!isAdmin && !canBypassInventoryBlock && bloqueadoParaUsuarios) return;
    
    const timer = setTimeout(() => {
      loadEstoque();
    }, 300);

    return () => clearTimeout(timer);
  }, [search, isAdmin, canBypassInventoryBlock, isCheckingConfig, bloqueadoParaUsuarios]);

  // Handler para abrir detalhe do item com alocações
  const handleOpenDetail = async (item: EstoqueItem) => {
    setSelectedItem(item);
    setIsLoadingResumo(true);
    try {
      const sessionToken = getSessionToken();
      if (!sessionToken) return;
      
      const { data, error } = await supabase.functions.invoke('data-operations', {
        body: { action: 'estoque_resumo_codigo', sessionToken, codigo: item.codigo },
      });
      
      if (!error && data?.success) {
        setResumoDetalhe(data.data);
      }
    } catch (err) {
      console.error('Erro ao buscar resumo:', err);
    } finally {
      setIsLoadingResumo(false);
    }
  };

  // Handler para exportar Excel
  const handleExportExcel = () => {
    if (estoque.length === 0) {
      toast({
        title: 'Aviso',
        description: 'Nenhum dado para exportar',
        variant: 'destructive',
      });
      return;
    }

    setIsExporting(true);
    try {
      exportEstoqueToExcel(estoque);
      toast({
        title: 'Sucesso',
        description: `${estoque.length} itens exportados para Excel`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao exportar',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Format currency
  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
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
          <h1 className="text-base font-bold">Estoque Atual</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  // Show blocked message for non-admin users without bypass permission when inventory is in progress
  if (!isAdmin && !canBypassInventoryBlock && bloqueadoParaUsuarios) {
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
      <div className="flex items-center justify-between gap-2 border-b border-border bg-card px-3 py-2 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/')}
            className="rounded-lg p-1.5 hover:bg-accent"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <img src={logoImex} alt="IMEX Solutions" className="h-6" />
          <h1 className="text-base font-bold">Estoque Atual</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportExcel}
          disabled={isExporting || estoque.length === 0}
          className="gap-1"
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">Excel</span>
        </Button>
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

      {/* Drawer de Detalhe por Item */}
      <Sheet open={!!selectedItem} onOpenChange={() => { setSelectedItem(null); setResumoDetalhe(null); }}>
        <SheetContent className="w-full sm:max-w-md overflow-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {selectedItem?.codigo}
            </SheetTitle>
          </SheetHeader>
          
          {isLoadingResumo ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : resumoDetalhe ? (
            <div className="mt-4 space-y-4">
              {/* Cards de saldo por local */}
              <div className="grid grid-cols-2 gap-2">
                <Card className="bg-blue-500/10">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground"><Warehouse className="h-3 w-3" />Endereçado</div>
                    <p className="text-lg font-bold text-blue-600">{resumoDetalhe.totais.total_estoque_enderecado}</p>
                  </CardContent>
                </Card>
                <Card className="bg-amber-500/10">
                  <CardContent className="p-3">
                    <div className="text-xs text-muted-foreground">WIP</div>
                    <p className="text-lg font-bold text-amber-600">{resumoDetalhe.alocacoes.WIP}</p>
                  </CardContent>
                </Card>
                <Card className="bg-purple-500/10">
                  <CardContent className="p-3">
                    <div className="text-xs text-muted-foreground">Qualidade</div>
                    <p className="text-lg font-bold text-purple-600">{resumoDetalhe.alocacoes.QUALIDADE}</p>
                  </CardContent>
                </Card>
                <Card className="bg-red-500/10">
                  <CardContent className="p-3">
                    <div className="text-xs text-muted-foreground">Reprovado</div>
                    <p className="text-lg font-bold text-red-600">{resumoDetalhe.alocacoes.QUALIDADE_REPROVADO}</p>
                  </CardContent>
                </Card>
                <Card className="bg-green-500/10">
                  <CardContent className="p-3">
                    <div className="text-xs text-muted-foreground">Expedição</div>
                    <p className="text-lg font-bold text-green-600">{resumoDetalhe.alocacoes.EXPEDICAO}</p>
                  </CardContent>
                </Card>
                <Card className="bg-primary/10">
                  <CardContent className="p-3">
                    <div className="text-xs text-muted-foreground font-semibold">TOTAL</div>
                    <p className="text-xl font-bold text-primary">{resumoDetalhe.total_geral}</p>
                  </CardContent>
                </Card>
              </div>
              
              {/* Lista de endereços */}
              {resumoDetalhe.estoque_enderecado.length > 0 && (
                <div className="border rounded-lg">
                  <div className="px-3 py-2 bg-muted/50 text-xs font-semibold">Endereços</div>
                  <div className="divide-y">
                    {resumoDetalhe.estoque_enderecado.map((e) => (
                      <div key={e.endereco_id} className="px-3 py-2 flex justify-between text-sm">
                        <span className="font-mono text-xs">R{String(e.rua).padStart(2,'0')}.C{String(e.coluna).padStart(2,'0')}.N{String(e.nivel).padStart(2,'0')}.P{String(e.posicao).padStart(2,'0')}</span>
                        <span>Disp: <strong className="text-green-600">{e.disponivel}</strong></span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <Button variant="outline" className="w-full" onClick={() => navigate('/inventario-alocacoes')}>
                Gerenciar Alocações
              </Button>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

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
              <table className={`w-full text-xs sm:text-sm table-fixed ${canSeeValues ? 'min-w-[1000px]' : 'min-w-[800px]'}`}>
                <colgroup>
                  <col className="w-[70px] sm:w-[90px] lg:w-[100px]" />
                  <col className="w-[90px] sm:w-[120px] lg:w-[150px]" />
                  <col className="w-auto" />
                  <col className="w-[55px] sm:w-[70px] lg:w-[80px]" />
                  <col className="w-[32px] sm:w-[40px] lg:w-[50px]" />
                  <col className="w-[32px] sm:w-[40px] lg:w-[50px]" />
                  <col className="w-[32px] sm:w-[40px] lg:w-[50px]" />
                  <col className="w-[32px] sm:w-[40px] lg:w-[50px]" />
                  <col className="w-[38px] sm:w-[50px] lg:w-[60px]" />
                  <col className="w-[38px] sm:w-[50px] lg:w-[60px]" />
                  <col className="w-[45px] sm:w-[55px] lg:w-[65px]" />
                  {canSeeValues && (
                    <>
                      <col className="w-[70px] sm:w-[80px] lg:w-[90px]" />
                      <col className="w-[80px] sm:w-[90px] lg:w-[100px]" />
                    </>
                  )}
                </colgroup>
                <thead>
                  <tr>
                    <th className="px-2 py-2 text-left font-semibold bg-card">Código</th>
                    <th className="px-2 py-2 text-left font-semibold bg-card">Desc. Imex</th>
                    <th className="px-2 py-2 text-left font-semibold bg-card">Descrição</th>
                    <th className="px-2 py-2 text-left font-semibold bg-card">Tipo</th>
                    <th className="px-1 py-2 text-center font-semibold bg-card">R</th>
                    <th className="px-1 py-2 text-center font-semibold bg-card">C</th>
                    <th className="px-1 py-2 text-center font-semibold bg-card">N</th>
                    <th className="px-1 py-2 text-center font-semibold bg-card">P</th>
                    <th className="px-1 py-2 text-center font-semibold bg-card">Qtd</th>
                    <th className="px-1 py-2 text-center font-semibold bg-amber-500/10" title="Quantidade reservada para separação">Res.</th>
                    <th className="px-1 py-2 text-center font-semibold bg-primary/10">Total</th>
                    {canSeeValues && (
                      <>
                        <th className="px-1 py-2 text-center font-semibold bg-green-500/10">V. Unit.</th>
                        <th className="px-1 py-2 text-center font-semibold bg-green-500/10">V. Total</th>
                      </>
                    )}
                  </tr>
                </thead>
              </table>
            </div>
            {/* Body com scroll */}
            <div className="flex-1 overflow-auto">
              <table className={`w-full text-xs sm:text-sm table-fixed ${canSeeValues ? 'min-w-[1000px]' : 'min-w-[800px]'}`}>
                <colgroup>
                  <col className="w-[70px] sm:w-[90px] lg:w-[100px]" />
                  <col className="w-[90px] sm:w-[120px] lg:w-[150px]" />
                  <col className="w-auto" />
                  <col className="w-[55px] sm:w-[70px] lg:w-[80px]" />
                  <col className="w-[32px] sm:w-[40px] lg:w-[50px]" />
                  <col className="w-[32px] sm:w-[40px] lg:w-[50px]" />
                  <col className="w-[32px] sm:w-[40px] lg:w-[50px]" />
                  <col className="w-[32px] sm:w-[40px] lg:w-[50px]" />
                  <col className="w-[38px] sm:w-[50px] lg:w-[60px]" />
                  <col className="w-[38px] sm:w-[50px] lg:w-[60px]" />
                  <col className="w-[45px] sm:w-[55px] lg:w-[65px]" />
                  {canSeeValues && (
                    <>
                      <col className="w-[70px] sm:w-[80px] lg:w-[90px]" />
                      <col className="w-[80px] sm:w-[90px] lg:w-[100px]" />
                    </>
                  )}
                </colgroup>
                <tbody>
                  {estoque.map((item, idx) => {
                    // Os endereços já vêm ordenados do backend por rua, coluna, nivel, posicao
                    const enderecos = item.enderecos;
                    const valorTotal = item.valor_unitario !== null ? item.valor_unitario * item.qtd_total : null;
                    const handleRowClick = () => handleOpenDetail(item);
                    
                    return enderecos.map((end, endIdx) => (
                      <tr 
                        key={`${item.codigo}-${end.endereco_id}`}
                        className={`border-b border-border/50 ${endIdx === 0 && idx > 0 ? 'border-t-2 border-t-border' : ''}`}
                      >
                        {endIdx === 0 ? (
                          <>
                            <td 
                              className="px-2 py-2 font-medium text-foreground align-top"
                              rowSpan={enderecos.length}
                            >
                              {item.codigo}
                            </td>
                            <td 
                              className="px-2 py-2 text-muted-foreground align-top break-words text-xs"
                              rowSpan={enderecos.length}
                            >
                              {item.descricao_imex || '-'}
                            </td>
                            <td 
                              className="px-2 py-2 text-muted-foreground align-top break-words"
                              rowSpan={enderecos.length}
                            >
                              {item.descricao}
                            </td>
                            <td 
                              className="px-2 py-2 text-muted-foreground align-top"
                              rowSpan={enderecos.length}
                            >
                              {item.tipo_material}
                            </td>
                          </>
                        ) : null}
                        <td className="px-1 py-2 text-center">{String(end.rua).padStart(2, '0')}</td>
                        <td className="px-1 py-2 text-center">{String(end.coluna).padStart(2, '0')}</td>
                        <td className="px-1 py-2 text-center">{String(end.nivel).padStart(2, '0')}</td>
                        <td className="px-1 py-2 text-center">{String(end.posicao).padStart(2, '0')}</td>
                        <td className="px-1 py-2 text-center font-medium">{end.quantidade}</td>
                        <td className={`px-1 py-2 text-center font-medium ${end.qtd_reservada > 0 ? 'text-amber-600 bg-amber-500/5' : 'text-muted-foreground'}`}>
                          {end.qtd_reservada || 0}
                        </td>
                        {endIdx === 0 ? (
                          <>
                            <td 
                              className="px-1 py-2 text-center font-bold text-primary bg-primary/5 align-top"
                              rowSpan={enderecos.length}
                            >
                              {item.qtd_total + (item.qtd_reservada_total || 0)}
                            </td>
                            {canSeeValues && (
                              <>
                                <td 
                                  className="px-1 py-2 text-center text-xs font-medium text-green-600 bg-green-500/5 align-top"
                                  rowSpan={enderecos.length}
                                >
                                  {formatCurrency(item.valor_unitario)}
                                </td>
                                <td 
                                  className="px-1 py-2 text-center text-xs font-bold text-green-700 bg-green-500/10 align-top"
                                  rowSpan={enderecos.length}
                                >
                                  {formatCurrency(valorTotal)}
                                </td>
                              </>
                            )}
                          </>
                        ) : null}
                      </tr>
                    ));
                  })}
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