import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Loader2, Download, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { exportInventario } from '@/hooks/useDataOperations';
import { Skeleton } from '@/components/ui/skeleton';
import { formatEndereco } from '@/utils/formatEndereco';
import logoImex from '@/assets/logo-imex.png';
import * as XLSX from 'xlsx';
import { matchesAnyWildcard } from '@/lib/wildcardSearch';

interface InventarioReportItem {
  endereco_material_id: string;
  codigo: string;
  descricao: string;
  endereco_formatado: string;
  rua: number;
  coluna: number;
  nivel: number;
  posicao: number;
  qtd_c1: number | null;
  qtd_c2: number | null;
  qtd_c3: number | null;
  contado_por_c1: string | null;
  contado_por_c2: string | null;
  contado_por_c3: string | null;
  divergencia_abs: number;
  divergencia_pct: number;
  status: 'OK' | 'DIVERGENTE' | 'AGUARDANDO';
}

const RelatorioInventario = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'DIVERGENTE' | 'OK' | 'AGUARDANDO'>('all');
  const [reportData, setReportData] = useState<InventarioReportItem[]>([]);

  const isAdmin = user?.tipo === 'admin';

  useEffect(() => {
    if (!authLoading && user) {
      setPermissionsLoaded(true);
      if (user.tipo === 'admin') {
        loadReport();
      }
    }
  }, [authLoading, user]);

  const loadReport = async () => {
    setIsLoading(true);
    try {
      // Fetch all inventory grouped by material/address via edge function
      const result = await exportInventario();
      
      if (!result.success) {
        throw new Error(result.error);
      }

      const inventarioData = result.data || [];

      // Group by endereco_material_id
      const grouped: Record<string, {
        endereco_material_id: string;
        codigo: string;
        descricao: string;
        rua: number;
        coluna: number;
        nivel: number;
        posicao: number;
        counts: { [key: number]: { quantidade: number; contado_por: string } };
      }> = {};

      for (const inv of inventarioData || []) {
        const mat = inv.enderecos_materiais as any;
        if (!mat) continue;

        const key = inv.endereco_material_id;
        if (!grouped[key]) {
          grouped[key] = {
            endereco_material_id: key,
            codigo: mat.codigo,
            descricao: mat.descricao,
            rua: mat.rua,
            coluna: mat.coluna,
            nivel: mat.nivel,
            posicao: mat.posicao,
            counts: {},
          };
        }

        grouped[key].counts[inv.contagem_num] = {
          quantidade: inv.quantidade,
          contado_por: inv.contado_por,
        };
      }

      // Calculate divergence and status
      const report: InventarioReportItem[] = Object.values(grouped).map((item) => {
        const qtd_c1 = item.counts[1]?.quantidade ?? null;
        const qtd_c2 = item.counts[2]?.quantidade ?? null;
        const qtd_c3 = item.counts[3]?.quantidade ?? null;

        let divergencia_abs = 0;
        let divergencia_pct = 0;
        let status: 'OK' | 'DIVERGENTE' | 'AGUARDANDO' = 'AGUARDANDO';

        if (qtd_c1 !== null && qtd_c2 !== null) {
          divergencia_abs = Math.abs(qtd_c1 - qtd_c2);
          const avg = (qtd_c1 + qtd_c2) / 2;
          divergencia_pct = avg > 0 ? (divergencia_abs / avg) * 100 : 0;

          if (qtd_c1 === qtd_c2) {
            status = 'OK';
          } else if (qtd_c3 !== null) {
            status = qtd_c3 === qtd_c1 || qtd_c3 === qtd_c2 ? 'OK' : 'DIVERGENTE';
          } else {
            status = 'DIVERGENTE';
          }
        } else if (qtd_c1 !== null || qtd_c2 !== null) {
          status = 'AGUARDANDO';
        }

        return {
          endereco_material_id: item.endereco_material_id,
          codigo: item.codigo,
          descricao: item.descricao,
          endereco_formatado: formatEndereco(item.rua, item.coluna, item.nivel, item.posicao),
          rua: item.rua,
          coluna: item.coluna,
          nivel: item.nivel,
          posicao: item.posicao,
          qtd_c1,
          qtd_c2,
          qtd_c3,
          contado_por_c1: item.counts[1]?.contado_por ?? null,
          contado_por_c2: item.counts[2]?.contado_por ?? null,
          contado_por_c3: item.counts[3]?.contado_por ?? null,
          divergencia_abs,
          divergencia_pct,
          status,
        };
      });

      // Sort by code
      report.sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true }));

      setReportData(report);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao carregar relatório',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredData = reportData.filter((item) => {
    const matchesSearch = matchesAnyWildcard(
      [item.codigo, item.descricao, item.endereco_formatado],
      searchTerm
    );

    const matchesStatus = filterStatus === 'all' || item.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: reportData.length,
    ok: reportData.filter((i) => i.status === 'OK').length,
    divergente: reportData.filter((i) => i.status === 'DIVERGENTE').length,
    aguardando: reportData.filter((i) => i.status === 'AGUARDANDO').length,
  };

  const handleExport = () => {
    const exportData = filteredData.map((item) => ({
      'Código': item.codigo,
      'Descrição': item.descricao,
      'Endereço': item.endereco_formatado,
      'Qtd C1': item.qtd_c1 ?? '',
      'Contado por C1': item.contado_por_c1 ?? '',
      'Qtd C2': item.qtd_c2 ?? '',
      'Contado por C2': item.contado_por_c2 ?? '',
      'Qtd C3': item.qtd_c3 ?? '',
      'Contado por C3': item.contado_por_c3 ?? '',
      'Divergência': item.divergencia_abs,
      'Divergência %': item.divergencia_pct.toFixed(1) + '%',
      'Status': item.status,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Relatório Inventário');
    XLSX.writeFile(wb, `relatorio_inventario_${new Date().toISOString().split('T')[0]}.xlsx`);

    toast({ title: 'Sucesso', description: 'Relatório exportado!' });
  };

  if (!permissionsLoaded || authLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <div className="flex items-center gap-4 border-b border-border bg-card p-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="flex-1 p-4 space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <p className="text-lg text-muted-foreground">Acesso restrito a administradores</p>
        <Button onClick={() => navigate('/')} className="mt-4">Voltar</Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-border bg-card p-4">
        <button
          onClick={() => navigate('/')}
          className="rounded-lg p-2 hover:bg-accent"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <img src={logoImex} alt="IMEX Solutions" className="h-8" />
        <h1 className="flex-1 text-lg font-bold">Relatório de Inventário</h1>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={isLoading}>
          <Download className="h-4 w-4" />
          <span className="ml-2 hidden sm:inline">Exportar</span>
        </Button>
      </div>

      {/* Stats */}
      <div className="border-b border-border bg-card p-4">
        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={() => setFilterStatus('all')}
            className={`rounded-lg p-3 text-center transition-colors ${
              filterStatus === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-accent'
            }`}
          >
            <p className="text-xl font-bold">{stats.total}</p>
            <p className="text-xs">Total</p>
          </button>
          <button
            onClick={() => setFilterStatus('OK')}
            className={`rounded-lg p-3 text-center transition-colors ${
              filterStatus === 'OK' ? 'bg-mrx-success text-white' : 'bg-mrx-success/10 hover:bg-mrx-success/20'
            }`}
          >
            <p className="text-xl font-bold">{stats.ok}</p>
            <p className="text-xs">OK</p>
          </button>
          <button
            onClick={() => setFilterStatus('DIVERGENTE')}
            className={`rounded-lg p-3 text-center transition-colors ${
              filterStatus === 'DIVERGENTE' ? 'bg-destructive text-white' : 'bg-destructive/10 hover:bg-destructive/20'
            }`}
          >
            <p className="text-xl font-bold">{stats.divergente}</p>
            <p className="text-xs">Diverg.</p>
          </button>
          <button
            onClick={() => setFilterStatus('AGUARDANDO')}
            className={`rounded-lg p-3 text-center transition-colors ${
              filterStatus === 'AGUARDANDO' ? 'bg-yellow-500 text-white' : 'bg-yellow-500/10 hover:bg-yellow-500/20'
            }`}
          >
            <p className="text-xl font-bold">{stats.aguardando}</p>
            <p className="text-xs">Aguard.</p>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="border-b border-border bg-card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar... (use * como coringa, ex: 002*)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum registro encontrado
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground mb-4">
              {filteredData.length} registro(s) encontrado(s)
            </p>
            {filteredData.map((item) => (
              <div
                key={item.endereco_material_id}
                className="rounded-xl border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-primary truncate">{item.codigo}</p>
                    <p className="text-sm text-muted-foreground truncate">{item.descricao}</p>
                    <p className="text-xs text-muted-foreground mt-1">{item.endereco_formatado}</p>
                  </div>
                  <Badge
                    variant={
                      item.status === 'OK'
                        ? 'default'
                        : item.status === 'DIVERGENTE'
                        ? 'destructive'
                        : 'secondary'
                    }
                    className="shrink-0"
                  >
                    {item.status === 'OK' && <CheckCircle className="mr-1 h-3 w-3" />}
                    {item.status === 'DIVERGENTE' && <AlertTriangle className="mr-1 h-3 w-3" />}
                    {item.status === 'AGUARDANDO' && <Clock className="mr-1 h-3 w-3" />}
                    {item.status}
                  </Badge>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className={`rounded-lg p-2 ${item.qtd_c1 !== null ? 'bg-primary/10' : 'bg-muted/50'}`}>
                    <p className="text-xs text-muted-foreground">C1</p>
                    <p className="text-lg font-bold">{item.qtd_c1 ?? '-'}</p>
                    {item.contado_por_c1 && (
                      <p className="text-xs text-muted-foreground truncate">{item.contado_por_c1}</p>
                    )}
                  </div>
                  <div className={`rounded-lg p-2 ${item.qtd_c2 !== null ? 'bg-primary/10' : 'bg-muted/50'}`}>
                    <p className="text-xs text-muted-foreground">C2</p>
                    <p className="text-lg font-bold">{item.qtd_c2 ?? '-'}</p>
                    {item.contado_por_c2 && (
                      <p className="text-xs text-muted-foreground truncate">{item.contado_por_c2}</p>
                    )}
                  </div>
                  <div className={`rounded-lg p-2 ${item.qtd_c3 !== null ? 'bg-primary/10' : 'bg-muted/50'}`}>
                    <p className="text-xs text-muted-foreground">C3</p>
                    <p className="text-lg font-bold">{item.qtd_c3 ?? '-'}</p>
                    {item.contado_por_c3 && (
                      <p className="text-xs text-muted-foreground truncate">{item.contado_por_c3}</p>
                    )}
                  </div>
                </div>

                {item.status === 'DIVERGENTE' && (
                  <div className="mt-3 rounded-lg bg-destructive/10 p-2 text-center">
                    <p className="text-sm font-medium text-destructive">
                      Divergência: {item.divergencia_abs} unidades ({item.divergencia_pct.toFixed(1)}%)
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RelatorioInventario;
