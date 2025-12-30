import { useState } from 'react';
import { ArrowUpCircle, ArrowDownCircle, ArrowRightLeft, Calendar, User, Download } from 'lucide-react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { MovimentacaoForm } from '@/components/forms/MovimentacaoForm';
import { Button } from '@/components/ui/button';
import { useMateriais } from '@/hooks/useMateriais';
import { exportMovimentacoesToCSV } from '@/utils/exportToExcel';
import { TIPOS_MOVIMENTACAO } from '@/types/material';
import type { TipoMovimentacaoType } from '@/types/material';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const tipoIcons = {
  entrada: ArrowDownCircle,
  saida: ArrowUpCircle,
  transferencia: ArrowRightLeft,
};

const tipoColors = {
  entrada: 'text-mrx-success bg-mrx-success/10',
  saida: 'text-destructive bg-destructive/10',
  transferencia: 'text-mrx-info bg-mrx-info/10',
};

const Movimentacoes = () => {
  const { materiais, movimentacoes, addMovimentacao, isLoading } = useMateriais();
  const [showForm, setShowForm] = useState(false);
  const [filterTipo, setFilterTipo] = useState<TipoMovimentacaoType | 'all'>('all');

  const sortedMovimentacoes = [...movimentacoes]
    .filter((m) => filterTipo === 'all' || m.tipo === filterTipo)
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getMaterial = (id: string) => materiais.find((m) => m.id === id);

  const handleExport = () => {
    if (movimentacoes.length === 0) {
      toast.error('Não há movimentações para exportar');
      return;
    }
    exportMovimentacoesToCSV(movimentacoes, materiais);
    toast.success('Arquivo exportado com sucesso!');
  };

  if (isLoading) {
    return (
      <MobileLayout title="Movimentações">
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout title="Movimentações" showAddButton onAddClick={() => setShowForm(true)}>
      <div className="animate-fade-in space-y-4 p-4">
        {/* Export Button */}
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
        </div>

        {/* Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setFilterTipo('all')}
            className={cn(
              'whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all',
              filterTipo === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            )}
          >
            Todas
          </button>
          {Object.entries(TIPOS_MOVIMENTACAO).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilterTipo(key as TipoMovimentacaoType)}
              className={cn(
                'whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all',
                filterTipo === key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Movimentações List */}
        <div className="space-y-3">
          {sortedMovimentacoes.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
              <ArrowRightLeft className="mb-3 h-12 w-12 text-muted-foreground/50" />
              <p className="font-medium text-muted-foreground">
                {movimentacoes.length === 0
                  ? 'Nenhuma movimentação registrada'
                  : 'Nenhuma movimentação encontrada'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground/70">
                Registre entradas, saídas e transferências
              </p>
            </div>
          ) : (
            sortedMovimentacoes.map((mov) => {
              const material = getMaterial(mov.materialId);
              const Icon = tipoIcons[mov.tipo];

              return (
                <div
                  key={mov.id}
                  className="rounded-xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className={cn('rounded-full p-2', tipoColors[mov.tipo])}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-foreground">
                            {TIPOS_MOVIMENTACAO[mov.tipo]}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {material?.codigo} - {material?.descricao || 'Material removido'}
                          </p>
                        </div>
                        <span className="text-lg font-bold text-primary">
                          {mov.tipo === 'saida' ? '-' : '+'}
                          {mov.quantidade}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(mov.data)}
                        </div>
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {mov.responsavel}
                        </div>
                      </div>

                      {(mov.origem || mov.destino) && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {mov.origem && <span>De: {mov.origem}</span>}
                          {mov.origem && mov.destino && ' → '}
                          {mov.destino && <span>Para: {mov.destino}</span>}
                        </p>
                      )}

                      {mov.observacoes && (
                        <p className="mt-2 text-xs italic text-muted-foreground">
                          "{mov.observacoes}"
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {showForm && (
        <MovimentacaoForm
          materiais={materiais}
          onSubmit={addMovimentacao}
          onClose={() => setShowForm(false)}
        />
      )}
    </MobileLayout>
  );
};

export default Movimentacoes;
