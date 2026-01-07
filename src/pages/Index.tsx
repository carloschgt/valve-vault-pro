import { useState } from 'react';
import { Search, Filter, Package } from 'lucide-react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { MaterialCard } from '@/components/MaterialCard';
import { MaterialForm } from '@/components/forms/MaterialForm';
import { MaterialDetail } from '@/components/MaterialDetail';
import { Input } from '@/components/ui/input';
import { useMateriais } from '@/hooks/useMateriais';
import type { Material, CategoriaType } from '@/types/material';
import { CATEGORIAS } from '@/types/material';
import { cn } from '@/lib/utils';
import { matchesAnyWildcard } from '@/lib/wildcardSearch';

const Index = () => {
  const { materiais, addMaterial, updateMaterial, deleteMaterial, addMovimentacao, isLoading } = useMateriais();
  const [showForm, setShowForm] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoriaType | 'all'>('all');

  const filteredMateriais = materiais.filter((m) => {
    const matchesSearch = matchesAnyWildcard(
      [m.codigo, m.descricao, m.localizacao],
      searchTerm
    );
    const matchesCategory = selectedCategory === 'all' || m.categoria === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const stats = {
    total: materiais.length,
    disponivel: materiais.filter((m) => m.status === 'disponivel').length,
    reservado: materiais.filter((m) => m.status === 'reservado').length,
  };

  if (isLoading) {
    return (
      <MobileLayout title="Estoque">
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout title="Estoque" showAddButton onAddClick={() => setShowForm(true)}>
      <div className="animate-fade-in space-y-4 p-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-gradient-primary p-4 text-center shadow-md">
            <p className="text-2xl font-bold text-primary-foreground">{stats.total}</p>
            <p className="text-xs font-medium text-primary-foreground/80">Total</p>
          </div>
          <div className="rounded-xl border border-mrx-success/30 bg-mrx-success/10 p-4 text-center">
            <p className="text-2xl font-bold text-mrx-success">{stats.disponivel}</p>
            <p className="text-xs font-medium text-mrx-success/80">Disponível</p>
          </div>
          <div className="rounded-xl border border-mrx-warning/30 bg-mrx-warning/10 p-4 text-center">
            <p className="text-2xl font-bold text-mrx-warning">{stats.reservado}</p>
            <p className="text-xs font-medium text-mrx-warning/80">Reservado</p>
          </div>
        </div>


        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar... (use * como coringa, ex: 002* ou *ABC*)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => setSelectedCategory('all')}
            className={cn(
              'whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all',
              selectedCategory === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            )}
          >
            Todos
          </button>
          {Object.entries(CATEGORIAS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSelectedCategory(key as CategoriaType)}
              className={cn(
                'whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all',
                selectedCategory === key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Materials List */}
        <div className="space-y-3">
          {filteredMateriais.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
              <Package className="mb-3 h-12 w-12 text-muted-foreground/50" />
              <p className="font-medium text-muted-foreground">
                {materiais.length === 0
                  ? 'Nenhum material cadastrado'
                  : 'Nenhum material encontrado'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground/70">
                {materiais.length === 0
                  ? 'Clique em + para adicionar'
                  : 'Tente ajustar os filtros'}
              </p>
            </div>
          ) : (
            filteredMateriais.map((material) => (
              <MaterialCard
                key={material.id}
                material={material}
                onClick={() => setSelectedMaterial(material)}
              />
            ))
          )}
        </div>
      </div>

      {/* Forms & Modals */}
      {showForm && (
        <MaterialForm
          onSubmit={addMaterial}
          onClose={() => setShowForm(false)}
        />
      )}

      {selectedMaterial && (
        <MaterialDetail
          material={selectedMaterial}
          onClose={() => setSelectedMaterial(null)}
          onEdit={(material) => {
            setSelectedMaterial(null);
            // Re-open with edit mode
          }}
          onDelete={(id) => {
            deleteMaterial(id);
            setSelectedMaterial(null);
          }}
          onMovimentar={addMovimentacao}
        />
      )}
    </MobileLayout>
  );
};

export default Index;
