import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, ClipboardList, Settings, Download, Loader2, LogOut, Activity, BookOpen, Shield, Database, QrCode, Package, FileBarChart, Wrench, SlidersHorizontal, Warehouse, FilePlus, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { exportEnderecos, exportInventario } from '@/hooks/useDataOperations';
import { exportEnderecamentosToCSV, exportInventarioToCSV } from '@/utils/exportEnderecamentos';
import logoImex from '@/assets/logo-imex.png';

const Home = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, logout } = useAuth();
  const isAdmin = user?.tipo === 'admin';
  const isComercialOrAdmin = user?.tipo === 'admin' || user?.tipo === 'comercial';

  const [isExporting, setIsExporting] = useState<'enderecamentos' | 'inventario' | null>(null);

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
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-card p-4">
        <img src={logoImex} alt="IMEX Solutions" className="h-10" />
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/fabricantes')}
              title="Gerenciar Fabricantes"
            >
              <Settings className="h-5 w-5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">
            Olá, {user?.nome?.split(' ')[0] || 'Usuário'}!
          </h1>
          <p className="text-muted-foreground">Selecione a operação</p>
        </div>

        <div className="flex w-full max-w-md flex-col gap-4">
          {/* Endereçamento Button */}
          <button
            onClick={() => navigate('/enderecamento')}
            className="flex flex-col items-center gap-4 rounded-2xl border-2 border-primary bg-primary/5 p-8 transition-all hover:bg-primary/10 hover:shadow-lg active:scale-[0.98]"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary shadow-md">
              <MapPin className="h-10 w-10 text-primary-foreground" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-foreground">Endereçamento</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Cadastrar localização de materiais
              </p>
            </div>
          </button>

          {/* Inventário Button */}
          <button
            onClick={() => navigate('/inventario')}
            className="flex flex-col items-center gap-4 rounded-2xl border-2 border-secondary bg-secondary/5 p-8 transition-all hover:bg-secondary/10 hover:shadow-lg active:scale-[0.98]"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary shadow-md">
              <ClipboardList className="h-10 w-10 text-secondary-foreground" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-foreground">Inventário</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Realizar contagem de materiais
              </p>
            </div>
          </button>

          {/* Dashboard Button */}
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-4 rounded-2xl border-2 border-accent bg-accent/5 p-4 transition-all hover:bg-accent/10 hover:shadow-lg active:scale-[0.98]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent shadow-md">
              <Activity className="h-6 w-6 text-accent-foreground" />
            </div>
            <div className="text-left">
              <h2 className="text-lg font-bold text-foreground">Dashboard Tempo Real</h2>
              <p className="text-sm text-muted-foreground">
                Ver lançamentos e exportar Excel
              </p>
            </div>
          </button>

          {/* Estoque Atual Button */}
          <button
            onClick={() => navigate('/estoque-atual')}
            className={`flex items-center gap-4 rounded-2xl border-2 p-4 transition-all active:scale-[0.98] ${
              isAdmin 
                ? 'border-emerald-500/50 bg-emerald-500/5 hover:bg-emerald-500/10 hover:shadow-lg cursor-pointer' 
                : 'border-muted/50 bg-muted/5 cursor-pointer'
            }`}
          >
            <div className={`flex h-12 w-12 items-center justify-center rounded-full shadow-md ${
              isAdmin ? 'bg-emerald-500' : 'bg-muted/50'
            }`}>
              <Package className={`h-6 w-6 ${isAdmin ? 'text-white' : 'text-muted-foreground/50'}`} />
            </div>
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-foreground">Estoque Atual</h2>
                {!isAdmin && (
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-600">
                    Em desenvolvimento
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {isAdmin ? 'Ver saldo atual por item e endereço' : 'Em breve disponível para todos'}
              </p>
            </div>
          </button>

          {/* Consulta por Rua - Disponível para todos */}
          <button
            onClick={() => navigate('/estoque-rua')}
            className="flex items-center gap-4 rounded-2xl border-2 border-blue-500/50 bg-blue-500/5 p-4 transition-all hover:bg-blue-500/10 hover:shadow-lg active:scale-[0.98] cursor-pointer"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500 shadow-md">
              <Warehouse className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 text-left">
              <h2 className="text-lg font-bold text-foreground">Consulta por Rua</h2>
              <p className="text-sm text-muted-foreground">
                Ler QR Code e ver materiais da rua
              </p>
            </div>
          </button>

          {/* Etiquetas Button - Disponível para todos */}
          <button
            onClick={() => navigate('/etiquetas')}
            className="flex items-center gap-4 rounded-2xl border-2 border-muted bg-muted/5 p-4 transition-all hover:bg-muted/10 hover:shadow-lg active:scale-[0.98] cursor-pointer"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted shadow-md">
              <QrCode className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="flex-1 text-left">
              <h2 className="text-lg font-bold text-foreground">Gerar Etiquetas</h2>
              <p className="text-sm text-muted-foreground">
                Imprimir etiquetas com QR Code
              </p>
            </div>
          </button>

          {/* Solicitação de Código - Comercial e Admin */}
          {isComercialOrAdmin && (
            <button
              onClick={() => navigate('/solicitacoes-codigo')}
              className="flex items-center gap-4 rounded-2xl border-2 border-purple-500/50 bg-purple-500/5 p-4 transition-all hover:bg-purple-500/10 hover:shadow-lg active:scale-[0.98] cursor-pointer"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500 shadow-md">
                <FilePlus className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1 text-left">
                <h2 className="text-lg font-bold text-foreground">Solicitar Código</h2>
                <p className="text-sm text-muted-foreground">
                  Solicitar código para novo material
                </p>
              </div>
            </button>
          )}
        </div>

        {/* Admin Actions */}
        {isAdmin && (
          <div className="mt-4 w-full max-w-md space-y-3">
            <p className="text-center text-sm font-medium text-muted-foreground">
              Ações Administrativas
            </p>
            
            {/* Painel Admin */}
            <Button
              variant="default"
              className="w-full"
              onClick={() => navigate('/admin')}
            >
              <Shield className="mr-2 h-4 w-4" />
              Painel Administrativo
            </Button>

            {/* Aprovação de Códigos */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate('/aprovacao-codigos')}
            >
              <CheckSquare className="mr-2 h-4 w-4" />
              Aprovação de Códigos
            </Button>

            {/* Controle de Inventário */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate('/controle-inventario')}
            >
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Controle de Inventário
            </Button>

            {/* Relatório de Inventário */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate('/relatorio-inventario')}
            >
              <FileBarChart className="mr-2 h-4 w-4" />
              Relatório de Divergências
            </Button>

            {/* Ajuste de Inventário */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate('/ajuste-inventario')}
            >
              <Wrench className="mr-2 h-4 w-4" />
              Ajustes de Inventário
            </Button>

            {/* Cadastro de Produto */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate('/catalogo-produto')}
            >
              <BookOpen className="mr-2 h-4 w-4" />
              Cadastro de Produto
            </Button>
            
            {/* Catálogo de Produtos (Importar) */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate('/catalogo')}
            >
              <BookOpen className="mr-2 h-4 w-4" />
              Importar Catálogo de Produtos
            </Button>

            {/* Gerenciamento de Dados */}
            <Button
              variant="outline"
              className="w-full border-destructive text-destructive hover:bg-destructive/10"
              onClick={() => navigate('/gerenciamento-dados')}
            >
              <Database className="mr-2 h-4 w-4" />
              Gerenciamento de Dados
            </Button>

            <div className="flex flex-col gap-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleExportEnderecamentos}
                disabled={isExporting !== null}
              >
                {isExporting === 'enderecamentos' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Exportar Endereçamentos
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleExportInventario}
                disabled={isExporting !== null}
              >
                {isExporting === 'inventario' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Exportar Inventário
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
