import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus, Clock, CheckCircle, XCircle, AlertCircle, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { criarSolicitacao, minhasSolicitacoes, listarTodasSolicitacoes, excluirSolicitacao } from '@/hooks/useSolicitacoesCodigo';
import { listFabricantes } from '@/hooks/useDataOperations';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import logoImex from '@/assets/logo-imex.png';

interface Fabricante {
  id: string;
  nome: string;
  codigo: string;
}

interface Solicitacao {
  id: string;
  numero_solicitacao: number;
  descricao: string;
  fabricantes: { nome: string } | null;
  status: string;
  codigo_gerado: string | null;
  motivo_rejeicao: string | null;
  created_at: string;
}

const statusConfig: Record<string, { label: string; icon: any; color: string }> = {
  pendente: { label: 'Pendente', icon: Clock, color: 'bg-yellow-100 text-yellow-800' },
  em_processamento: { label: 'Em Processamento', icon: Loader2, color: 'bg-blue-100 text-blue-800' },
  codigo_gerado: { label: 'Aguardando Aprovação', icon: Clock, color: 'bg-purple-100 text-purple-800' },
  aprovado: { label: 'Aprovado', icon: CheckCircle, color: 'bg-green-100 text-green-800' },
  rejeitado: { label: 'Rejeitado', icon: XCircle, color: 'bg-red-100 text-red-800' },
};

const NovaSolicitacao = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [descricao, setDescricao] = useState('');
  const [fabricanteId, setFabricanteId] = useState('');
  const [fabricantes, setFabricantes] = useState<Fabricante[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; solicitacao: Solicitacao | null }>({ open: false, solicitacao: null });
  const [isDeleting, setIsDeleting] = useState(false);

  const isAdmin = user?.tipo === 'admin';
  const canAccess = user?.tipo === 'user' || isAdmin;

  const loadFabricantes = async () => {
    const result = await listFabricantes();
    if (result.success) {
      setFabricantes(result.data || []);
    }
  };

  const loadSolicitacoes = useCallback(async () => {
    if (!canAccess) return;
    setIsLoading(true);
    try {
      // Admin vê todas, user vê só as suas
      const result = isAdmin ? await listarTodasSolicitacoes() : await minhasSolicitacoes();
      if (result.success) {
        setSolicitacoes(result.data || []);
      }
    } finally {
      setIsLoading(false);
    }
  }, [canAccess, isAdmin]);

  useEffect(() => {
    if (canAccess) {
      loadFabricantes();
      loadSolicitacoes();

      // Realtime para atualizar status
      const channel = supabase
        .channel('minhas-solicitacoes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'solicitacoes_codigo'
          },
          () => loadSolicitacoes()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [canAccess, loadSolicitacoes]);

  const handleSubmit = async () => {
    if (!descricao.trim()) {
      toast({
        title: 'Atenção',
        description: 'Informe a descrição do material',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await criarSolicitacao(descricao.trim(), fabricanteId || undefined);
      if (result.success) {
        toast({
          title: 'Sucesso',
          description: 'Solicitação enviada com sucesso!',
        });
        setDescricao('');
        setFabricanteId('');
        loadSolicitacoes();
      } else {
        toast({
          title: 'Erro',
          description: result.error || 'Erro ao enviar solicitação',
          variant: 'destructive',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.solicitacao) return;
    
    setIsDeleting(true);
    try {
      const result = await excluirSolicitacao(deleteDialog.solicitacao.id);
      if (result.success) {
        toast({
          title: 'Sucesso',
          description: 'Solicitação excluída com sucesso!',
        });
        loadSolicitacoes();
      } else {
        toast({
          title: 'Erro',
          description: result.error || 'Erro ao excluir solicitação',
          variant: 'destructive',
        });
      }
    } finally {
      setIsDeleting(false);
      setDeleteDialog({ open: false, solicitacao: null });
    }
  };

  if (!canAccess) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background p-4">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h1 className="text-xl font-bold mb-2">Acesso Negado</h1>
        <p className="text-muted-foreground text-center mb-4">
          Você não tem permissão para acessar esta página.
        </p>
        <Button onClick={() => navigate('/')}>Voltar ao Início</Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border bg-card px-2 py-1.5 shrink-0">
        <button
          onClick={() => navigate('/')}
          className="rounded-lg p-1 hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <img src={logoImex} alt="IMEX Solutions" className="h-5" />
        <h1 className="text-sm font-bold flex-1">Solicitar Código</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Formulário de Nova Solicitação */}
        <div className="border border-border rounded-lg p-3 bg-card space-y-3">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nova Solicitação
          </h2>
          
          <div className="space-y-2">
            <Label className="text-xs">Descrição do Material *</Label>
            <Textarea
              placeholder="Descreva o material detalhadamente..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="min-h-[80px] text-sm"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Fabricante (opcional)</Label>
            <Select value={fabricanteId} onValueChange={setFabricanteId} disabled={isSubmitting}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Selecione o fabricante" />
              </SelectTrigger>
              <SelectContent>
                {fabricantes.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !descricao.trim()}
            className="w-full"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Enviar Solicitação
          </Button>
        </div>

        {/* Solicitações */}
        <div className="space-y-2">
          <h2 className="font-semibold text-sm">
            {isAdmin ? 'Todas as Solicitações' : 'Minhas Solicitações'}
          </h2>
          
          {isLoading ? (
            <div className="flex items-center justify-center h-24">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : solicitacoes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-24 text-muted-foreground border border-dashed rounded-lg">
              <Clock className="h-6 w-6 mb-1" />
              <p className="text-xs">Nenhuma solicitação ainda</p>
            </div>
          ) : (
            solicitacoes.map((s) => {
              const status = statusConfig[s.status] || statusConfig.pendente;
              const StatusIcon = status.icon;
              const canDelete = isAdmin && s.status !== 'aprovado';
              
              return (
                <div key={s.id} className="border border-border rounded-lg p-3 bg-card">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">
                      #{s.numero_solicitacao}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <Badge className={`text-xs ${status.color}`}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {status.label}
                      </Badge>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteDialog({ open: true, solicitacao: s })}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="font-medium text-sm mb-1 line-clamp-2">{s.descricao}</p>
                  {s.fabricantes && (
                    <p className="text-xs text-muted-foreground">
                      Fabricante: {s.fabricantes.nome}
                    </p>
                  )}
                  {s.codigo_gerado && (
                    <p className="text-xs font-medium text-primary mt-1">
                      Código: {s.codigo_gerado}
                    </p>
                  )}
                  {s.motivo_rejeicao && (
                    <p className="text-xs text-destructive mt-1">
                      Motivo: {s.motivo_rejeicao}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(s.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, solicitacao: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Solicitação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a solicitação #{deleteDialog.solicitacao?.numero_solicitacao}?
              <br />
              <span className="font-medium">"{deleteDialog.solicitacao?.descricao}"</span>
              <br /><br />
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default NovaSolicitacao;
