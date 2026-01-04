import { useNavigate } from 'react-router-dom';
import { Clock, Ban, XCircle, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import type { UserStatus } from '@/types/user';
import logoImex from '@/assets/logo-imex.png';

interface AccessBlockedScreenProps {
  status: UserStatus;
  suspendedUntil?: string | null;
}

const AccessBlockedScreen = ({ status, suspendedUntil }: AccessBlockedScreenProps) => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getStatusInfo = () => {
    switch (status) {
      case 'pendente':
        return {
          icon: Clock,
          title: 'Acesso Pendente',
          description: 'Seu cadastro está aguardando aprovação do administrador.',
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-100',
        };
      case 'suspenso':
        const suspendedDate = suspendedUntil ? new Date(suspendedUntil) : null;
        const formattedDate = suspendedDate
          ? suspendedDate.toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })
          : null;
        return {
          icon: Ban,
          title: 'Acesso Suspenso',
          description: formattedDate
            ? `Seu acesso está suspenso até ${formattedDate}.`
            : 'Seu acesso está temporariamente suspenso.',
          color: 'text-orange-600',
          bgColor: 'bg-orange-100',
        };
      case 'negado':
        return {
          icon: XCircle,
          title: 'Acesso Negado',
          description: 'Seu cadastro foi negado pelo administrador.',
          color: 'text-red-600',
          bgColor: 'bg-red-100',
        };
      default:
        return {
          icon: HelpCircle,
          title: 'Status Desconhecido',
          description: 'Entre em contato com o administrador.',
          color: 'text-muted-foreground',
          bgColor: 'bg-muted',
        };
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/20 p-4">
      <Card className="w-full max-w-md shadow-2xl border-border/50">
        <CardContent className="flex flex-col items-center p-8 text-center">
          <img src={logoImex} alt="IMEX Solutions" className="mb-6 h-16" />
          
          <div className={`mb-4 rounded-full p-4 ${statusInfo.bgColor}`}>
            <StatusIcon className={`h-12 w-12 ${statusInfo.color}`} />
          </div>
          
          <h1 className="mb-2 text-2xl font-bold text-foreground">
            {statusInfo.title}
          </h1>
          
          <p className="mb-6 text-muted-foreground">
            {statusInfo.description}
          </p>
          
          {status === 'pendente' && (
            <p className="mb-6 text-sm text-muted-foreground">
              Você será notificado quando seu acesso for liberado.
            </p>
          )}
          
          <Button onClick={handleLogout} variant="outline" className="w-full">
            Sair
          </Button>
        </CardContent>
      </Card>
      
      <p className="mt-8 text-xs text-muted-foreground">
        Desenvolvido por Carlos Teixeira
      </p>
    </div>
  );
};

export default AccessBlockedScreen;
