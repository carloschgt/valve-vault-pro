import React from 'react';
import { LucideIcon, TrendingUp, Package, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface PanelCardProps {
  title: string;
  onClick: () => void;
  variant: 'dashboard' | 'estoque';
  stats?: {
    total?: number;
    divergencias?: number;
  };
}

export const PanelCard: React.FC<PanelCardProps> = ({
  title,
  onClick,
  variant,
  stats,
}) => {
  if (variant === 'dashboard') {
    return (
      <button
        onClick={onClick}
        className="flex flex-col rounded-2xl border border-border bg-card p-4 transition-all hover:shadow-md hover:border-primary/30"
      >
        <span className="text-sm font-semibold text-foreground mb-3">{title}</span>
        {/* Mini Chart Placeholder */}
        <div className="flex items-end gap-1 h-16 mt-auto">
          {[40, 60, 45, 70, 55, 80, 65].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t bg-primary/20"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <span>Endereçados</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-secondary" />
            <span>Inventário</span>
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
          <p className="text-2xl font-bold text-primary">
            {stats?.total?.toLocaleString('pt-BR') || '0'}
          </p>
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
