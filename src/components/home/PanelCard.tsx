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
        className="flex flex-col rounded-2xl border border-border bg-card p-3 sm:p-4 transition-all hover:shadow-md hover:border-primary/30 min-w-0 overflow-hidden"
      >
        <div className="flex items-center justify-between mb-2 sm:mb-3 gap-2">
          <span className="text-xs sm:text-sm font-semibold text-foreground truncate">{title}</span>
          {hasData && (
            <div className="flex items-center gap-1 text-xs text-primary flex-shrink-0">
              <TrendingUp className="h-3 w-3" />
              <span>{totalEnderecados + totalInventario}</span>
            </div>
          )}
        </div>
        
        {/* Chart */}
        {isLoading ? (
          <div className="flex items-end justify-center gap-0.5 h-12 sm:h-16 mt-auto">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="flex-1 rounded-t bg-muted animate-pulse"
                style={{ height: `${30 + Math.random() * 40}%` }}
              />
            ))}
          </div>
        ) : chartData && chartData.length > 0 ? (
          <div className="flex items-end gap-0.5 h-12 sm:h-16 mt-auto">
            {chartData.map((data, i) => {
              const maxHeight = 48; // Fixed max height in pixels
              const enderecadosHeight = maxValue > 0 ? (data.enderecados / maxValue) * maxHeight : 2;
              const inventarioHeight = maxValue > 0 ? (data.inventario / maxValue) * maxHeight : 2;
              
              return (
                <div key={i} className="flex-1 flex items-end gap-px h-full min-w-0" title={`${data.month}: ${data.enderecados} end. / ${data.inventario} inv.`}>
                  <div
                    className="flex-1 rounded-t bg-primary transition-all duration-500 min-w-[2px]"
                    style={{ height: `${Math.max(enderecadosHeight, 2)}px` }}
                  />
                  <div
                    className="flex-1 rounded-t bg-secondary transition-all duration-500 min-w-[2px]"
                    style={{ height: `${Math.max(inventarioHeight, 2)}px` }}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center h-12 sm:h-16 mt-auto text-[10px] sm:text-xs text-muted-foreground">
            Sem dados
          </div>
        )}
        
        {/* Month labels */}
        {chartData && chartData.length > 0 && (
          <div className="flex gap-0.5 mt-1">
            {chartData.map((data, i) => (
              <div key={i} className="flex-1 text-center text-[8px] sm:text-[10px] text-muted-foreground truncate">
                {data.month}
              </div>
            ))}
          </div>
        )}
        
        {/* Legend */}
        <div className="flex items-center gap-2 sm:gap-4 mt-1 sm:mt-2 text-[10px] sm:text-xs text-muted-foreground flex-wrap">
          <div className="flex items-center gap-1">
            <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-primary flex-shrink-0" />
            <span className="truncate">End. ({totalEnderecados})</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-secondary flex-shrink-0" />
            <span className="truncate">Inv. ({totalInventario})</span>
          </div>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="flex flex-col rounded-2xl border border-border bg-card p-3 sm:p-4 transition-all hover:shadow-md hover:border-primary/30 min-w-0 overflow-hidden"
    >
      <span className="text-xs sm:text-sm font-semibold text-foreground mb-2 truncate">{title}</span>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          {isLoading ? (
            <div className="h-7 sm:h-8 w-14 sm:w-16 bg-muted animate-pulse rounded" />
          ) : (
            <p className="text-xl sm:text-2xl font-bold text-primary">
              {stats?.total?.toLocaleString('pt-BR') || '0'}
            </p>
          )}
          <p className="text-[10px] sm:text-xs text-muted-foreground">itens cadastrados</p>
        </div>
        <Package className="h-10 w-10 sm:h-12 sm:w-12 text-primary/20 flex-shrink-0" />
      </div>
      {stats?.divergencias !== undefined && stats.divergencias > 0 && (
        <div className="mt-2 sm:mt-3 flex items-center gap-1 text-[10px] sm:text-xs text-amber-600">
          <AlertTriangle className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{stats.divergencias} divergências</span>
        </div>
      )}
      <Button
        variant="default"
        size="sm"
        className="mt-2 sm:mt-3 w-full text-xs sm:text-sm"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        Ver Estoque
      </Button>
    </button>
  );
};
