import { useState } from 'react';
import { X, MapPin, Calendar, User, Hash, Package, Tag, ArrowRightLeft, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MovimentacaoForm } from '@/components/forms/MovimentacaoForm';
import type { Material, Movimentacao } from '@/types/material';
import { CATEGORIAS, STATUS } from '@/types/material';
import { cn } from '@/lib/utils';

interface MaterialDetailProps {
  material: Material;
  onClose: () => void;
  onEdit: (material: Material) => void;
  onDelete: (id: string) => void;
  onMovimentar: (data: Omit<Movimentacao, 'id'>) => void;
}

const statusColors: Record<Material['status'], string> = {
  disponivel: 'bg-mrx-success/15 text-mrx-success border-mrx-success/30',
  reservado: 'bg-mrx-warning/15 text-mrx-warning border-mrx-warning/30',
  em_uso: 'bg-mrx-info/15 text-mrx-info border-mrx-info/30',
  manutencao: 'bg-destructive/15 text-destructive border-destructive/30',
};

export function MaterialDetail({
  material,
  onClose,
  onEdit,
  onDelete,
  onMovimentar,
}: MaterialDetailProps) {
  const [showMovimentacao, setShowMovimentacao] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete(material.id);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/50 backdrop-blur-sm sm:items-center">
        <div className="animate-slide-up w-full max-w-lg rounded-t-2xl bg-card shadow-xl sm:rounded-2xl sm:m-4 max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold text-foreground">
                  {material.codigo}
                </h2>
                <span
                  className={cn(
                    'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
                    statusColors[material.status]
                  )}
                >
                  {STATUS[material.status]}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto p-4 max-h-[60vh]">
            <h3 className="mb-4 text-lg font-semibold text-foreground">
              {material.descricao}
            </h3>

            <div className="space-y-4">
              {/* Quantidade */}
              <div className="rounded-xl bg-gradient-primary p-4 text-center">
                <p className="text-3xl font-bold text-primary-foreground">
                  {material.quantidade}
                </p>
                <p className="text-sm font-medium text-primary-foreground/80">
                  {material.unidade} em estoque
                </p>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/50 p-3">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Tag className="h-4 w-4" />
                    <span className="text-xs">Categoria</span>
                  </div>
                  <p className="font-medium text-foreground">
                    {CATEGORIAS[material.categoria]}
                  </p>
                </div>

                <div className="rounded-lg bg-muted/50 p-3">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <MapPin className="h-4 w-4" />
                    <span className="text-xs">Localização</span>
                  </div>
                  <p className="font-medium text-foreground">{material.localizacao}</p>
                </div>

                <div className="rounded-lg bg-muted/50 p-3">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Calendar className="h-4 w-4" />
                    <span className="text-xs">Data de Entrada</span>
                  </div>
                  <p className="font-medium text-foreground text-sm">
                    {formatDate(material.dataEntrada)}
                  </p>
                </div>

                <div className="rounded-lg bg-muted/50 p-3">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Calendar className="h-4 w-4" />
                    <span className="text-xs">Última Movimentação</span>
                  </div>
                  <p className="font-medium text-foreground text-sm">
                    {formatDate(material.dataUltimaMovimentacao)}
                  </p>
                </div>
              </div>

              {/* Additional Info */}
              {(material.responsavel || material.lote || material.numeroSerie) && (
                <div className="space-y-2">
                  {material.responsavel && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Responsável:</span>
                      <span className="font-medium text-foreground">{material.responsavel}</span>
                    </div>
                  )}
                  {material.lote && (
                    <div className="flex items-center gap-2 text-sm">
                      <Hash className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Lote:</span>
                      <span className="font-medium text-foreground">{material.lote}</span>
                    </div>
                  )}
                  {material.numeroSerie && (
                    <div className="flex items-center gap-2 text-sm">
                      <Hash className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Nº Série:</span>
                      <span className="font-medium text-foreground">{material.numeroSerie}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Observações */}
              {material.observacoes && (
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Observações</p>
                  <p className="text-sm text-foreground">{material.observacoes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="border-t border-border p-4 space-y-3">
            <Button
              variant="hero"
              className="w-full"
              onClick={() => setShowMovimentacao(true)}
            >
              <ArrowRightLeft className="h-4 w-4" />
              Registrar Movimentação
            </Button>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onEdit(material)}
              >
                <Edit className="h-4 w-4" />
                Editar
              </Button>
              <Button
                variant={confirmDelete ? 'destructive' : 'outline'}
                className="flex-1"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4" />
                {confirmDelete ? 'Confirmar' : 'Excluir'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {showMovimentacao && (
        <MovimentacaoForm
          materiais={[material]}
          preSelectedMaterialId={material.id}
          onSubmit={onMovimentar}
          onClose={() => setShowMovimentacao(false)}
        />
      )}
    </>
  );
}
