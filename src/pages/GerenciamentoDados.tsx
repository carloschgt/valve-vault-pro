import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Loader2, AlertTriangle, Database, Package, BookOpen, Users, MapPin } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import logoImex from '@/assets/logo-imex.png';

interface DataType {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  table: string;
  color: string;
}

const DATA_TYPES: DataType[] = [
  {
    id: 'fabricantes',
    name: 'Fabricantes',
    description: 'Limpar todos os fabricantes cadastrados',
    icon: <Users className="h-5 w-5" />,
    table: 'fabricantes',
    color: 'text-blue-500',
  },
  {
    id: 'catalogo',
    name: 'Catálogo de Produtos',
    description: 'Limpar todos os produtos do catálogo',
    icon: <BookOpen className="h-5 w-5" />,
    table: 'catalogo_produtos',
    color: 'text-purple-500',
  },
  {
    id: 'enderecos',
    name: 'Endereçamentos',
    description: 'Limpar todos os endereçamentos de materiais',
    icon: <MapPin className="h-5 w-5" />,
    table: 'enderecos_materiais',
    color: 'text-green-500',
  },
  {
    id: 'inventario',
    name: 'Inventário',
    description: 'Limpar todas as contagens de inventário',
    icon: <Package className="h-5 w-5" />,
    table: 'inventario',
    color: 'text-orange-500',
  },
];

const GerenciamentoDados = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const isAdmin = user?.tipo === 'admin';
  
  const [loadingType, setLoadingType] = useState<string | null>(null);

  const handleClearData = async (dataType: DataType) => {
    setLoadingType(dataType.id);
    
    try {
      // Get session token
      const sessionToken = localStorage.getItem('session_token');
      
      const { data, error } = await supabase.functions.invoke('data-operations', {
        body: {
          action: 'clear_table',
          sessionToken,
          table: dataType.table,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      // Invalidar todas as queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['admin_enderecos'] });
      queryClient.invalidateQueries({ queryKey: ['admin_inventario'] });
      queryClient.invalidateQueries({ queryKey: ['admin_catalogo'] });
      queryClient.invalidateQueries({ queryKey: ['fabricantes'] });
      queryClient.invalidateQueries({ queryKey: ['catalogo_produtos'] });

      toast({
        title: 'Sucesso',
        description: `Dados de ${dataType.name} foram limpos com sucesso!`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao limpar dados',
        variant: 'destructive',
      });
    } finally {
      setLoadingType(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <p className="text-lg text-muted-foreground">Acesso restrito a administradores</p>
        <Button onClick={() => navigate('/')} className="mt-4">Voltar</Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-border bg-card p-4">
        <button onClick={() => navigate('/')} className="rounded-lg p-2 hover:bg-accent">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <img src={logoImex} alt="IMEX Solutions" className="h-8" />
        <h1 className="text-lg font-bold">Gerenciamento de Dados</h1>
      </div>

      <div className="flex-1 space-y-4 p-4">
        {/* Aviso */}
        <div className="flex items-start gap-3 rounded-xl border border-destructive/50 bg-destructive/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
          <div>
            <h3 className="font-semibold text-destructive">Atenção!</h3>
            <p className="text-sm text-muted-foreground">
              Esta área permite limpar todos os dados de cada tipo de cadastro. 
              Esta ação é irreversível e deve ser usada apenas para preparar o sistema para produção.
            </p>
          </div>
        </div>

        {/* Tipos de dados */}
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Database className="h-5 w-5" />
            Tipos de Dados
          </h2>
          
          {DATA_TYPES.map((dataType) => (
            <div
              key={dataType.id}
              className="flex items-center justify-between rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-center gap-3">
                <div className={dataType.color}>{dataType.icon}</div>
                <div>
                  <h3 className="font-medium">{dataType.name}</h3>
                  <p className="text-sm text-muted-foreground">{dataType.description}</p>
                </div>
              </div>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={loadingType !== null}
                  >
                    {loadingType === dataType.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Limpar
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                      <AlertTriangle className="h-5 w-5" />
                      Você tem certeza?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Você tem certeza que deseja limpar os dados de <strong>{dataType.name}</strong>?
                      <br /><br />
                      Esta ação irá remover <strong>permanentemente</strong> todos os registros. 
                      Esta operação <strong>não pode ser desfeita</strong>.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleClearData(dataType)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Sim, limpar dados
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GerenciamentoDados;
