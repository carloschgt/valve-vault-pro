import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin,
  ClipboardList,
  Warehouse,
  QrCode,
  AlertTriangle,
  CheckSquare,
  FilePlus,
  Shield,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPermissions, MENU_KEYS } from '@/hooks/useUserPermissions';
import { exportEnderecos, exportInventario, getHomeStats } from '@/hooks/useDataOperations';
import { exportEnderecamentosToCSV, exportInventarioToCSV } from '@/utils/exportEnderecamentos';
import { QRScanner } from '@/components/QRScanner';

// New components
import { HomeHeader } from '@/components/home/HomeHeader';
import { HomeSearchBar } from '@/components/home/HomeSearchBar';
import { QuickActionCard } from '@/components/home/QuickActionCard';
import { PanelCard } from '@/components/home/PanelCard';
import { PendingBadge } from '@/components/home/PendingBadge';
import { BottomNavigation } from '@/components/home/BottomNavigation';
import { MenuSheet } from '@/components/home/MenuSheet';

interface QRData {
  cod?: string;
  codigo?: string;
  end?: string;
  endereco?: string;
  rua?: number;
}

interface HomeStats {
  totalItens: number;
  divergencias: number;
  codigosPendentes: number;
  codigosAprovados: number;
}

const Home = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, logout } = useAuth();
  const { hasPermission, isAdmin, isSuperAdmin } = useUserPermissions();
  const [isExporting, setIsExporting] = useState<'enderecamentos' | 'inventario' | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [showMenuSheet, setShowMenuSheet] = useState(false);
  const [stats, setStats] = useState<HomeStats>({
    totalItens: 0,
    divergencias: 0,
    codigosPendentes: 0,
    codigosAprovados: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // Fetch stats using authenticated endpoint
  useEffect(() => {
    const fetchStats = async () => {
      setStatsLoading(true);
      try {
        const result = await getHomeStats();
        if (result.success && result.data) {
          setStats({
            totalItens: result.data.totalItens || 0,
            divergencias: result.data.divergencias || 0,
            codigosPendentes: result.data.codigosPendentes || 0,
            codigosAprovados: result.data.codigosAprovados || 0,
          });
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setStatsLoading(false);
      }
    };

    fetchStats();
  }, []);

  // Handle QR code scan
  const handleQRScan = (data: string) => {
    setShowScanner(false);

    // URL check
    if (data.startsWith('http://') || data.startsWith('https://')) {
      try {
        const url = new URL(data);

        if (url.pathname.includes('/estoque-rua') || url.pathname.includes('estoque-rua')) {
          const ruaParam = url.searchParams.get('rua');
          if (ruaParam) {
            const ruaNum = parseInt(ruaParam);
            if (!isNaN(ruaNum) && ruaNum > 0) {
              navigate(`/estoque-rua?rua=${ruaNum}`);
              toast({
                title: 'Rua identificada',
                description: `Carregando materiais da Rua ${String(ruaNum).padStart(2, '0')}`,
              });
              return;
            }
          }
        }

        if (url.pathname.includes('/estoque-atual')) {
          const searchParam = url.searchParams.get('search');
          if (searchParam) {
            navigate(`/estoque-atual?search=${encodeURIComponent(searchParam)}`);
            toast({
              title: 'Material identificado',
              description: `Buscando código ${searchParam}`,
            });
            return;
          }
        }
      } catch {
        // Continue
      }
    }

    // JSON parse
    try {
      const qrData: QRData = JSON.parse(data);

      if (qrData.cod || qrData.codigo) {
        const codigo = qrData.cod || qrData.codigo;
        navigate(`/estoque-atual?search=${encodeURIComponent(codigo || '')}`);
        toast({
          title: 'Material identificado',
          description: `Buscando código ${codigo}`,
        });
        return;
      }

      if (qrData.rua !== undefined) {
        navigate(`/estoque-rua?rua=${qrData.rua}`);
        toast({
          title: 'Rua identificada',
          description: `Carregando materiais da Rua ${String(qrData.rua).padStart(2, '0')}`,
        });
        return;
      }

      toast({
        title: 'QR Code não reconhecido',
        description: 'Este QR code não contém informações de material ou rua',
        variant: 'destructive',
      });
    } catch {
      // Number check
      const ruaNum = parseInt(data);
      if (!isNaN(ruaNum) && ruaNum > 0 && ruaNum <= 99) {
        navigate(`/estoque-rua?rua=${ruaNum}`);
        toast({
          title: 'Rua identificada',
          description: `Carregando materiais da Rua ${String(ruaNum).padStart(2, '0')}`,
        });
        return;
      }

      // 6-digit code
      if (data.match(/^\d{6}$/)) {
        navigate(`/estoque-atual?search=${encodeURIComponent(data)}`);
        toast({
          title: 'Material identificado',
          description: `Buscando código ${data}`,
        });
        return;
      }

      toast({
        title: 'QR Code inválido',
        description: 'Não foi possível interpretar o conteúdo do QR Code',
        variant: 'destructive',
      });
    }
  };

  const handleExportEnderecamentos = async () => {
    setIsExporting('enderecamentos');
    try {
      const result = await exportEnderecos();

      if (!result.success) {
        throw new Error(result.error);
      }

      if (!result.data || result.data.length === 0) {
        toast({
          title: 'Aviso',
          description: 'Nenhum endereçamento encontrado para exportar',
          variant: 'destructive',
        });
        return;
      }

      exportEnderecamentosToCSV(result.data);
      toast({ title: 'Sucesso', description: `${result.data.length} endereçamentos exportados!` });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao exportar',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportInventario = async () => {
    setIsExporting('inventario');
    try {
      const result = await exportInventario();

      if (!result.success) {
        throw new Error(result.error);
      }

      if (!result.data || result.data.length === 0) {
        toast({
          title: 'Aviso',
          description: 'Nenhum inventário encontrado para exportar',
          variant: 'destructive',
        });
        return;
      }

      exportInventarioToCSV(result.data);
      toast({ title: 'Sucesso', description: `${result.data.length} registros de inventário exportados!` });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao exportar',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(null);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      {/* Header */}
      <HomeHeader
        userName={user?.nome || 'Usuário'}
        userEmail={user?.email || ''}
        isAdmin={isAdmin}
        isSuperAdmin={isSuperAdmin}
        onLogout={handleLogout}
      />

      {/* Search Bar */}
      <HomeSearchBar onScanClick={() => setShowScanner(true)} />

      {/* Main Content */}
      <main className="flex-1 px-4 pb-4 space-y-6 animate-fade-in">
        {/* Greeting */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground">
              Olá, {user?.nome?.split(' ')[0] || 'Usuário'}!
            </h1>
            <p className="text-sm text-muted-foreground">O que você precisa fazer hoje?</p>
          </div>
          {isSuperAdmin && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
              <Shield className="h-3 w-3" />
              Super Admin
            </span>
          )}
        </div>

        {/* Quick Actions */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Ações Rápidas</h2>
          <div className="grid grid-cols-2 gap-3">
            {hasPermission(MENU_KEYS.enderecamento) && (
              <QuickActionCard
                title="Endereçar Material"
                icon={MapPin}
                onClick={() => navigate('/enderecamento')}
                variant="teal"
              />
            )}
            {hasPermission(MENU_KEYS.inventario) && (
              <QuickActionCard
                title="Inventariar / Contar"
                icon={ClipboardList}
                onClick={() => navigate('/inventario')}
                variant="secondary"
              />
            )}
            {hasPermission(MENU_KEYS.estoque_rua) && (
              <QuickActionCard
                title="Consultar por Rua"
                icon={Warehouse}
                onClick={() => navigate('/estoque-rua')}
                variant="blue"
              />
            )}
            {hasPermission(MENU_KEYS.etiquetas) && (
              <QuickActionCard
                title="Gerar Etiquetas"
                icon={QrCode}
                onClick={() => navigate('/etiquetas')}
                variant="purple"
              />
            )}
          </div>
        </section>

        {/* Panels */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Painéis</h2>
          <div className="grid grid-cols-2 gap-3">
            {hasPermission(MENU_KEYS.dashboard) && (
              <PanelCard
                title="Dashboard Tempo Real"
                onClick={() => navigate('/dashboard')}
                variant="dashboard"
              />
            )}
            {hasPermission(MENU_KEYS.estoque_atual) && (
              <PanelCard
                title="Estoque Atual"
                onClick={() => navigate('/estoque-atual')}
                variant="estoque"
                stats={{
                  total: stats.totalItens,
                  divergencias: stats.divergencias,
                }}
              />
            )}
          </div>
        </section>

        {/* Pending Items */}
        {(hasPermission(MENU_KEYS.relatorio_inventario) ||
          hasPermission(MENU_KEYS.processar_codigos) ||
          hasPermission(MENU_KEYS.solicitar_codigo)) && (
          <section>
            <h2 className="mb-3 text-sm font-semibold text-foreground">Pendências</h2>
            <div className="grid grid-cols-2 gap-3">
              {hasPermission(MENU_KEYS.relatorio_inventario) && (
                <PendingBadge
                  title="Divergências Abertas"
                  count={stats.divergencias}
                  icon={AlertTriangle}
                  onClick={() => navigate('/relatorio-inventario')}
                  variant="warning"
                />
              )}
              {hasPermission(MENU_KEYS.processar_codigos) && (
                <PendingBadge
                  title="Códigos para Processar"
                  count={stats.codigosAprovados}
                  icon={CheckSquare}
                  onClick={() => navigate('/processar-codigos')}
                  variant="info"
                />
              )}
              {hasPermission(MENU_KEYS.aprovacao_codigos) && (
                <PendingBadge
                  title="Aguardando Aprovação"
                  count={stats.codigosPendentes}
                  icon={Shield}
                  onClick={() => navigate('/aprovacao-codigos')}
                  variant="purple"
                />
              )}
              {hasPermission(MENU_KEYS.solicitar_codigo) && (
                <PendingBadge
                  title="Solicitar Código"
                  subtitle="Novo material"
                  count={0}
                  icon={FilePlus}
                  onClick={() => navigate('/solicitacoes-codigo')}
                  variant="default"
                />
              )}
            </div>
          </section>
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNavigation onMenuClick={() => setShowMenuSheet(true)} />

      {/* Menu Sheet */}
      <MenuSheet
        open={showMenuSheet}
        onOpenChange={setShowMenuSheet}
        hasPermission={hasPermission}
        isAdmin={isAdmin}
        isSuperAdmin={isSuperAdmin}
        isExporting={isExporting}
        onExportEnderecamentos={handleExportEnderecamentos}
        onExportInventario={handleExportInventario}
      />

      {/* QR Scanner Modal */}
      {showScanner && (
        <QRScanner onScan={handleQRScan} onClose={() => setShowScanner(false)} />
      )}
    </div>
  );
};

export default Home;
