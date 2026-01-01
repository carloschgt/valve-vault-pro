import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, ClipboardList, Settings, Download, Loader2, LogOut, Activity, BookOpen, Shield, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { exportEnderecamentosToCSV, exportInventarioToCSV } from '@/utils/exportEnderecamentos';
import logoImex from '@/assets/logo-imex.png';

const Home = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, logout } = useAuth();
  const isAdmin = user?.tipo === 'admin';

  const [isExporting, setIsExporting] = useState<'enderecamentos' | 'inventario' | null>(null);

  const handleExportEnderecamentos = async () => {
    setIsExporting('enderecamentos');
    try {
      const { data, error } = await supabase
        .from('enderecos_materiais')
        .select(`
          id,
          codigo,
          descricao,
          tipo_material,
          peso,
          rua,
          coluna,
          nivel,
          posicao,
          created_by,
          created_at,
          fabricantes (nome)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted = (data || []).map((d: any) => ({
        ...d,
        fabricante_nome: d.fabricantes?.nome || 'N/A',
      }));

      exportEnderecamentosToCSV(formatted);
      toast({ title: 'Sucesso', description: 'Endereçamentos exportados!' });
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
      const { data, error } = await supabase
        .from('inventario')
        .select(`
          id,
          quantidade,
          contado_por,
          created_at,
          enderecos_materiais (
            codigo,
            descricao,
            peso,
            rua,
            coluna,
            nivel,
            posicao,
            fabricantes (nome)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted = (data || []).map((d: any) => ({
        id: d.id,
        codigo: d.enderecos_materiais?.codigo || '',
        descricao: d.enderecos_materiais?.descricao || '',
        fabricante_nome: d.enderecos_materiais?.fabricantes?.nome || 'N/A',
        peso: d.enderecos_materiais?.peso || 0,
        rua: d.enderecos_materiais?.rua || 0,
        coluna: d.enderecos_materiais?.coluna || 0,
        nivel: d.enderecos_materiais?.nivel || 0,
        posicao: d.enderecos_materiais?.posicao || 0,
        quantidade: d.quantidade,
        contado_por: d.contado_por,
        data_contagem: d.created_at,
      }));

      exportInventarioToCSV(formatted);
      toast({ title: 'Sucesso', description: 'Inventário exportado!' });
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
            
            {/* Catálogo de Produtos */}
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

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
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
                className="flex-1"
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
