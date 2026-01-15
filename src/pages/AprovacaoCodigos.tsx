import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Check, X, RefreshCw, AlertCircle, Edit2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
import { listarParaAprovacao, aprovarCodigo, rejeitarCodigo } from '@/hooks/useSolicitacoesCodigo';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import logoImex from '@/assets/logo-imex.png';
import { supabase } from '@/integrations/supabase/client';

interface Solicitacao {
  id: string;
  numero_solicitacao: number;
  descricao: string;
  fabricantes: { nome: string } | null;
  solicitado_por: string;
  codigo_gerado: string;
  processado_por: string;
  processado_em: string;
  created_at: string;
}

const AprovacaoCodigos = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectMotivo, setRejectMotivo] = useState('');
  
  // State for editing code (Super Admin only)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedCodigo, setEditedCodigo] = useState('');

  // Access is controlled by ProtectedRoute via permission 'aprovacao_codigos'

  const loadSolicitacoes = async () => {
    setIsLoading(true);
    try {
      const result = await listarParaAprovacao();
      if (result.success) setSolicitacoes(result.data || []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadSolicitacoes(); }, []);

  const handleStartEdit = (s: Solicitacao) => {
    setEditingId(s.id);
    setEditedCodigo(s.codigo_gerado);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditedCodigo('');
  };

  const handleSaveEdit = async (id: string) => {
    const codigoTrimmed = editedCodigo.trim();
    
    if (codigoTrimmed.length !== 6) {
      toast({
        title: 'Código inválido',
        description: 'O código deve ter exatamente 6 caracteres',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(id);
    try {
      // Get session token
      const stored = localStorage.getItem('imex_auth_user');
      if (!stored) {
        toast({ title: 'Erro', description: 'Sessão não encontrada', variant: 'destructive' });
        return;
      }
      const { sessionToken } = JSON.parse(stored);

      const { data, error } = await supabase.functions.invoke('solicitacoes-codigo', {
        body: { 
          action: 'editar_codigo_aguardando',
          sessionToken,
          solicitacao_id: id,
          novo_codigo: codigoTrimmed
        }
      });

      if (error || !data?.success) {
        toast({ 
          title: 'Erro', 
          description: data?.error || error?.message || 'Erro ao editar código', 
          variant: 'destructive' 
        });
      } else {
        toast({ title: 'Sucesso', description: 'Código atualizado!' });
        setEditingId(null);
        setEditedCodigo('');
        loadSolicitacoes();
      }
    } finally {
      setIsProcessing(null);
    }
  };

  const handleAprovar = async (id: string) => {
    // If editing, validate the edited code first
    if (editingId === id) {
      if (editedCodigo.trim().length !== 6) {
        toast({
          title: 'Código inválido',
          description: 'O código deve ter exatamente 6 caracteres',
          variant: 'destructive',
        });
        return;
      }
      // Save edit first, then approve
      await handleSaveEdit(id);
    }
    
    setIsProcessing(id);
    try {
      const result = await aprovarCodigo(id);
      if (result.success) {
        toast({ title: 'Sucesso', description: 'Código aprovado e adicionado ao catálogo!' });
        loadSolicitacoes();
      } else {
        toast({ title: 'Erro', description: result.error, variant: 'destructive' });
      }
    } finally {
      setIsProcessing(null);
    }
  };

  const handleRejeitar = async () => {
    if (!rejectId || !rejectMotivo.trim()) return;
    setIsProcessing(rejectId);
    try {
      const result = await rejeitarCodigo(rejectId, rejectMotivo);
      if (result.success) {
        toast({ title: 'Sucesso', description: 'Solicitação rejeitada' });
        loadSolicitacoes();
      } else {
        toast({ title: 'Erro', description: result.error, variant: 'destructive' });
      }
    } finally {
      setIsProcessing(null);
      setShowRejectDialog(false);
      setRejectId(null);
      setRejectMotivo('');
    }
  };

  // Access control is handled by ProtectedRoute - if user reached here, they have permission

  return (
    <div className="flex h-screen flex-col bg-background overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border bg-card px-2 py-1.5 shrink-0">
        <button onClick={() => navigate('/')} className="rounded-lg p-1 hover:bg-accent">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <img src={logoImex} alt="IMEX" className="h-5" />
        <h1 className="text-sm font-bold flex-1">Aprovação de Códigos</h1>
        <Button variant="ghost" size="sm" onClick={loadSolicitacoes} disabled={isLoading} className="h-7 px-2">
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : solicitacoes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mb-2" /><p className="text-sm">Nenhum código aguardando aprovação</p>
          </div>
        ) : (
          solicitacoes.map((s) => (
            <div key={s.id} className="border border-border rounded-lg p-3 bg-card">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline">#{s.numero_solicitacao}</Badge>
                {editingId === s.id ? (
                  <div className="flex items-center gap-1 flex-1">
                    <Input
                      value={editedCodigo}
                      onChange={(e) => setEditedCodigo(e.target.value.toUpperCase().slice(0, 6))}
                      className={`h-7 w-24 text-sm font-mono ${editedCodigo.length !== 6 ? 'border-destructive' : ''}`}
                      maxLength={6}
                      placeholder="6 caracteres"
                    />
                    <span className={`text-xs ${editedCodigo.length !== 6 ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {editedCodigo.length}/6
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => handleSaveEdit(s.id)} disabled={isProcessing === s.id || editedCodigo.length !== 6} className="h-7 px-2">
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={handleCancelEdit} className="h-7 px-2">
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Badge className="bg-blue-100 text-blue-800 font-mono">{s.codigo_gerado}</Badge>
                    {isSuperAdmin && (
                      <Button size="sm" variant="ghost" onClick={() => handleStartEdit(s)} className="h-6 px-1.5">
                        <Edit2 className="h-3 w-3" />
                      </Button>
                    )}
                  </>
                )}
              </div>
              <p className="font-medium text-sm mb-1">{s.descricao}</p>
              <p className="text-xs text-muted-foreground">
                Criado por {s.processado_por} • {formatDistanceToNow(new Date(s.processado_em), { addSuffix: true, locale: ptBR })}
              </p>
              <div className="flex gap-2 mt-3">
                <Button size="sm" onClick={() => handleAprovar(s.id)} disabled={isProcessing === s.id} className="flex-1 h-8">
                  {isProcessing === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                  Aprovar
                </Button>
                <Button size="sm" variant="destructive" onClick={() => { setRejectId(s.id); setShowRejectDialog(true); }} disabled={isProcessing === s.id} className="h-8">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rejeitar Código</AlertDialogTitle>
            <AlertDialogDescription>Informe o motivo da rejeição:</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea value={rejectMotivo} onChange={(e) => setRejectMotivo(e.target.value)} placeholder="Motivo..." className="min-h-[80px]" />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRejeitar} disabled={!rejectMotivo.trim()}>Rejeitar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AprovacaoCodigos;
