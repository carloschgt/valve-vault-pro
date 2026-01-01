import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Loader2, Trash2 } from 'lucide-react';
import { InputUppercase } from '@/components/ui/input-uppercase';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { listFabricantes, insertFabricante, deleteFabricante } from '@/hooks/useDataOperations';
import logoImex from '@/assets/logo-imex.png';

interface Fabricante {
  id: string;
  nome: string;
  codigo: string;
  cadastrado_por: string;
  data_cadastro: string;
}

const Fabricantes = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [fabricantes, setFabricantes] = useState<Fabricante[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [nome, setNome] = useState('');
  const [codigo, setCodigo] = useState('');

  const loadFabricantes = async () => {
    setIsLoading(true);
    const result = await listFabricantes();

    if (!result.success) {
      toast({
        title: 'Erro',
        description: result.error || 'Erro ao carregar fabricantes',
        variant: 'destructive',
      });
    } else {
      setFabricantes(result.data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadFabricantes();
  }, []);

  const handleSalvar = async () => {
    if (!nome.trim() || !codigo.trim()) {
      toast({
        title: 'Atenção',
        description: 'Preencha o nome e código do fabricante',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const result = await insertFabricante(nome.trim(), codigo.trim().toUpperCase());

      if (!result.success) {
        throw new Error(result.error);
      }

      toast({
        title: 'Sucesso',
        description: 'Fabricante cadastrado com sucesso!',
      });

      setNome('');
      setCodigo('');
      loadFabricantes();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao cadastrar fabricante',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExcluir = async (id: string) => {
    try {
      const result = await deleteFabricante(id);

      if (!result.success) {
        throw new Error(result.error);
      }

      toast({
        title: 'Sucesso',
        description: 'Fabricante excluído com sucesso!',
      });

      loadFabricantes();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao excluir fabricante',
        variant: 'destructive',
      });
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
        <h1 className="text-lg font-bold">Fabricantes</h1>
      </div>

      {/* Form */}
      <div className="border-b border-border bg-card p-4">
        <h2 className="mb-4 font-semibold">Novo Fabricante</h2>
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex-1 space-y-2">
            <Label htmlFor="codigo">Código</Label>
            <InputUppercase
              id="codigo"
              placeholder="Ex: ABB"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
            />
          </div>
          <div className="flex-[2] space-y-2">
            <Label htmlFor="nome">Nome</Label>
            <InputUppercase
              id="nome"
              placeholder="Ex: ABB Ltda"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={handleSalvar} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Adicionar
            </Button>
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 p-4">
        <h2 className="mb-4 font-semibold">Fabricantes Cadastrados</h2>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : fabricantes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-8 text-center text-muted-foreground">
            Nenhum fabricante cadastrado
          </div>
        ) : (
          <div className="space-y-2">
            {fabricantes.map((fab) => (
              <div
                key={fab.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-4"
              >
                <div>
                  <p className="font-medium">{fab.nome}</p>
                  <p className="text-sm text-muted-foreground">
                    Código: {fab.codigo}
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir fabricante?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Deseja realmente excluir o fabricante "{fab.nome}"? Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleExcluir(fab.id)}>
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Fabricantes;