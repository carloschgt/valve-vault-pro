import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings, Loader2, Save, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getInventarioConfig, updateInventarioConfig } from '@/hooks/useDataOperations';
import { Skeleton } from '@/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import logoImex from '@/assets/logo-imex.png';

const ControleInventario = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [contagemAtiva, setContagemAtiva] = useState<number>(1);
  const [lastUpdatedBy, setLastUpdatedBy] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const isAdmin = user?.tipo === 'admin';

  useEffect(() => {
    if (!authLoading && user) {
      setPermissionsLoaded(true);
      if (user.tipo === 'admin') {
        loadConfig();
      }
    }
  }, [authLoading, user]);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const result = await getInventarioConfig();
      if (result.success && result.data) {
        setContagemAtiva(result.data.contagem_ativa || 1);
        setLastUpdatedBy(result.data.updated_by);
        setLastUpdatedAt(result.data.updated_at);
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao carregar configuração',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSalvar = async () => {
    if (!isAdmin) return;
    
    setIsSaving(true);
    try {
      const result = await updateInventarioConfig(contagemAtiva);

      if (!result.success) {
        throw new Error(result.error);
      }

      setLastUpdatedBy(user?.nome || null);
      setLastUpdatedAt(new Date().toISOString());

      toast({
        title: 'Sucesso',
        description: `Contagem ${contagemAtiva} definida como ativa!`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao salvar configuração',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!permissionsLoaded || authLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <div className="flex items-center gap-4 border-b border-border bg-card p-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="flex-1 p-4 space-y-4">
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

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
        <button
          onClick={() => navigate('/')}
          className="rounded-lg p-2 hover:bg-accent"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <img src={logoImex} alt="IMEX Solutions" className="h-8" />
        <h1 className="text-lg font-bold">Controle de Inventário</h1>
      </div>

      {/* Content */}
      <div className="flex-1 p-4">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Active Counting Phase */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-4 flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Fase de Contagem Ativa</h2>
              </div>

              <div className="rounded-lg bg-primary/10 p-4 mb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-primary" />
                  <p className="text-sm">
                    Usuários só poderão lançar contagens na fase ativa selecionada abaixo.
                  </p>
                </div>
              </div>

              <RadioGroup
                value={contagemAtiva.toString()}
                onValueChange={(value) => setContagemAtiva(parseInt(value))}
                className="space-y-3"
              >
                <div className="flex items-center space-x-3 rounded-lg border border-border p-4 hover:bg-accent/50">
                  <RadioGroupItem value="1" id="contagem-1" />
                  <Label htmlFor="contagem-1" className="flex-1 cursor-pointer">
                    <span className="font-semibold">Contagem 1</span>
                    <p className="text-sm text-muted-foreground">
                      Primeira contagem do inventário
                    </p>
                  </Label>
                </div>

                <div className="flex items-center space-x-3 rounded-lg border border-border p-4 hover:bg-accent/50">
                  <RadioGroupItem value="2" id="contagem-2" />
                  <Label htmlFor="contagem-2" className="flex-1 cursor-pointer">
                    <span className="font-semibold">Contagem 2</span>
                    <p className="text-sm text-muted-foreground">
                      Segunda contagem para verificação
                    </p>
                  </Label>
                </div>

                <div className="flex items-center space-x-3 rounded-lg border border-border p-4 hover:bg-accent/50">
                  <RadioGroupItem value="3" id="contagem-3" />
                  <Label htmlFor="contagem-3" className="flex-1 cursor-pointer">
                    <span className="font-semibold">Contagem 3</span>
                    <p className="text-sm text-muted-foreground">
                      Recontagem para itens com divergência
                    </p>
                  </Label>
                </div>
              </RadioGroup>

              {lastUpdatedBy && lastUpdatedAt && (
                <div className="mt-4 text-xs text-muted-foreground">
                  Última alteração por {lastUpdatedBy} em{' '}
                  {new Date(lastUpdatedAt).toLocaleString('pt-BR')}
                </div>
              )}

              <Button
                onClick={handleSalvar}
                disabled={isSaving}
                className="mt-4 w-full"
              >
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Salvar Configuração
              </Button>
            </div>

            {/* Current Status */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="h-5 w-5 text-mrx-success" />
                <h2 className="text-lg font-semibold">Status Atual</h2>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map((num) => (
                  <div
                    key={num}
                    className={`rounded-lg border p-4 text-center ${
                      contagemAtiva === num
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-muted/30'
                    }`}
                  >
                    <p className="text-2xl font-bold">{num}</p>
                    <p className="text-xs text-muted-foreground">
                      {contagemAtiva === num ? 'ATIVA' : 'Inativa'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ControleInventario;
