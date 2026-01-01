import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Search, Loader2, MapPin, Package, BookOpen, Users, ChevronDown, ChevronUp, Check, X, Clock, UserCheck, Edit, Ban, CheckCircle, Shield, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { InputUppercase } from '@/components/ui/input-uppercase';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { 
  deleteEndereco, 
  deleteInventario, 
  deleteCatalogo, 
  updateEndereco, 
  toggleEnderecoAtivo,
  toggleCatalogoAtivo,
  updateCatalogo,
  listFabricantes,
} from '@/hooks/useDataOperations';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import logoImex from '@/assets/logo-imex.png';
import { sanitizeSearchTerm } from '@/lib/security';

const TIPOS_MATERIAL = [
  'Válvula',
  'Atuador',
  'Flange',
  'Conexão',
  'Tubo',
  'Instrumento',
  'Elétrico',
  'Mecânico',
  'Outro',
];

interface EditEnderecoData {
  id: string;
  codigo: string;
  descricao: string;
  tipo_material: string;
  fabricante_id: string;
  peso: string;
  rua: string;
  coluna: string;
  nivel: string;
  posicao: string;
  comentario: string;
}

interface EditCatalogoData {
  id: string;
  codigo: string;
  descricao: string;
}

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const isAdmin = user?.tipo === 'admin';
  
  const [searchEnderecos, setSearchEnderecos] = useState('');
  const [searchInventario, setSearchInventario] = useState('');
  const [searchCatalogo, setSearchCatalogo] = useState('');
  const [searchUsuarios, setSearchUsuarios] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Edit modals
  const [editEndereco, setEditEndereco] = useState<EditEnderecoData | null>(null);
  const [editCatalogo, setEditCatalogo] = useState<EditCatalogoData | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Buscar fabricantes
  const { data: fabricantes = [] } = useQuery({
    queryKey: ['fabricantes'],
    queryFn: async () => {
      const result = await listFabricantes();
      return result.data || [];
    },
  });

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
        .select('*, enderecos_materiais(codigo, descricao, rua, coluna, nivel, posicao, ativo, inativado_por)')
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

  // Toggle endereço ativo
  const toggleEnderecoAtivoMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const result = await toggleEnderecoAtivo(id, ativo);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result;
    },
    onSuccess: (_, { ativo }) => {
      queryClient.invalidateQueries({ queryKey: ['admin_enderecos'] });
      toast({ 
        title: 'Sucesso', 
        description: ativo ? 'Endereçamento reativado!' : 'Endereçamento inativado!' 
      });
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

  // Toggle catálogo ativo
  const toggleCatalogoAtivoMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const result = await toggleCatalogoAtivo(id, ativo);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result;
    },
    onSuccess: (_, { ativo }) => {
      queryClient.invalidateQueries({ queryKey: ['admin_catalogo'] });
      toast({ 
        title: 'Sucesso', 
        description: ativo ? 'Produto reativado!' : 'Produto inativado!' 
      });
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

  // Alterar tipo de usuário
  const updateUserRole = useMutation({
    mutationFn: async ({ userId, tipo }: { userId: string; tipo: string }) => {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'updateRole', userId, tipo, adminEmail: user?.email },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
    },
    onSuccess: (_, { tipo }) => {
      queryClient.invalidateQueries({ queryKey: ['admin_usuarios'] });
      toast({ 
        title: 'Sucesso', 
        description: `Usuário alterado para ${tipo === 'admin' ? 'Administrador' : 'Usuário comum'}!` 
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

  // Salvar edição de endereço
  const handleSaveEndereco = async () => {
    if (!editEndereco) return;
    
    setIsSaving(true);
    try {
      const result = await updateEndereco(editEndereco.id, {
        codigo: editEndereco.codigo,
        descricao: editEndereco.descricao,
        tipo_material: editEndereco.tipo_material,
        fabricante_id: editEndereco.fabricante_id,
        peso: editEndereco.peso,
        rua: editEndereco.rua,
        coluna: editEndereco.coluna,
        nivel: editEndereco.nivel,
        posicao: editEndereco.posicao,
        comentario: editEndereco.comentario,
      });
      
      if (!result.success) throw new Error(result.error);
      
      queryClient.invalidateQueries({ queryKey: ['admin_enderecos'] });
      toast({ title: 'Sucesso', description: 'Endereçamento atualizado!' });
      setEditEndereco(null);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Salvar edição de catálogo
  const handleSaveCatalogo = async () => {
    if (!editCatalogo) return;
    
    setIsSaving(true);
    try {
      const result = await updateCatalogo(editCatalogo.id, editCatalogo.codigo, editCatalogo.descricao);
      
      if (!result.success) throw new Error(result.error);
      
      queryClient.invalidateQueries({ queryKey: ['admin_catalogo'] });
      toast({ title: 'Sucesso', description: 'Produto atualizado!' });
      setEditCatalogo(null);
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

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
                <div key={u.id} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
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
                      {/* Seletor de tipo de usuário */}
                      {u.email !== user?.email && (
                        <Select
                          value={u.tipo}
                          onValueChange={(value) => updateUserRole.mutate({ userId: u.id, tipo: value })}
                          disabled={updateUserRole.isPending}
                        >
                          <SelectTrigger className="w-[130px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4" />
                                Usuário
                              </div>
                            </SelectItem>
                            <SelectItem value="admin">
                              <div className="flex items-center gap-2">
                                <Shield className="h-4 w-4" />
                                Admin
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      {u.tipo !== 'admin' && (
                        <>
                          <Button
                            variant={u.aprovado ? "outline" : "default"}
                            size="sm"
                            onClick={() => updateUserApproval.mutate({ userId: u.id, aprovado: !u.aprovado })}
                            disabled={updateUserApproval.isPending}
                            title={u.aprovado ? "Remover aprovação" : "Aprovar usuário"}
                          >
                            {u.aprovado ? (
                              <X className="h-4 w-4" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </Button>
                        </>
                      )}
                      {u.email !== user?.email && (
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
                      )}
                    </div>
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
                <div key={e.id} className={`rounded-lg border bg-card ${!e.ativo ? 'border-destructive/50 bg-destructive/5' : 'border-border'}`}>
                  <div className="flex items-center justify-between p-3">
                    <div 
                      className="flex-1 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${!e.ativo ? 'text-muted-foreground line-through' : 'text-primary'}`}>
                          {e.codigo}
                        </span>
                        <Badge variant="outline" className="text-xs">{e.tipo_material}</Badge>
                        {!e.ativo && (
                          <Badge variant="destructive" className="text-xs">INATIVO</Badge>
                        )}
                      </div>
                      <p className={`text-sm line-clamp-1 ${!e.ativo ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                        {e.descricao}
                      </p>
                      {!e.ativo && e.inativado_por && (
                        <p className="text-xs text-destructive">
                          Inativado por: {e.inativado_por}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="mr-2 text-xs text-muted-foreground">
                        R{e.rua}.C{e.coluna}.N{e.nivel}.P{e.posicao}
                      </span>
                      
                      {/* Botão Editar */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditEndereco({
                          id: e.id,
                          codigo: e.codigo,
                          descricao: e.descricao,
                          tipo_material: e.tipo_material,
                          fabricante_id: e.fabricante_id || '',
                          peso: String(e.peso),
                          rua: String(e.rua),
                          coluna: String(e.coluna),
                          nivel: String(e.nivel),
                          posicao: String(e.posicao),
                          comentario: e.comentario || '',
                        })}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      
                      {/* Botão Inativar/Ativar */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleEnderecoAtivoMutation.mutate({ id: e.id, ativo: !e.ativo })}
                        disabled={toggleEnderecoAtivoMutation.isPending}
                        title={e.ativo ? 'Inativar' : 'Ativar'}
                      >
                        {e.ativo ? (
                          <Ban className="h-4 w-4 text-orange-500" />
                        ) : (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                      </Button>
                      
                      {/* Botão Excluir */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4 text-destructive" />
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
                      
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}
                      >
                        {expandedId === e.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
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
                <div key={i.id} className={`flex items-center justify-between rounded-lg border bg-card p-3 ${!i.enderecos_materiais?.ativo ? 'border-destructive/50 bg-destructive/5' : 'border-border'}`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`font-medium ${!i.enderecos_materiais?.ativo ? 'text-muted-foreground line-through' : 'text-primary'}`}>
                        {i.enderecos_materiais?.codigo}
                      </p>
                      {!i.enderecos_materiais?.ativo && (
                        <Badge variant="destructive" className="text-xs">INATIVO</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {i.enderecos_materiais?.descricao}
                    </p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>R{i.enderecos_materiais?.rua}.C{i.enderecos_materiais?.coluna}.N{i.enderecos_materiais?.nivel}.P{i.enderecos_materiais?.posicao}</span>
                      <span><strong>Por:</strong> {i.contado_por}</span>
                      <span>{formatDate(i.updated_at)}</span>
                    </div>
                    {!i.enderecos_materiais?.ativo && i.enderecos_materiais?.inativado_por && (
                      <p className="text-xs text-destructive">
                        Inativado por: {i.enderecos_materiais.inativado_por}
                      </p>
                    )}
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
                <div key={c.id} className={`flex items-center justify-between rounded-lg border bg-card p-3 ${!c.ativo ? 'border-destructive/50 bg-destructive/5' : 'border-border'}`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`font-medium ${!c.ativo ? 'text-muted-foreground line-through' : 'text-primary'}`}>
                        {c.codigo}
                      </p>
                      {!c.ativo && (
                        <Badge variant="destructive" className="text-xs">INATIVO</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">{c.descricao}</p>
                    {!c.ativo && c.inativado_por && (
                      <p className="text-xs text-destructive">
                        Inativado por: {c.inativado_por}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditCatalogo({
                        id: c.id,
                        codigo: c.codigo,
                        descricao: c.descricao,
                      })}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleCatalogoAtivoMutation.mutate({ id: c.id, ativo: !c.ativo })}
                      disabled={toggleCatalogoAtivoMutation.isPending}
                    >
                      {c.ativo ? (
                        <Ban className="h-4 w-4 text-orange-500" />
                      ) : (
                        <CheckCircle className="h-4 w-4 text-green-500" />
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
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog Editar Endereço */}
      <Dialog open={!!editEndereco} onOpenChange={() => setEditEndereco(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Endereçamento</DialogTitle>
          </DialogHeader>
          
          {editEndereco && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Código</Label>
                <InputUppercase
                  value={editEndereco.codigo}
                  onChange={(e) => setEditEndereco({ ...editEndereco, codigo: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Descrição</Label>
                <InputUppercase
                  value={editEndereco.descricao}
                  onChange={(e) => setEditEndereco({ ...editEndereco, descricao: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Tipo de Material</Label>
                <Select 
                  value={editEndereco.tipo_material} 
                  onValueChange={(v) => setEditEndereco({ ...editEndereco, tipo_material: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_MATERIAL.map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Fabricante</Label>
                <Select 
                  value={editEndereco.fabricante_id} 
                  onValueChange={(v) => setEditEndereco({ ...editEndereco, fabricante_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fabricantes.map((fab: any) => (
                      <SelectItem key={fab.id} value={fab.id}>{fab.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Peso (kg)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editEndereco.peso}
                  onChange={(e) => setEditEndereco({ ...editEndereco, peso: e.target.value })}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Rua</Label>
                  <Input
                    type="number"
                    value={editEndereco.rua}
                    onChange={(e) => setEditEndereco({ ...editEndereco, rua: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Coluna</Label>
                  <Input
                    type="number"
                    value={editEndereco.coluna}
                    onChange={(e) => setEditEndereco({ ...editEndereco, coluna: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nível</Label>
                  <Input
                    type="number"
                    value={editEndereco.nivel}
                    onChange={(e) => setEditEndereco({ ...editEndereco, nivel: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Posição</Label>
                  <Input
                    type="number"
                    value={editEndereco.posicao}
                    onChange={(e) => setEditEndereco({ ...editEndereco, posicao: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Comentário</Label>
                <InputUppercase
                  value={editEndereco.comentario}
                  onChange={(e) => setEditEndereco({ ...editEndereco, comentario: e.target.value })}
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEndereco(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEndereco} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Editar Catálogo */}
      <Dialog open={!!editCatalogo} onOpenChange={() => setEditCatalogo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Produto</DialogTitle>
          </DialogHeader>
          
          {editCatalogo && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Código</Label>
                <InputUppercase
                  value={editCatalogo.codigo}
                  onChange={(e) => setEditCatalogo({ ...editCatalogo, codigo: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Descrição</Label>
                <InputUppercase
                  value={editCatalogo.descricao}
                  onChange={(e) => setEditCatalogo({ ...editCatalogo, descricao: e.target.value })}
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCatalogo(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveCatalogo} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
