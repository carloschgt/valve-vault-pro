import { useState, useEffect } from 'react';
import { Bell, Check, CheckCheck, X } from 'lucide-react';
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
import { 
  listarNotificacoes, 
  marcarNotificacaoLida, 
  marcarTodasNotificacoesLidas,
  contarNotificacoesNaoLidas
} from '@/hooks/useSolicitacoesCodigo';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Notificacao {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  dados: any;
  created_at: string;
}

const NOTIFICATION_COLORS: Record<string, string> = {
  codigo_gerado: 'bg-blue-100 text-blue-800 border-blue-300',
  codigo_aprovado: 'bg-green-100 text-green-800 border-green-300',
  codigo_rejeitado: 'bg-red-100 text-red-800 border-red-300',
  default: 'bg-gray-100 text-gray-800 border-gray-300',
};

export function NotificationCenter() {
  const { user } = useAuth();
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Carregar notificações
  const loadNotificacoes = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const result = await listarNotificacoes();
      if (result.success) {
        setNotificacoes(result.data || []);
        setNaoLidas(result.data?.filter((n: Notificacao) => !n.lida).length || 0);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Atualizar contador de não lidas
  const updateNaoLidas = async () => {
    if (!user) return;
    const result = await contarNotificacoesNaoLidas();
    if (result.success) {
      setNaoLidas(result.count || 0);
    }
  };

  // Carregar ao abrir e configurar realtime
  useEffect(() => {
    if (!user) return;

    loadNotificacoes();

    // Configurar realtime para notificações
    const channel = supabase
      .channel('notificacoes-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificacoes_usuario',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          loadNotificacoes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Marcar como lida
  const handleMarcarLida = async (id: string) => {
    await marcarNotificacaoLida(id);
    setNotificacoes(prev => 
      prev.map(n => n.id === id ? { ...n, lida: true } : n)
    );
    setNaoLidas(prev => Math.max(0, prev - 1));
  };

  // Marcar todas como lidas
  const handleMarcarTodasLidas = async () => {
    await marcarTodasNotificacoesLidas();
    setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })));
    setNaoLidas(0);
  };

  if (!user) return null;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative h-8 w-8 p-0">
          <Bell className="h-4 w-4" />
          {naoLidas > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
            >
              {naoLidas > 9 ? '9+' : naoLidas}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between border-b border-border p-3">
          <h4 className="font-semibold text-sm">Notificações</h4>
          {naoLidas > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 text-xs"
              onClick={handleMarcarTodasLidas}
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Marcar todas
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Carregando...
            </div>
          ) : notificacoes.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Nenhuma notificação
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notificacoes.map((n) => (
                <div 
                  key={n.id} 
                  className={`p-3 ${!n.lida ? 'bg-muted/50' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-1.5 py-0.5 text-[10px] rounded border ${NOTIFICATION_COLORS[n.tipo] || NOTIFICATION_COLORS.default}`}>
                          {n.titulo}
                        </span>
                        {!n.lida && (
                          <span className="h-2 w-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <p className="text-sm text-foreground">{n.mensagem}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { 
                          addSuffix: true, 
                          locale: ptBR 
                        })}
                      </p>
                    </div>
                    {!n.lida && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => handleMarcarLida(n.id)}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
