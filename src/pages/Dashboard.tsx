import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, RefreshCw, MapPin, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { listEnderecos, listInventario } from '@/hooks/useDataOperations';
import { formatEndereco } from '@/utils/formatEndereco';
import logoImex from '@/assets/logo-imex.png';

interface EnderecoMaterial {
  id: string;
  codigo: string;
  descricao: string;
  tipo_material: string;
  peso: number;
  rua: number;
  coluna: number;
  nivel: number;
  posicao: number;
  created_by: string;
  created_at: string;
  fabricantes?: { nome: string } | null;
}

interface InventarioItem {
  id: string;
  quantidade: number;
  contado_por: string;
  created_at: string;
  updated_at: string;
  enderecos_materiais: {
    codigo: string;
    descricao: string;
    rua: number;
    coluna: number;
    nivel: number;
    posicao: number;
  };
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.tipo === 'admin';
  
  const [enderecos, setEnderecos] = useState<EnderecoMaterial[]>([]);
  const [inventario, setInventario] = useState<InventarioItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Carregar dados iniciais
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [enderecosRes, inventarioRes] = await Promise.all([
        listEnderecos(undefined, 50),
        listInventario(undefined, 50),
      ]);

      if (enderecosRes.success && enderecosRes.data) {
        setEnderecos(enderecosRes.data);
      }
      if (inventarioRes.success && inventarioRes.data) {
        setInventario(inventarioRes.data as InventarioItem[]);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar dados. Verifique sua sessão.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Exportar para Excel/CSV
  const exportToCSV = (type: 'enderecos' | 'inventario') => {
    let csvContent = '';
    let filename = '';

    if (type === 'enderecos') {
      csvContent = 'Código;Descrição;Tipo;Fabricante;Peso (kg);Endereço;Cadastrado por;Data\n';
      enderecos.forEach(e => {
        const enderecoFormatado = formatEndereco(e.rua, e.coluna, e.nivel, e.posicao);
        csvContent += `${e.codigo};${e.descricao};${e.tipo_material};${e.fabricantes?.nome || ''};${e.peso};${enderecoFormatado};${e.created_by};${new Date(e.created_at).toLocaleString('pt-BR')}\n`;
      });
      filename = `enderecamentos_${new Date().toISOString().split('T')[0]}.csv`;
    } else {
      csvContent = 'Código;Descrição;Endereço;Quantidade;Contado por;Data Contagem\n';
      inventario.forEach(i => {
        const enderecoFormatado = formatEndereco(
          i.enderecos_materiais.rua,
          i.enderecos_materiais.coluna,
          i.enderecos_materiais.nivel,
          i.enderecos_materiais.posicao
        );
        csvContent += `${i.enderecos_materiais.codigo};${i.enderecos_materiais.descricao};${enderecoFormatado};${i.quantidade};${i.contado_por};${new Date(i.updated_at).toLocaleString('pt-BR')}\n`;
      });
      filename = `inventario_${new Date().toISOString().split('T')[0]}.csv`;
    }

    // BOM para Excel reconhecer UTF-8
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Exportado!',
      description: `Arquivo ${filename} baixado com sucesso`,
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-border bg-card p-4">
        <button onClick={() => navigate('/')} className="rounded-lg p-2 hover:bg-accent">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <img src={logoImex} alt="IMEX Solutions" className="h-8" />
        <h1 className="flex-1 text-lg font-bold">Dashboard</h1>
        <Button variant="ghost" size="icon" onClick={loadData} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="enderecos" className="flex-1">
        <TabsList className="mx-4 mt-4 grid w-auto grid-cols-2">
          <TabsTrigger value="enderecos" className="gap-2">
            <MapPin className="h-4 w-4" />
            Endereçamentos
          </TabsTrigger>
          <TabsTrigger value="inventario" className="gap-2">
            <Package className="h-4 w-4" />
            Inventário
          </TabsTrigger>
        </TabsList>

        {/* Endereçamentos */}
        <TabsContent value="enderecos" className="flex-1 p-4">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{enderecos.length} registros</p>
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => exportToCSV('enderecos')}>
                <Download className="mr-2 h-4 w-4" />
                Exportar Excel
              </Button>
            )}
          </div>
          
          <div className="space-y-3">
            {enderecos.map((e) => (
              <div 
                key={e.id} 
                className="rounded-xl border border-border bg-card p-4 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-primary">{e.codigo}</p>
                      <Badge variant="secondary" className="text-xs">{e.tipo_material}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-1">{e.descricao}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {e.fabricantes?.nome} • {e.peso}kg • Por: {e.created_by}
                    </p>
                  </div>
                    <div className="text-right">
                    <div className="flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1">
                      <MapPin className="h-3 w-3 text-primary" />
                      <span className="text-xs font-medium">
                        {formatEndereco(e.rua, e.coluna, e.nivel, e.posicao)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDate(e.created_at)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Inventário */}
        <TabsContent value="inventario" className="flex-1 p-4">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{inventario.length} registros</p>
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => exportToCSV('inventario')}>
                <Download className="mr-2 h-4 w-4" />
                Exportar Excel
              </Button>
            )}
          </div>
          
          <div className="space-y-3">
            {inventario.map((i) => (
              <div 
                key={i.id} 
                className="rounded-xl border border-border bg-card p-4 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-bold text-primary">{i.enderecos_materiais.codigo}</p>
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
                      {i.enderecos_materiais.descricao}
                    </p>
                    <div className="mt-1 flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {formatEndereco(i.enderecos_materiais.rua, i.enderecos_materiais.coluna, i.enderecos_materiais.nivel, i.enderecos_materiais.posicao)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="rounded-lg bg-green-500/10 px-3 py-1">
                      <span className="text-xl font-bold text-green-600">{i.quantidade}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Por: {i.contado_por}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(i.updated_at)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Dashboard;