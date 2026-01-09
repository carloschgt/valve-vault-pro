import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, User, Mail, Calendar, Shield, Clock, Loader2, Trash2, Check, Ban, XCircle, PlayCircle, KeyRound, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { USER_STATUS_LABELS, USER_STATUS_COLORS, USER_ROLE_LABELS } from '@/types/user';
import type { UserStatus, UserRole, Usuario } from '@/types/user';
import logoImex from '@/assets/logo-imex.png';

const AdminUserDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const [selectedRole, setSelectedRole] = useState<UserRole>('user');
  const [selectedStatus, setSelectedStatus] = useState<UserStatus>('pendente');
  const [suspendedUntil, setSuspendedUntil] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [pendingPasswordReset, setPendingPasswordReset] = useState<any>(null);

  // Buscar dados do usuário
  const { data: userData, isLoading } = useQuery({
    queryKey: ['admin_user_detail', id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'getUser', userId: id, adminEmail: currentUser?.email },
      });
      if (error) throw error;
      // Store pending password reset info
      if (data.pendingPasswordReset) {
        setPendingPasswordReset(data.pendingPasswordReset);
      } else {
        setPendingPasswordReset(null);
      }
      return data.user as Usuario | null;
    },
  });

  // Atualizar estado quando userData mudar
  useEffect(() => {
    if (userData) {
      setSelectedRole(userData.tipo);
      setSelectedStatus(userData.status);
      setSuspendedUntil(userData.suspenso_ate ? userData.suspenso_ate.split('T')[0] : '');
    }
  }, [userData]);

  // Buscar logs do usuário
  const { data: userLogs = [] } = useQuery({
    queryKey: ['admin_user_logs', id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'userLogs', userId: id, adminEmail: currentUser?.email },
      });
      if (error) throw error;
      return data.logs || [];
    },
  });

  // Mutation para atualizar usuário
  const updateUserMutation = useMutation({
    mutationFn: async (params: { tipo?: UserRole; status?: UserStatus; suspendedUntil?: string | null }) => {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: {
          action: 'updateUser',
          userId: id,
          adminEmail: currentUser?.email,
          ...params,
        },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_user_detail', id] });
      queryClient.invalidateQueries({ queryKey: ['admin_usuarios'] });
      toast({ title: 'Sucesso', description: 'Usuário atualizado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  // Mutation para deletar usuário
  const deleteUserMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'delete', userId: id, adminEmail: currentUser?.email },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_usuarios'] });
      toast({ title: 'Sucesso', description: 'Usuário excluído!' });
      navigate('/admin');
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const handleAprovar = () => {
    updateUserMutation.mutate({ status: 'ativo' });
    setSelectedStatus('ativo');
  };

  const handleSuspender = () => {
    updateUserMutation.mutate({
      status: 'suspenso',
      suspendedUntil: suspendedUntil || null,
    });
    setSelectedStatus('suspenso');
  };

  const handleAtivar = () => {
    updateUserMutation.mutate({ status: 'ativo', suspendedUntil: null });
    setSelectedStatus('ativo');
    setSuspendedUntil('');
  };

  const handleNegar = () => {
    updateUserMutation.mutate({ status: 'negado' });
    setSelectedStatus('negado');
  };

  const handleRoleChange = (role: UserRole) => {
    setSelectedRole(role);
    updateUserMutation.mutate({ tipo: role });
  };

  // Aprovar redefinição de senha
  const approvePasswordResetMutation = useMutation({
    mutationFn: async () => {
      if (!pendingPasswordReset) throw new Error('Nenhuma solicitação de senha pendente');
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { 
          action: 'approvePasswordReset', 
          userId: pendingPasswordReset.id,
          adminEmail: currentUser?.email 
        },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_user_detail', id] });
      queryClient.invalidateQueries({ queryKey: ['admin_usuarios'] });
      setPendingPasswordReset(null);
      toast({ title: 'Sucesso', description: 'Redefinição de senha aprovada! Usuário liberado.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <p className="text-lg text-muted-foreground">Usuário não encontrado</p>
        <Button onClick={() => navigate('/admin')} className="mt-4">Voltar</Button>
      </div>
    );
  }

  const isCurrentUser = userData.email === currentUser?.email;
  const statusColor = USER_STATUS_COLORS[userData.status] || 'bg-gray-100 text-gray-800';

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-border bg-card p-4">
        <button onClick={() => navigate('/admin')} className="rounded-lg p-2 hover:bg-accent">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <img src={logoImex} alt="IMEX Solutions" className="h-8" />
        <h1 className="text-lg font-bold">Detalhes do Usuário</h1>
      </div>

      <div className="flex-1 space-y-4 p-4">
        {/* Informações do Usuário */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {userData.nome}
              </CardTitle>
              <Badge className={statusColor}>
                {USER_STATUS_LABELS[userData.status] || userData.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span>{userData.email}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Cadastrado em: {formatDate(userData.created_at)}</span>
            </div>
            {userData.suspenso_ate && (
              <div className="flex items-center gap-2 text-orange-600">
                <Clock className="h-4 w-4" />
                <span>Suspenso até: {new Date(userData.suspenso_ate).toLocaleDateString('pt-BR')}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alerta de Reset de Senha Pendente */}
        {pendingPasswordReset && !isCurrentUser && (
          <Card className="border-orange-300 bg-orange-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-700">
                <AlertTriangle className="h-5 w-5" />
                Redefinição de Senha Pendente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-orange-800">
                Este usuário solicitou redefinição de senha e está aguardando aprovação do administrador.
              </p>
              <p className="text-xs text-orange-600">
                Solicitado em: {new Date(pendingPasswordReset.created_at).toLocaleString('pt-BR')}
              </p>
              <div className="flex gap-2">
                <Button 
                  onClick={() => approvePasswordResetMutation.mutate()} 
                  className="gap-2 bg-green-600 hover:bg-green-700"
                  disabled={approvePasswordResetMutation.isPending}
                >
                  <Check className="h-4 w-4" />
                  Aprovar Redefinição
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ações */}
        {!isCurrentUser && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Gerenciar Acesso
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Perfil */}
              <div className="space-y-2">
                <Label>Perfil</Label>
              <Select value={selectedRole} onValueChange={(v) => handleRoleChange(v as UserRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">{USER_ROLE_LABELS.admin}</SelectItem>
                    <SelectItem value="user">{USER_ROLE_LABELS.user}</SelectItem>
                    <SelectItem value="estoque">{USER_ROLE_LABELS.estoque}</SelectItem>
                    <SelectItem value="comercial">{USER_ROLE_LABELS.comercial}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Data de suspensão */}
              {selectedStatus === 'suspenso' && (
                <div className="space-y-2">
                  <Label>Suspenso até (opcional)</Label>
                  <Input
                    type="date"
                    value={suspendedUntil}
                    onChange={(e) => setSuspendedUntil(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              )}

              {/* Botões de Ação */}
              <div className="grid grid-cols-2 gap-2 pt-4">
                {userData.status !== 'ativo' && (
                  <Button onClick={handleAprovar} className="gap-2" disabled={updateUserMutation.isPending}>
                    <Check className="h-4 w-4" />
                    Aprovar
                  </Button>
                )}

                {userData.status !== 'suspenso' && (
                  <Button
                    variant="outline"
                    onClick={handleSuspender}
                    className="gap-2 text-orange-600 border-orange-300 hover:bg-orange-50"
                    disabled={updateUserMutation.isPending}
                  >
                    <Ban className="h-4 w-4" />
                    Suspender
                  </Button>
                )}

                {userData.status === 'suspenso' && (
                  <Button onClick={handleAtivar} className="gap-2" disabled={updateUserMutation.isPending}>
                    <PlayCircle className="h-4 w-4" />
                    Ativar
                  </Button>
                )}

                {userData.status !== 'negado' && (
                  <Button
                    variant="outline"
                    onClick={handleNegar}
                    className="gap-2 text-red-600 border-red-300 hover:bg-red-50"
                    disabled={updateUserMutation.isPending}
                  >
                    <XCircle className="h-4 w-4" />
                    Negar
                  </Button>
                )}
              </div>

              {/* Excluir */}
              <div className="border-t pt-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full gap-2">
                      <Trash2 className="h-4 w-4" />
                      Excluir Usuário
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir usuário permanentemente?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação não pode ser desfeita. Todos os dados do usuário serão perdidos.
                        <br /><br />
                        Digite <strong>EXCLUIR</strong> para confirmar:
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <Input
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
                      placeholder="Digite EXCLUIR"
                    />
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setDeleteConfirmText('')}>
                        Cancelar
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteUserMutation.mutate()}
                        disabled={deleteConfirmText !== 'EXCLUIR' || deleteUserMutation.isPending}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        {deleteUserMutation.isPending ? 'Excluindo...' : 'Excluir'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Logs de Acesso */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Últimos 10 Acessos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {userLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum acesso registrado</p>
            ) : (
              <div className="space-y-2">
                {userLogs.map((log: { id: string; logged_at: string; device_info: string | null }) => (
                  <div key={log.id} className="flex items-center justify-between rounded-lg border border-border p-2 text-sm">
                    <span>{formatDate(log.logged_at)}</span>
                    <span className="text-muted-foreground text-xs truncate max-w-[150px]">
                      {log.device_info || 'N/A'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminUserDetail;
