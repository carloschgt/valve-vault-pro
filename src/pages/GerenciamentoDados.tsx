import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Loader2, AlertTriangle, Database, Package, BookOpen, Users, MapPin, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useQueryClient, useQuery } from '@tanstack/react-query';
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

const AUTH_KEY = 'imex_auth_user';

function getSessionToken(): string | null {
  try {
    const stored = localStorage.getItem(AUTH_KEY);
    if (stored) {
      const user = JSON.parse(stored);
      return user.sessionToken || null;
    }
  } catch {
    return null;
  }
  return null;
}

const GerenciamentoDados = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const isAdmin = user?.tipo === 'admin';
  
  const [loadingType, setLoadingType] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [selectedType, setSelectedType] = useState<DataType | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Buscar contagens de cada tabela
  const { data: counts = {} } = useQuery({
    queryKey: ['table_counts'],
    queryFn: async () => {
      const sessionToken = getSessionToken();
      if (!sessionToken) return {};
      
      const { data, error } = await supabase.functions.invoke('data-operations', {
        body: { action: 'get_table_counts', sessionToken },
      });
      
      if (error || !data.success) return {};
      return data.counts || {};
    },
    enabled: isAdmin,
  });

  const handleOpenConfirmDialog = (dataType: DataType) => {
    setSelectedType(dataType);
    setConfirmText('');
    setShowConfirmDialog(true);
  };

  const handleClearData = async () => {
    if (!selectedType || confirmText !== 'LIMPAR') {
      toast({
        title: 'Atenção',
        description: 'Digite LIMPAR para confirmar a exclusão',
        variant: 'destructive',
      });
      return;
    }

    setLoadingType(selectedType.id);
    setShowConfirmDialog(false);
    
    try {
      const sessionToken = getSessionToken();
      
      if (!sessionToken) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }
      
      const { data, error } = await supabase.functions.invoke('data-operations', {
        body: {
          action: 'clear_table',
          sessionToken,
          table: selectedType.table,
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
      queryClient.invalidateQueries({ queryKey: ['table_counts'] });

      toast({
        title: 'Sucesso',
        description: `Dados de ${selectedType.name} foram limpos com sucesso!`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao limpar dados',
        variant: 'destructive',
      });
    } finally {
      setLoadingType(null);
      setSelectedType(null);
      setConfirmText('');
    }
  };

  const handleExportAll = async () => {
    toast({
      title: 'Em desenvolvimento',
      description: 'A exportação completa será implementada em breve.',
    });
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
        {/* Backup button */}
        <Button
          variant="outline"
          className="w-full"
          onClick={handleExportAll}
        >
          <Download className="mr-2 h-4 w-4" />
          Exportar Backup Completo (antes de limpar)
        </Button>

        {/* Aviso */}
        <div className="flex items-start gap-3 rounded-xl border border-destructive/50 bg-destructive/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
          <div>
            <h3 className="font-semibold text-destructive">Atenção!</h3>
            <p className="text-sm text-muted-foreground">
              Esta área permite limpar todos os dados de cada tipo de cadastro. 
              Esta ação é <strong>irreversível</strong>. Você precisará digitar "LIMPAR" para confirmar.
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
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{dataType.name}</h3>
                    {counts[dataType.table] !== undefined && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                        {counts[dataType.table]} registros
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{dataType.description}</p>
                </div>
              </div>
              
              <Button
                variant="destructive"
                size="sm"
                disabled={loadingType !== null}
                onClick={() => handleOpenConfirmDialog(dataType)}
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
            </div>
          ))}
        </div>
      </div>

      {/* Dialog de confirmação com campo de texto */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirmar exclusão
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                Você está prestes a limpar todos os dados de <strong>{selectedType?.name}</strong>.
                {counts[selectedType?.table || ''] !== undefined && (
                  <span className="block mt-2 font-bold text-destructive">
                    {counts[selectedType?.table || '']} registros serão excluídos permanentemente.
                  </span>
                )}
              </p>
              <p>
                Esta operação <strong>não pode ser desfeita</strong>.
              </p>
              <div className="space-y-2 pt-2">
                <Label htmlFor="confirm">Digite "LIMPAR" para confirmar:</Label>
                <Input
                  id="confirm"
                  placeholder="LIMPAR"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                  className="font-mono"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmText('')}>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleClearData}
              disabled={confirmText !== 'LIMPAR'}
            >
              Sim, limpar dados
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default GerenciamentoDados;
