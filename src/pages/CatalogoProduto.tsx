import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Loader2, Save, Package } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getCatalogoDescricao, updateCatalogo } from '@/hooks/useDataOperations';
import { Skeleton } from '@/components/ui/skeleton';
import logoImex from '@/assets/logo-imex.png';

interface Produto {
  id: string;
  codigo: string;
  descricao: string;
  peso_kg?: number | null;
  ativo?: boolean;
}

const CatalogoProduto = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [searchCodigo, setSearchCodigo] = useState('');
  const [produto, setProduto] = useState<Produto | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);
  
  // Edit fields
  const [editDescricao, setEditDescricao] = useState('');
  const [editPeso, setEditPeso] = useState('');

  const isAdmin = user?.tipo === 'admin';

  // Wait for auth to load before showing UI
  useEffect(() => {
    if (!authLoading && user) {
      setPermissionsLoaded(true);
    }
  }, [authLoading, user]);

  const handleBuscar = async () => {
    if (!searchCodigo.trim()) {
      toast({
        title: 'Atenção',
        description: 'Digite um código para buscar',
        variant: 'destructive',
      });
      return;
    }

    setIsSearching(true);
    setProduto(null);
    setNotFound(false);
    
    try {
      // Treat code as string to preserve leading zeros
      const codigoTrimmed = searchCodigo.trim();
      
      // Use Edge Function to bypass RLS
      const result = await getCatalogoDescricao(codigoTrimmed);

      if (!result.success) {
        throw new Error(result.error);
      }

      if (result.data) {
        setProduto(result.data);
        setEditDescricao(result.data.descricao || '');
        setEditPeso(result.data.peso_kg?.toString() || '');
        toast({
          title: 'Produto encontrado',
          description: `${result.data.codigo} - ${result.data.descricao}`,
        });
      } else {
        setNotFound(true);
        toast({
          title: 'Não encontrado',
          description: 'Nenhum produto encontrado com este código',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao buscar produto',
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSalvar = async () => {
    if (!produto || !isAdmin) return;
    
    if (!editDescricao.trim()) {
      toast({
        title: 'Atenção',
        description: 'A descrição é obrigatória',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const pesoNum = editPeso.trim() ? parseFloat(editPeso) : undefined;
      
      const result = await updateCatalogo(
        produto.id,
        produto.codigo,
        editDescricao.trim(),
        pesoNum
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      // Update local state
      setProduto({
        ...produto,
        descricao: editDescricao.trim().toUpperCase(),
        peso_kg: pesoNum,
      });

      toast({
        title: 'Sucesso',
        description: 'Produto atualizado com sucesso!',
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao atualizar produto',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Show skeleton while loading permissions
  if (!permissionsLoaded || authLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <div className="flex items-center gap-4 border-b border-border bg-card p-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="flex-1 p-4 space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

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
        <h1 className="text-lg font-bold">Cadastro de Produto</h1>
      </div>

      {/* Search */}
      <div className="border-b border-border bg-card p-4">
        <Label htmlFor="searchCodigo">Código do Produto</Label>
        <div className="mt-2 flex gap-2">
          <Input
            id="searchCodigo"
            placeholder="Digite o código do produto"
            value={searchCodigo}
            onChange={(e) => setSearchCodigo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
            inputMode="numeric"
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
        <p className="mt-2 text-xs text-muted-foreground">
          Digite o código completo para buscar (aceita zeros à esquerda)
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 p-4">
        {notFound && (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <Package className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">
              Nenhum produto encontrado com o código "{searchCodigo}"
            </p>
          </div>
        )}

        {produto && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Dados do Produto</h2>
                {!produto.ativo && (
                  <span className="rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">
                    Inativo
                  </span>
                )}
              </div>

              <div className="space-y-4">
                {/* Código - Read-only */}
                <div>
                  <Label htmlFor="codigo">Código</Label>
                  <Input
                    id="codigo"
                    value={produto.codigo}
                    disabled
                    className="bg-muted"
                  />
                </div>

                {/* Descrição */}
                <div>
                  <Label htmlFor="descricao">Descrição</Label>
                  <Input
                    id="descricao"
                    value={editDescricao}
                    onChange={(e) => setEditDescricao(e.target.value)}
                    disabled={!isAdmin}
                    className={!isAdmin ? 'bg-muted' : ''}
                    maxLength={500}
                  />
                </div>

                {/* Peso */}
                <div>
                  <Label htmlFor="peso">Peso (kg)</Label>
                  <Input
                    id="peso"
                    type="number"
                    step="0.01"
                    value={editPeso}
                    onChange={(e) => setEditPeso(e.target.value)}
                    disabled={!isAdmin}
                    className={!isAdmin ? 'bg-muted' : ''}
                    placeholder="0.00"
                  />
                </div>

                {/* Admin-only save button */}
                {isAdmin && permissionsLoaded && (
                  <Button
                    onClick={handleSalvar}
                    disabled={isSaving}
                    className="w-full"
                  >
                    {isSaving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Salvar Alterações
                  </Button>
                )}

                {!isAdmin && (
                  <p className="text-center text-sm text-muted-foreground">
                    Somente administradores podem editar produtos
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CatalogoProduto;
