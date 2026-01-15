import React from 'react';
import { Package, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChartDataPoint {
  month: string;
  enderecados: number;
  inventario: number;
}

interface PanelCardProps {
  title: string;
  onClick: () => void;
  variant: 'dashboard' | 'estoque';
  stats?: {
    total?: number;
    divergencias?: number;
  };
  chartData?: ChartDataPoint[];
  isLoading?: boolean;
}

export const PanelCard: React.FC<PanelCardProps> = ({
  title,
  onClick,
  variant,
  stats,
  chartData,
  isLoading,
}) => {
  if (variant === 'dashboard') {
    // Calculate max value for chart scaling
    const maxValue = chartData && chartData.length > 0
      ? Math.max(...chartData.flatMap(d => [d.enderecados, d.inventario]), 1)
      : 1;
    
    // Calculate totals for trend
    const totalEnderecados = chartData?.reduce((sum, d) => sum + d.enderecados, 0) || 0;
    const totalInventario = chartData?.reduce((sum, d) => sum + d.inventario, 0) || 0;
    const hasData = totalEnderecados > 0 || totalInventario > 0;

    return (
      <button
        onClick={onClick}
        className="flex flex-col rounded-2xl border border-border bg-card p-4 transition-all hover:shadow-md hover:border-primary/30"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {hasData && (
            <div className="flex items-center gap-1 text-xs text-primary">
              <TrendingUp className="h-3 w-3" />
              <span>{totalEnderecados + totalInventario}</span>
            </div>
          )}
        </div>
        
        {/* Chart */}
        {isLoading ? (
          <div className="flex items-end justify-center gap-1 h-16 mt-auto">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="flex-1 rounded-t bg-muted animate-pulse"
                style={{ height: `${30 + Math.random() * 40}%` }}
              />
            ))}
          </div>
        ) : chartData && chartData.length > 0 ? (
          <div className="flex items-end gap-1 h-16 mt-auto">
            {chartData.map((data, i) => {
              const enderecadosHeight = maxValue > 0 ? (data.enderecados / maxValue) * 100 : 0;
              const inventarioHeight = maxValue > 0 ? (data.inventario / maxValue) * 100 : 0;
              
              return (
                <div key={i} className="flex-1 flex gap-0.5" title={`${data.month}: ${data.enderecados} end. / ${data.inventario} inv.`}>
                  <div
                    className="flex-1 rounded-t bg-primary/60 transition-all duration-500"
                    style={{ height: `${Math.max(enderecadosHeight, 5)}%` }}
                  />
                  <div
                    className="flex-1 rounded-t bg-secondary/60 transition-all duration-500"
                    style={{ height: `${Math.max(inventarioHeight, 5)}%` }}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center h-16 mt-auto text-xs text-muted-foreground">
            Sem dados nos últimos 6 meses
          </div>
        )}
        
        {/* Month labels */}
        {chartData && chartData.length > 0 && (
          <div className="flex gap-1 mt-1">
            {chartData.map((data, i) => (
              <div key={i} className="flex-1 text-center text-[10px] text-muted-foreground">
                {data.month}
              </div>
            ))}
          </div>
        )}
        
        {/* Legend */}
        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-primary/60" />
            <span>Endereçados ({totalEnderecados})</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-secondary/60" />
            <span>Inventário ({totalInventario})</span>
          </div>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="flex flex-col rounded-2xl border border-border bg-card p-4 transition-all hover:shadow-md hover:border-primary/30"
    >
      <span className="text-sm font-semibold text-foreground mb-2">{title}</span>
      <div className="flex items-center justify-between">
        <div>
          {isLoading ? (
            <div className="h-8 w-16 bg-muted animate-pulse rounded" />
          ) : (
            <p className="text-2xl font-bold text-primary">
              {stats?.total?.toLocaleString('pt-BR') || '0'}
            </p>
          )}
          <p className="text-xs text-muted-foreground">itens cadastrados</p>
        </div>
        <Package className="h-12 w-12 text-primary/20" />
      </div>
      {stats?.divergencias !== undefined && stats.divergencias > 0 && (
        <div className="mt-3 flex items-center gap-1 text-xs text-amber-600">
          <AlertTriangle className="h-3 w-3" />
          <span>{stats.divergencias} divergências abertas</span>
        </div>
      )}
      <Button
        variant="default"
        size="sm"
        className="mt-3 w-full"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        Ver Estoque Completo
      </Button>
    </button>
  );
};
