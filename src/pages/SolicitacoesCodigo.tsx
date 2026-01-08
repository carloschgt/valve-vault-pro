import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Lock, Unlock, Save, RefreshCw, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { 
  listarPendentes, 
  bloquearSolicitacao, 
  desbloquearSolicitacao, 
  salvarCodigo 
} from '@/hooks/useSolicitacoesCodigo';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import logoImex from '@/assets/logo-imex.png';

interface Solicitacao {
  id: string;
  numero_solicitacao: number;
  descricao: string;
  fabricante_id: string | null;
  fabricantes: { nome: string } | null;
  solicitado_por: string;
  solicitado_por_id: string;
  status: string;
  locked_by_id: string | null;
  locked_at: string | null;
  created_at: string;
}

const SolicitacoesCodigo = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [codigoInput, setCodigoInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  // Verificar permissão
  const canAccess = user?.tipo === 'admin' || user?.tipo === 'comercial';

  // Carregar solicitações
  const loadSolicitacoes = useCallback(async () => {
    if (!canAccess) return;
    
    setIsLoading(true);
    try {
      const result = await listarPendentes();
      if (result.success) {
        setSolicitacoes(result.data || []);
      } else {
        toast({
          title: 'Erro',
          description: result.error || 'Erro ao carregar solicitações',
          variant: 'destructive',
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [canAccess, toast]);

  // Carregar ao montar e configurar realtime
  useEffect(() => {
    if (!canAccess) return;

    loadSolicitacoes();

    // Configurar realtime
    const channel = supabase
      .channel('solicitacoes-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'solicitacoes_codigo'
        },
        () => {
          loadSolicitacoes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [canAccess, loadSolicitacoes]);

  // Bloquear solicitação
  const handleBloquear = async (id: string) => {
    setIsProcessing(id);
    try {
      const result = await bloquearSolicitacao(id);
      if (result.success) {
        setSelectedId(id);
        setCodigoInput('');
        toast({
          title: 'Solicitação bloqueada',
          description: 'Você está processando esta solicitação',
        });
        loadSolicitacoes();
      } else {
        toast({
          title: 'Erro',
          description: result.error || 'Erro ao bloquear solicitação',
          variant: 'destructive',
        });
      }
    } finally {
      setIsProcessing(null);
    }
  };

  // Desbloquear solicitação
  const handleDesbloquear = async (id: string) => {
    setIsProcessing(id);
    try {
      const result = await desbloquearSolicitacao(id);
      if (result.success) {
        setSelectedId(null);
        setCodigoInput('');
        toast({
          title: 'Solicitação liberada',
          description: 'A solicitação está disponível para outros usuários',
        });
        loadSolicitacoes();
      } else {
        toast({
          title: 'Erro',
          description: result.error || 'Erro ao desbloquear solicitação',
          variant: 'destructive',
        });
      }
    } finally {
      setIsProcessing(null);
    }
  };

  // Salvar código
  const handleSalvarCodigo = async () => {
    if (!selectedId || !codigoInput.trim()) {
      toast({
        title: 'Atenção',
        description: 'Digite o código antes de salvar',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const result = await salvarCodigo(selectedId, codigoInput.trim());
      if (result.success) {
        toast({
          title: 'Sucesso',
          description: 'Código salvo e enviado para aprovação!',
        });
        setSelectedId(null);
        setCodigoInput('');
        loadSolicitacoes();
      } else {
        toast({
          title: 'Erro',
          description: result.error || 'Erro ao salvar código',
          variant: 'destructive',
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Verificar se está bloqueado por mim
  const isLockedByMe = (s: Solicitacao) => s.locked_by_id === user?.id;

  // Verificar se está bloqueado por outro
  const isLockedByOther = (s: Solicitacao) => s.locked_by_id && s.locked_by_id !== user?.id;

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
        <h1 className="text-sm font-bold flex-1">Solicitações de Código</h1>
        <Button
          variant="ghost"
          size="sm"
          onClick={loadSolicitacoes}
          disabled={isLoading}
          className="h-7 px-2"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : solicitacoes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mb-2" />
            <p className="text-sm">Nenhuma solicitação pendente</p>
          </div>
        ) : (
          solicitacoes.map((s) => (
            <div
              key={s.id}
              className={`border rounded-lg p-3 ${
                isLockedByMe(s) 
                  ? 'border-primary bg-primary/5' 
                  : isLockedByOther(s) 
                    ? 'border-orange-300 bg-orange-50' 
                    : 'border-border bg-card'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">
                      #{s.numero_solicitacao}
                    </Badge>
                    {isLockedByOther(s) && (
                      <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800">
                        <Lock className="h-3 w-3 mr-1" />
                        Em processamento
                      </Badge>
                    )}
                    {isLockedByMe(s) && (
                      <Badge variant="default" className="text-xs">
                        <Lock className="h-3 w-3 mr-1" />
                        Você está processando
                      </Badge>
                    )}
                  </div>
                  <p className="font-medium text-sm">{s.descricao}</p>
                  {s.fabricantes && (
                    <p className="text-xs text-muted-foreground">
                      Fabricante: {s.fabricantes.nome}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Solicitado por {s.solicitado_por} • {formatDistanceToNow(new Date(s.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
              </div>

              {/* Ações */}
              {!isLockedByOther(s) && (
                <div className="flex items-center gap-2">
                  {isLockedByMe(s) ? (
                    <>
                      <Input
                        placeholder="Digite o código"
                        value={codigoInput}
                        onChange={(e) => setCodigoInput(e.target.value.toUpperCase())}
                        className="h-8 text-sm flex-1"
                        disabled={isSaving}
                      />
                      <Button
                        size="sm"
                        onClick={handleSalvarCodigo}
                        disabled={isSaving || !codigoInput.trim()}
                        className="h-8"
                      >
                        {isSaving ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDesbloquear(s.id)}
                        disabled={isProcessing === s.id}
                        className="h-8"
                      >
                        {isProcessing === s.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Unlock className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleBloquear(s.id)}
                      disabled={isProcessing === s.id}
                      className="h-8"
                    >
                      {isProcessing === s.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      ) : (
                        <Lock className="h-3.5 w-3.5 mr-1" />
                      )}
                      Processar
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SolicitacoesCodigo;
