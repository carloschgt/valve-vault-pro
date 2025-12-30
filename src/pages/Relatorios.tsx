import { Download, Package, ArrowRightLeft, BarChart3, PieChart } from 'lucide-react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Button } from '@/components/ui/button';
import { useMateriais } from '@/hooks/useMateriais';
import { exportMateriaisToCSV, exportMovimentacoesToCSV } from '@/utils/exportToExcel';
import { CATEGORIAS, STATUS, TIPOS_MOVIMENTACAO } from '@/types/material';
import { toast } from 'sonner';

const Relatorios = () => {
  const { materiais, movimentacoes, isLoading } = useMateriais();

  const stats = {
    totalMateriais: materiais.length,
    totalQuantidade: materiais.reduce((acc, m) => acc + m.quantidade, 0),
    totalMovimentacoes: movimentacoes.length,
    categorias: Object.entries(CATEGORIAS).map(([key, label]) => ({
      key,
      label,
      count: materiais.filter((m) => m.categoria === key).length,
    })),
    status: Object.entries(STATUS).map(([key, label]) => ({
      key,
      label,
      count: materiais.filter((m) => m.status === key).length,
    })),
    movimentacoesTipo: Object.entries(TIPOS_MOVIMENTACAO).map(([key, label]) => ({
      key,
      label,
      count: movimentacoes.filter((m) => m.tipo === key).length,
    })),
  };

  const handleExportMateriais = () => {
    if (materiais.length === 0) {
      toast.error('Não há materiais para exportar');
      return;
    }
    exportMateriaisToCSV(materiais);
    toast.success('Materiais exportados com sucesso!');
  };

  const handleExportMovimentacoes = () => {
    if (movimentacoes.length === 0) {
      toast.error('Não há movimentações para exportar');
      return;
    }
    exportMovimentacoesToCSV(movimentacoes, materiais);
    toast.success('Movimentações exportadas com sucesso!');
  };

  if (isLoading) {
    return (
      <MobileLayout title="Relatórios">
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout title="Relatórios">
      <div className="animate-fade-in space-y-6 p-4">
        {/* Export Buttons */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Exportar Dados
          </h3>
          <div className="space-y-3">
            <Button
              variant="hero"
              className="w-full justify-start"
              onClick={handleExportMateriais}
            >
              <Package className="h-4 w-4" />
              Exportar Materiais (CSV/Excel)
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleExportMovimentacoes}
            >
              <ArrowRightLeft className="h-4 w-4" />
              Exportar Movimentações (CSV/Excel)
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Os arquivos CSV podem ser abertos diretamente no Excel
          </p>
        </div>

        {/* Overview Stats */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Visão Geral
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-gradient-primary p-3 text-center">
              <p className="text-2xl font-bold text-primary-foreground">{stats.totalMateriais}</p>
              <p className="text-xs text-primary-foreground/80">Itens</p>
            </div>
            <div className="rounded-lg bg-accent p-3 text-center">
              <p className="text-2xl font-bold text-accent-foreground">{stats.totalQuantidade}</p>
              <p className="text-xs text-muted-foreground">Quantidade</p>
            </div>
            <div className="rounded-lg bg-muted p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{stats.totalMovimentacoes}</p>
              <p className="text-xs text-muted-foreground">Movimentações</p>
            </div>
          </div>
        </div>

        {/* Status Distribution */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
            <PieChart className="h-5 w-5 text-primary" />
            Por Status
          </h3>
          <div className="space-y-3">
            {stats.status.map((item) => (
              <div key={item.key} className="flex items-center justify-between">
                <span className="text-sm text-foreground">{item.label}</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{
                        width: `${stats.totalMateriais > 0 ? (item.count / stats.totalMateriais) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="w-8 text-right text-sm font-medium text-primary">
                    {item.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Category Distribution */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h3 className="font-display font-semibold text-foreground mb-4">
            Por Categoria
          </h3>
          <div className="space-y-3">
            {stats.categorias.map((item) => (
              <div key={item.key} className="flex items-center justify-between">
                <span className="text-sm text-foreground">{item.label}</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-mrx-teal transition-all"
                      style={{
                        width: `${stats.totalMateriais > 0 ? (item.count / stats.totalMateriais) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="w-8 text-right text-sm font-medium text-mrx-teal">
                    {item.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Movimentações by Type */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h3 className="font-display font-semibold text-foreground mb-4">
            Movimentações por Tipo
          </h3>
          <div className="space-y-3">
            {stats.movimentacoesTipo.map((item) => (
              <div key={item.key} className="flex items-center justify-between">
                <span className="text-sm text-foreground">{item.label}</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-secondary transition-all"
                      style={{
                        width: `${stats.totalMovimentacoes > 0 ? (item.count / stats.totalMovimentacoes) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="w-8 text-right text-sm font-medium text-secondary">
                    {item.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MobileLayout>
  );
};

export default Relatorios;
