import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Search, Loader2, MapPin, Package, BookOpen, Users, ChevronDown, ChevronUp, Check, X, Clock, UserCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
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
import { deleteEndereco, deleteInventario, deleteCatalogo } from '@/hooks/useDataOperations';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import logoImex from '@/assets/logo-imex.png';
import { sanitizeSearchTerm } from '@/lib/security';

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  /**
   * UI-ONLY CHECK: This client-side admin check controls what UI elements are displayed.
   * 
   * SECURITY NOTE: This does NOT provide actual security. Even if an attacker
   * modifies localStorage to bypass this check, all admin operations will fail because:
   * 1. Edge Functions validate adminEmail against the database server-side
   * 2. RLS policies use is_admin_user() which queries the database directly
   */
  const isAdmin = user?.tipo === 'admin';
  
  const [searchEnderecos, setSearchEnderecos] = useState('');
  const [searchInventario, setSearchInventario] = useState('');
  const [searchCatalogo, setSearchCatalogo] = useState('');
  const [searchUsuarios, setSearchUsuarios] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Buscar endereços
  const { data: enderecos = [], isLoading: loadingEnderecos } = useQuery({
    queryKey: ['admin_enderecos', searchEnderecos],
    queryFn: async () => {
      let query = supabase
        .from('enderecos_materiais')
        .select('*, fabricantes(nome)')
        .order('created_at', { ascending: false });
      
      if (searchEnderecos) {
        const safeSearch = sanitizeSearchTerm(searchEnderecos);
        if (safeSearch) {
          query = query.or(`codigo.ilike.%${safeSearch}%,descricao.ilike.%${safeSearch}%`);
        }
      }
      
      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data;
    },
  });

  // Buscar inventário
  const { data: inventario = [], isLoading: loadingInventario } = useQuery({
    queryKey: ['admin_inventario', searchInventario],
    queryFn: async () => {
      let query = supabase
        .from('inventario')
        .select('*, enderecos_materiais(codigo, descricao, rua, coluna, nivel, posicao)')
        .order('created_at', { ascending: false });
      
      const { data, error } = await query.limit(100);
      if (error) throw error;
      
      if (searchInventario) {
        return data.filter((i: any) => 
          i.enderecos_materiais?.codigo?.toLowerCase().includes(searchInventario.toLowerCase()) ||
          i.enderecos_materiais?.descricao?.toLowerCase().includes(searchInventario.toLowerCase())
        );
      }
      return data;
    },
  });

  // Buscar catálogo
  const { data: catalogo = [], isLoading: loadingCatalogo } = useQuery({
    queryKey: ['admin_catalogo', searchCatalogo],
    queryFn: async () => {
      let query = supabase
        .from('catalogo_produtos')
        .select('*')
        .order('codigo');
      
      if (searchCatalogo) {
        const safeSearch = sanitizeSearchTerm(searchCatalogo);
        if (safeSearch) {
          query = query.or(`codigo.ilike.%${safeSearch}%,descricao.ilike.%${safeSearch}%`);
        }
      }
      
      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data;
    },
  });

  // Buscar usuários
  const { data: usuarios = [], isLoading: loadingUsuarios } = useQuery({
    queryKey: ['admin_usuarios', searchUsuarios],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'list', search: searchUsuarios, adminEmail: user?.email },
      });
      if (error) throw error;
      return data.users || [];
    },
  });

  // Buscar logs de login
  const { data: loginLogs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ['admin_login_logs'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'logs', adminEmail: user?.email },
      });
      if (error) throw error;
      return data.logs || [];
    },
  });

  // Deletar endereço
  const deleteEnderecoMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteEndereco(id);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_enderecos'] });
      queryClient.invalidateQueries({ queryKey: ['admin_inventario'] });
      toast({ title: 'Sucesso', description: 'Endereçamento excluído!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  // Deletar inventário
  const deleteInventarioMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteInventario(id);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_inventario'] });
      toast({ title: 'Sucesso', description: 'Contagem excluída!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  // Deletar catálogo
  const deleteCatalogoMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteCatalogo(id);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_catalogo'] });
      toast({ title: 'Sucesso', description: 'Produto excluído do catálogo!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });


  // Aprovar/Rejeitar usuário
  const updateUserApproval = useMutation({
    mutationFn: async ({ userId, aprovado }: { userId: string; aprovado: boolean }) => {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'approve', userId, aprovado, adminEmail: user?.email },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
    },
    onSuccess: (_, { aprovado }) => {
      queryClient.invalidateQueries({ queryKey: ['admin_usuarios'] });
      toast({ 
        title: 'Sucesso', 
        description: aprovado ? 'Usuário aprovado!' : 'Aprovação removida!' 
      });
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  // Deletar usuário
  const deleteUsuario = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'delete', userId, adminEmail: user?.email },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_usuarios'] });
      toast({ title: 'Sucesso', description: 'Usuário excluído!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <p className="text-lg text-muted-foreground">Acesso restrito a administradores</p>
        <Button onClick={() => navigate('/')} className="mt-4">Voltar</Button>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const pendingUsers = usuarios.filter((u: any) => !u.aprovado && u.tipo !== 'admin');

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-border bg-card p-4">
        <button onClick={() => navigate('/')} className="rounded-lg p-2 hover:bg-accent">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <img src={logoImex} alt="IMEX Solutions" className="h-8" />
        <h1 className="text-lg font-bold">Painel Administrativo</h1>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="usuarios" className="flex-1 p-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="usuarios" className="relative gap-1 text-xs sm:text-sm">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Usuários</span>
            {pendingUsers.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground">
                {pendingUsers.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-1 text-xs sm:text-sm">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Logins</span>
          </TabsTrigger>
          <TabsTrigger value="enderecos" className="gap-1 text-xs sm:text-sm">
            <MapPin className="h-4 w-4" />
            <span className="hidden sm:inline">Endereços</span>
          </TabsTrigger>
          <TabsTrigger value="inventario" className="gap-1 text-xs sm:text-sm">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Inventário</span>
          </TabsTrigger>
          <TabsTrigger value="catalogo" className="gap-1 text-xs sm:text-sm">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Catálogo</span>
          </TabsTrigger>
        </TabsList>

        {/* Usuários */}
        <TabsContent value="usuarios" className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou email..."
              value={searchUsuarios}
              onChange={(e) => setSearchUsuarios(e.target.value)}
              className="pl-10"
            />
          </div>

          {loadingUsuarios ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-2">
              {usuarios.map((u: any) => (
                <div key={u.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{u.nome}</span>
                      {u.tipo === 'admin' && (
                        <Badge variant="default" className="text-xs">Admin</Badge>
                      )}
                      {!u.aprovado && u.tipo !== 'admin' && (
                        <Badge variant="destructive" className="text-xs">Pendente</Badge>
                      )}
                      {u.aprovado && u.tipo !== 'admin' && (
                        <Badge variant="outline" className="text-xs text-green-600 border-green-600">Aprovado</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{u.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Cadastro: {formatDate(u.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {u.tipo !== 'admin' && (
                      <>
                        <Button
                          variant={u.aprovado ? "outline" : "default"}
                          size="sm"
                          onClick={() => updateUserApproval.mutate({ userId: u.id, aprovado: !u.aprovado })}
                          disabled={updateUserApproval.isPending}
                        >
                          {u.aprovado ? (
                            <X className="h-4 w-4" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não pode ser desfeita. Todos os dados associados serão perdidos.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteUsuario.mutate(u.id)}>
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Logs de Login */}
        <TabsContent value="logs" className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">Últimos 50 logins</h3>

          {loadingLogs ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-2">
              {loginLogs.map((log: any) => (
                <div key={log.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
                  <div className="flex-1">
                    <p className="font-medium">{log.user_nome}</p>
                    <p className="text-sm text-muted-foreground">{log.user_email}</p>
                    {log.device_info && (
                      <p className="text-xs text-muted-foreground">{log.device_info}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{formatDate(log.logged_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Endereços */}
        <TabsContent value="enderecos" className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por código ou descrição..."
              value={searchEnderecos}
              onChange={(e) => setSearchEnderecos(e.target.value)}
              className="pl-10"
            />
          </div>

          {loadingEnderecos ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-2">
              {enderecos.map((e: any) => (
                <div key={e.id} className="rounded-lg border border-border bg-card">
                  <div 
                    className="flex cursor-pointer items-center justify-between p-3"
                    onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-primary">{e.codigo}</span>
                        <Badge variant="outline" className="text-xs">{e.tipo_material}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">{e.descricao}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        R{e.rua}.C{e.coluna}.N{e.nivel}.P{e.posicao}
                      </span>
                      {expandedId === e.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>
                  
                  {expandedId === e.id && (
                    <div className="border-t border-border p-3 text-sm">
                      <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                        <p>Fabricante: {e.fabricantes?.nome || '-'}</p>
                        <p>Peso: {e.peso} kg</p>
                        <p><strong>Cadastrado por:</strong> {e.created_by}</p>
                        <p>Data: {formatDate(e.created_at)}</p>
                        {e.comentario && <p className="col-span-2">Obs: {e.comentario}</p>}
                      </div>
                      <div className="mt-3 flex justify-end">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir endereçamento?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Isso também excluirá as contagens de inventário relacionadas. Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteEnderecoMutation.mutate(e.id)}>
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Inventário */}
        <TabsContent value="inventario" className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por código ou descrição..."
              value={searchInventario}
              onChange={(e) => setSearchInventario(e.target.value)}
              className="pl-10"
            />
          </div>

          {loadingInventario ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-2">
              {inventario.map((i: any) => (
                <div key={i.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
                  <div className="flex-1">
                    <p className="font-medium text-primary">{i.enderecos_materiais?.codigo}</p>
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {i.enderecos_materiais?.descricao}
                    </p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>R{i.enderecos_materiais?.rua}.C{i.enderecos_materiais?.coluna}.N{i.enderecos_materiais?.nivel}.P{i.enderecos_materiais?.posicao}</span>
                      <span><strong>Por:</strong> {i.contado_por}</span>
                      <span>{formatDate(i.updated_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-xl font-bold text-green-600">{i.quantidade}</span>
                      <p className="text-xs text-muted-foreground">unidades</p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir contagem?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteInventarioMutation.mutate(i.id)}>
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Catálogo */}
        <TabsContent value="catalogo" className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por código ou descrição..."
                value={searchCatalogo}
                onChange={(e) => setSearchCatalogo(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={() => navigate('/catalogo')}>
              Importar/Adicionar
            </Button>
          </div>

          {loadingCatalogo ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-2">
              {catalogo.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
                  <div className="flex-1">
                    <p className="font-medium text-primary">{c.codigo}</p>
                    <p className="text-sm text-muted-foreground line-clamp-1">{c.descricao}</p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir do catálogo?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteCatalogoMutation.mutate(c.id)}>
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Admin;