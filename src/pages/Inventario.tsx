import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Save, Loader2, MapPin, Edit2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { insertInventario, updateInventario } from '@/hooks/useDataOperations';
import logoImex from '@/assets/logo-imex.png';
import { sanitizeSearchTerm } from '@/lib/security';

interface EnderecoMaterial {
  id: string;
  codigo: string;
  descricao: string;
  tipo_material: string;
  peso: number;
  rua: number;
  coluna: number;
  nivel: number;
  posicao: number;
  fabricante_id: string;
  fabricantes?: {
    nome: string;
  };
}

interface InventarioItem {
  id: string;
  endereco_material_id: string;
  quantidade: number;
  contado_por: string;
  updated_at: string;
}

const Inventario = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [codigo, setCodigo] = useState('');
  const [enderecos, setEnderecos] = useState<EnderecoMaterial[]>([]);
  const [selectedEndereco, setSelectedEndereco] = useState<EnderecoMaterial | null>(null);
  const [quantidade, setQuantidade] = useState('');
  const [comentario, setComentario] = useState('');
  const [inventarioExistente, setInventarioExistente] = useState<InventarioItem | null>(null);
  
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const isAdmin = user?.tipo === 'admin';

  const handleBuscar = async () => {
    if (!codigo.trim()) {
      toast({
        title: 'Atenção',
        description: 'Digite um código para buscar',
        variant: 'destructive',
      });
      return;
    }

    setIsSearching(true);
    setSelectedEndereco(null);
    setQuantidade('');
    setInventarioExistente(null);
    
    try {
      const { data, error } = await supabase
        .from('enderecos_materiais')
        .select(`
          *,
          fabricantes (nome)
        `)
        .ilike('codigo', `%${sanitizeSearchTerm(codigo)}%`);

      if (error) throw error;

      if (data && data.length > 0) {
        setEnderecos(data);
        toast({
          title: 'Sucesso',
          description: `${data.length} endereço(s) encontrado(s)`,
        });
      } else {
        setEnderecos([]);
        toast({
          title: 'Não encontrado',
          description: 'Nenhum endereço encontrado para este código',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao buscar endereços',
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectEndereco = async (endereco: EnderecoMaterial) => {
    setSelectedEndereco(endereco);
    setIsEditing(false);
    
    // Buscar inventário existente para este endereço
    const { data } = await supabase
      .from('inventario')
      .select('*')
      .eq('endereco_material_id', endereco.id)
      .maybeSingle();

    if (data) {
      setInventarioExistente(data);
      setQuantidade(data.quantidade.toString());
      setComentario((data as any).comentario || '');
    } else {
      setInventarioExistente(null);
      setQuantidade('');
      setComentario('');
    }
  };

  const handleSalvar = async () => {
    if (!selectedEndereco || !quantidade) {
      toast({
        title: 'Atenção',
        description: 'Selecione um endereço e informe a quantidade',
        variant: 'destructive',
      });
      return;
    }

    // Se já existe inventário e não é admin, não pode editar
    if (inventarioExistente && !isAdmin && !isEditing) {
      toast({
        title: 'Sem permissão',
        description: 'Apenas administradores podem editar contagens existentes',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      let result;
      
      if (inventarioExistente) {
        // Atualizar existente (apenas admin)
        result = await updateInventario(inventarioExistente.id, quantidade, comentario.trim() || undefined);
      } else {
        // Inserir novo
        result = await insertInventario(selectedEndereco.id, quantidade, comentario.trim() || undefined);
      }

      if (!result.success) {
        throw new Error(result.error);
      }

      toast({
        title: 'Sucesso',
        description: 'Contagem salva com sucesso!',
      });

      // Resetar seleção
      setSelectedEndereco(null);
      setQuantidade('');
      setComentario('');
      setInventarioExistente(null);
      setIsEditing(false);
      
      // Rebuscar para atualizar lista
      handleBuscar();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao salvar contagem',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

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
        <h1 className="text-lg font-bold">Inventário</h1>
      </div>

      {/* Search */}
      <div className="border-b border-border bg-card p-4">
        <Label htmlFor="codigo">Código do Material</Label>
        <div className="mt-2 flex gap-2">
          <Input
            id="codigo"
            placeholder="Digite o código"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
            className="flex-1"
          />
          <Button
            onClick={handleBuscar}
            disabled={isSearching}
            variant="secondary"
          >
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4">
        {/* Endereços encontrados */}
        {enderecos.length > 0 && !selectedEndereco && (
          <div className="space-y-3">
            <h2 className="font-semibold text-muted-foreground">
              Selecione o endereço para contagem:
            </h2>
            {enderecos.map((endereco) => (
              <button
                key={endereco.id}
                onClick={() => handleSelectEndereco(endereco)}
                className="w-full rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-bold text-primary">{endereco.codigo}</p>
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {endereco.descricao}
                    </p>
                    <p className="mt-1 text-sm">
                      <span className="text-muted-foreground">Fabricante:</span>{' '}
                      {endereco.fabricantes?.nome || '-'}
                    </p>
                    <p className="text-sm">
                      <span className="text-muted-foreground">Peso:</span>{' '}
                      {endereco.peso} kg
                    </p>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">
                      R{endereco.rua}.C{endereco.coluna}.N{endereco.nivel}.P{endereco.posicao}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Formulário de contagem */}
        {selectedEndereco && (
          <div className="space-y-4">
            <button
              onClick={() => {
                setSelectedEndereco(null);
                setQuantidade('');
                setInventarioExistente(null);
              }}
              className="text-sm text-primary hover:underline"
            >
              ← Voltar para lista
            </button>

            <div className="rounded-xl border border-border bg-card p-4">
              <p className="font-bold text-primary">{selectedEndereco.codigo}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedEndereco.descricao}
              </p>
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2">
                <MapPin className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  R{selectedEndereco.rua}.C{selectedEndereco.coluna}.N{selectedEndereco.nivel}.P{selectedEndereco.posicao}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Fabricante:</span>{' '}
                  {selectedEndereco.fabricantes?.nome || '-'}
                </p>
                <p>
                  <span className="text-muted-foreground">Peso:</span>{' '}
                  {selectedEndereco.peso} kg
                </p>
              </div>
            </div>

            {/* Mostrar contagem existente ou formulário */}
            {inventarioExistente && !isEditing ? (
              <div className="rounded-xl border border-mrx-success/30 bg-mrx-success/10 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Quantidade contada:</p>
                    <p className="text-3xl font-bold text-mrx-success">
                      {inventarioExistente.quantidade}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Por: {inventarioExistente.contado_por}
                    </p>
                  </div>
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditing(true)}
                    >
                      <Edit2 className="mr-2 h-4 w-4" />
                      Editar
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="quantidade">Quantidade *</Label>
                  <Input
                    id="quantidade"
                    type="number"
                    placeholder="Digite a quantidade"
                    value={quantidade}
                    onChange={(e) => setQuantidade(e.target.value)}
                    className="text-2xl font-bold"
                  />
                </div>

                {/* Comentário */}
                <div className="space-y-2">
                  <Label htmlFor="comentario">Comentário (opcional)</Label>
                  <Input
                    id="comentario"
                    placeholder="Observações sobre a contagem"
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                    maxLength={500}
                  />
                </div>

                <Button
                  onClick={handleSalvar}
                  disabled={isSaving || !quantidade}
                  className="w-full"
                  size="lg"
                >
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {inventarioExistente ? 'Atualizar Contagem' : 'Salvar Contagem'}
                </Button>

                {isEditing && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false);
                      setQuantidade(inventarioExistente?.quantidade.toString() || '');
                    }}
                    className="w-full"
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {enderecos.length === 0 && !isSearching && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="font-medium text-muted-foreground">
              Digite um código para buscar
            </p>
            <p className="mt-1 text-sm text-muted-foreground/70">
              Os endereços cadastrados aparecerão aqui
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Inventario;
