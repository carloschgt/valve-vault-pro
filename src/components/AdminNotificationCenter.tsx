import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, UserPlus, KeyRound, FileCode, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface PendingAction {
  id: string;
  type: 'novo_usuario' | 'reset_senha' | 'aprovacao_codigo';
  title: string;
  description: string;
  route: string;
  data?: any;
  created_at: string;
}

const ACTION_CONFIG: Record<string, { icon: React.ComponentType<any>; color: string; bgColor: string }> = {
  novo_usuario: { icon: UserPlus, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  reset_senha: { icon: KeyRound, color: 'text-orange-600', bgColor: 'bg-orange-100' },
  aprovacao_codigo: { icon: FileCode, color: 'text-purple-600', bgColor: 'bg-purple-100' },
};

export function AdminNotificationCenter() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const isAdmin = user?.tipo === 'admin';

  // Carregar ações pendentes
  const loadPendingActions = async () => {
    if (!isAdmin) return;
    
    setIsLoading(true);
    try {
      const actions: PendingAction[] = [];

      // 1. Usuários pendentes de aprovação
      const { data: pendingUsers } = await supabase
        .from('usuarios')
        .select('id, nome, email, created_at')
        .eq('status', 'pendente')
        .order('created_at', { ascending: false });

      if (pendingUsers) {
        pendingUsers.forEach(u => {
          actions.push({
            id: `user_${u.id}`,
            type: 'novo_usuario',
            title: 'Novo usuário aguardando aprovação',
            description: `${u.nome} (${u.email})`,
            route: '/admin',
            data: u,
            created_at: u.created_at,
          });
        });
      }

      // 2. Solicitações de reset de senha
      const { data: resetRequests } = await supabase
        .from('notificacoes_usuario')
        .select('id, dados, created_at, mensagem, titulo')
        .eq('tipo', 'reset_senha')
        .eq('lida', false)
        .order('created_at', { ascending: false });

      console.log('Reset requests found:', resetRequests);

      if (resetRequests) {
        resetRequests.forEach((r: any) => {
          // Parse dados if it's a string
          let dados = r.dados;
          if (typeof dados === 'string') {
            try {
              dados = JSON.parse(dados);
            } catch (e) {
              dados = {};
            }
          }
          dados = dados || {};
          
          actions.push({
            id: `reset_${r.id}`,
            type: 'reset_senha',
            title: r.titulo || 'Solicitação de reset de senha',
            description: `${dados.user_nome || 'Usuário'} (${dados.user_email || ''})`,
            route: '/admin',
            data: { ...dados, notificacao_id: r.id },
            created_at: r.created_at,
          });
        });
      }

      // 3. Códigos pendentes de aprovação
      const { data: pendingCodes } = await supabase
        .from('solicitacoes_codigo')
        .select('id, descricao, codigo_gerado, created_at, solicitado_por')
        .eq('status', 'codigo_gerado')
        .order('created_at', { ascending: false });

      if (pendingCodes) {
        pendingCodes.forEach((c: any) => {
          actions.push({
            id: `code_${c.id}`,
            type: 'aprovacao_codigo',
            title: 'Código aguardando aprovação',
            description: `${c.codigo_gerado || 'Aguardando'} - ${c.descricao?.substring(0, 30)}...`,
            route: '/aprovacao-codigos',
            data: c,
            created_at: c.created_at,
          });
        });
      }

      // Ordenar por data
      actions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setPendingActions(actions);
    } catch (error) {
      console.error('Erro ao carregar ações pendentes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Carregar ao montar e configurar realtime
  useEffect(() => {
    if (!isAdmin) return;

    loadPendingActions();

    // Atualizar a cada 30 segundos
    const interval = setInterval(loadPendingActions, 30000);

    // Realtime para usuarios
    const userChannel = supabase
      .channel('admin-users-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'usuarios' },
        () => loadPendingActions()
      )
      .subscribe();

    // Realtime para notificações
    const notifChannel = supabase
      .channel('admin-notif-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notificacoes_usuario' },
        () => loadPendingActions()
      )
      .subscribe();

    // Realtime para solicitações
    const solChannel = supabase
      .channel('admin-sol-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'solicitacoes_codigo' },
        () => loadPendingActions()
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(userChannel);
      supabase.removeChannel(notifChannel);
      supabase.removeChannel(solChannel);
    };
  }, [isAdmin]);

  const handleActionClick = (action: PendingAction) => {
    setIsOpen(false);
    navigate(action.route);
  };

  if (!isAdmin) return null;

  const totalPending = pendingActions.length;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative"
          title="Ações Pendentes"
        >
          <Bell className="h-5 w-5" />
          {totalPending > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]"
            >
              {totalPending > 9 ? '9+' : totalPending}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between border-b border-border p-3 bg-muted/50">
          <h4 className="font-semibold text-sm">Ações Pendentes</h4>
          {totalPending > 0 && (
            <Badge variant="secondary" className="text-xs">
              {totalPending} pendente{totalPending > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        
        <ScrollArea className="max-h-[350px]">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Carregando...
            </div>
          ) : pendingActions.length === 0 ? (
            <div className="p-6 text-center">
              <Check className="h-10 w-10 text-green-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Nenhuma ação pendente
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {pendingActions.map((action) => {
                const config = ACTION_CONFIG[action.type] || ACTION_CONFIG.novo_usuario;
                const Icon = config.icon;
                
                return (
                  <button
                    key={action.id}
                    onClick={() => handleActionClick(action)}
                    className="w-full p-3 text-left hover:bg-muted/50 transition-colors flex items-start gap-3"
                  >
                    <div className={`p-2 rounded-full ${config.bgColor} shrink-0`}>
                      <Icon className={`h-4 w-4 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {action.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {action.description}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 self-center" />
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
