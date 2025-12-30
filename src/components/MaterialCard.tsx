import { Package, MapPin, Hash, Calendar, ChevronRight } from 'lucide-react';
import type { Material } from '@/types/material';
import { CATEGORIAS, STATUS } from '@/types/material';
import { cn } from '@/lib/utils';

interface MaterialCardProps {
  material: Material;
  onClick?: () => void;
}

const statusColors: Record<Material['status'], string> = {
  disponivel: 'bg-mrx-success/15 text-mrx-success border-mrx-success/30',
  reservado: 'bg-mrx-warning/15 text-mrx-warning border-mrx-warning/30',
  em_uso: 'bg-mrx-info/15 text-mrx-info border-mrx-info/30',
  manutencao: 'bg-destructive/15 text-destructive border-destructive/30',
};

const categoryIcons: Record<Material['categoria'], string> = {
  valvula: '🔧',
  atuador: '⚙️',
  acessorio: '🔩',
  instrumento: '📏',
  outro: '📦',
};

export function MaterialCard({ material, onClick }: MaterialCardProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
    });
  };

  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-all duration-200 hover:border-primary/30 hover:shadow-md active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{categoryIcons[material.categoria]}</span>
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
                statusColors[material.status]
              )}
            >
              {STATUS[material.status]}
            </span>
          </div>
          
          <h3 className="font-display font-semibold text-foreground truncate mb-1">
            {material.descricao}
          </h3>
          
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Hash className="h-3.5 w-3.5" />
              <span>{material.codigo}</span>
            </div>
            <div className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              <span>{material.localizacao}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="text-right">
            <p className="text-xl font-bold text-primary">{material.quantidade}</p>
            <p className="text-xs text-muted-foreground">{material.unidade}</p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>Entrada: {formatDate(material.dataEntrada)}</span>
        </div>
        <span className="text-xs font-medium text-primary">
          {CATEGORIAS[material.categoria]}
        </span>
      </div>
    </button>
  );
}
