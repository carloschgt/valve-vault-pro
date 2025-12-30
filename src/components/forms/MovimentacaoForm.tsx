import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Material, Movimentacao, TipoMovimentacaoType } from '@/types/material';
import { TIPOS_MOVIMENTACAO } from '@/types/material';

interface MovimentacaoFormProps {
  materiais: Material[];
  onSubmit: (data: Omit<Movimentacao, 'id'>) => void;
  onClose: () => void;
  preSelectedMaterialId?: string;
}

export function MovimentacaoForm({
  materiais,
  onSubmit,
  onClose,
  preSelectedMaterialId,
}: MovimentacaoFormProps) {
  const [formData, setFormData] = useState({
    materialId: preSelectedMaterialId || '',
    tipo: 'entrada' as TipoMovimentacaoType,
    quantidade: 1,
    origem: '',
    destino: '',
    responsavel: '',
    observacoes: '',
  });

  const selectedMaterial = materiais.find((m) => m.id === formData.materialId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      data: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/50 backdrop-blur-sm sm:items-center">
      <div className="animate-slide-up w-full max-w-lg rounded-t-2xl bg-card p-6 shadow-xl sm:rounded-2xl sm:m-4">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-foreground">
            Nova Movimentação
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="material">Material *</Label>
            <Select
              value={formData.materialId}
              onValueChange={(value) => setFormData({ ...formData, materialId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um material" />
              </SelectTrigger>
              <SelectContent>
                {materiais.map((material) => (
                  <SelectItem key={material.id} value={material.id}>
                    {material.codigo} - {material.descricao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedMaterial && (
              <p className="text-sm text-muted-foreground">
                Quantidade atual: {selectedMaterial.quantidade} {selectedMaterial.unidade}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo *</Label>
              <Select
                value={formData.tipo}
                onValueChange={(value: TipoMovimentacaoType) =>
                  setFormData({ ...formData, tipo: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPOS_MOVIMENTACAO).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantidade">Quantidade *</Label>
              <Input
                id="quantidade"
                type="number"
                min="1"
                max={formData.tipo === 'saida' ? selectedMaterial?.quantidade : undefined}
                value={formData.quantidade}
                onChange={(e) =>
                  setFormData({ ...formData, quantidade: parseInt(e.target.value) || 1 })
                }
                required
              />
            </div>
          </div>

          {(formData.tipo === 'transferencia' || formData.tipo === 'saida') && (
            <div className="space-y-2">
              <Label htmlFor="origem">Origem</Label>
              <Input
                id="origem"
                value={formData.origem || selectedMaterial?.localizacao || ''}
                onChange={(e) => setFormData({ ...formData, origem: e.target.value })}
                placeholder="Local de origem"
              />
            </div>
          )}

          {(formData.tipo === 'transferencia' || formData.tipo === 'entrada') && (
            <div className="space-y-2">
              <Label htmlFor="destino">Destino *</Label>
              <Input
                id="destino"
                value={formData.destino}
                onChange={(e) => setFormData({ ...formData, destino: e.target.value })}
                placeholder="Local de destino"
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="responsavel">Responsável *</Label>
            <Input
              id="responsavel"
              value={formData.responsavel}
              onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
              placeholder="Nome do responsável"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              placeholder="Observações adicionais..."
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="hero"
              className="flex-1"
              disabled={!formData.materialId}
            >
              Registrar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
