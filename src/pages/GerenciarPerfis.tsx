import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Plus, Edit, Trash2, Save, X, Loader2, Check, AlertTriangle, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import logoImex from '@/assets/logo-imex.png';

// Definição dos menus disponíveis
const AVAILABLE_MENUS = [
  { key: 'home', label: 'Página Inicial', description: 'Acesso à página inicial do sistema', category: 'Geral' },
  { key: 'enderecamento', label: 'Endereçamento', description: 'Cadastrar localização de materiais', category: 'Operacional' },
  { key: 'inventario', label: 'Inventário', description: 'Realizar contagem de materiais', category: 'Operacional' },
  { key: 'dashboard', label: 'Dashboard', description: 'Ver lançamentos e exportar Excel', category: 'Operacional' },
  { key: 'estoque_atual', label: 'Estoque Atual', description: 'Ver saldo atual por item e endereço', category: 'Consultas' },
  { key: 'estoque_rua', label: 'Consulta por Rua', description: 'Ver materiais de uma rua específica', category: 'Consultas' },
  { key: 'etiquetas', label: 'Gerar Etiquetas', description: 'Imprimir etiquetas com QR Code', category: 'Operacional' },
  { key: 'catalogo_produto', label: 'Catálogo Produto', description: 'Consultar catálogo de produtos', category: 'Consultas' },
  { key: 'solicitar_codigo', label: 'Solicitar Código', description: 'Solicitar código para novo material', category: 'Solicitações' },
  { key: 'processar_codigos', label: 'Processar Códigos', description: 'Gerar códigos para solicitações pendentes', category: 'Solicitações' },
  { key: 'aprovacao_codigos', label: 'Aprovação de Códigos', description: 'Aprovar solicitações de códigos', category: 'Administrativo' },
  { key: 'controle_inventario', label: 'Controle de Inventário', description: 'Configurar contagens de inventário', category: 'Administrativo' },
  { key: 'relatorio_inventario', label: 'Relatório de Divergências', description: 'Ver relatórios de divergências', category: 'Administrativo' },
  { key: 'ajuste_inventario', label: 'Ajuste de Inventário', description: 'Ajustar quantidades de inventário', category: 'Administrativo' },
  { key: 'catalogo', label: 'Catálogo (Admin)', description: 'Gerenciar catálogo de produtos', category: 'Administrativo' },
  { key: 'fabricantes', label: 'Fabricantes', description: 'Gerenciar fabricantes', category: 'Administrativo' },
  { key: 'gerenciamento_dados', label: 'Gerenciamento de Dados', description: 'Importar/exportar dados', category: 'Administrativo' },
  { key: 'admin_panel', label: 'Painel Administrativo', description: 'Acesso ao painel de administração', category: 'Administrativo' },
  // Permissão especial para visualizar estoque durante inventário
  { key: 'bypass_inventario_block', label: 'Ver Estoque Durante Inventário', description: 'Permite visualizar estoque mesmo com inventário em andamento', category: 'Permissões Especiais' },
];

const MENU_CATEGORIES = ['Geral', 'Operacional', 'Consultas', 'Solicitações', 'Administrativo', 'Permissões Especiais'];

interface UserProfile {
  id: string;
  nome: string;
  descricao: string | null;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  permissions: Record<string, boolean>;
  user_count?: number;
}

interface ProfileFormData {
  nome: string;
  descricao: string;
  permissions: Record<string, boolean>;
}

const GerenciarPerfis = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingProfile, setEditingProfile] = useState<UserProfile | null>(null);
  const [deleteProfile, setDeleteProfile] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState<ProfileFormData>({
    nome: '',
    descricao: '',
    permissions: {},
  });

  // Buscar perfis
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['user_profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'listProfiles', adminEmail: user?.email },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data.profiles as UserProfile[];
    },
    enabled: isSuperAdmin,
  });

  // Inicializar permissões padrão
  useEffect(() => {
    if (showCreateDialog && !editingProfile) {
      const defaultPermissions: Record<string, boolean> = {};
      AVAILABLE_MENUS.forEach(menu => {
        defaultPermissions[menu.key] = menu.key === 'home'; // Apenas home ativo por padrão
      });
      setFormData({
        nome: '',
        descricao: '',
        permissions: defaultPermissions,
      });
    }
  }, [showCreateDialog, editingProfile]);

  // Mutation para criar perfil
  const createProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      const { data: result, error } = await supabase.functions.invoke('admin-users', {
        body: {
          action: 'createProfile',
          adminEmail: user?.email,
          profile: {
            nome: data.nome,
            descricao: data.descricao,
            permissions: data.permissions,
          },
        },
      });
      if (error) throw error;
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_profiles'] });
      setShowCreateDialog(false);
      toast({ title: 'Perfil criado com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao criar perfil', description: error.message, variant: 'destructive' });
    },
  });

  // Mutation para atualizar perfil
  const updateProfileMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ProfileFormData> }) => {
      const { data: result, error } = await supabase.functions.invoke('admin-users', {
        body: {
          action: 'updateProfile',
          adminEmail: user?.email,
          profileId: id,
          profile: data,
        },
      });
      if (error) throw error;
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_profiles'] });
      setEditingProfile(null);
      toast({ title: 'Perfil atualizado com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar perfil', description: error.message, variant: 'destructive' });
    },
  });

  // Mutation para deletar perfil
  const deleteProfileMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: result, error } = await supabase.functions.invoke('admin-users', {
        body: {
          action: 'deleteProfile',
          adminEmail: user?.email,
          profileId: id,
        },
      });
      if (error) throw error;
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_profiles'] });
      setDeleteProfile(null);
      toast({ title: 'Perfil excluído com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao excluir perfil', description: error.message, variant: 'destructive' });
    },
  });

  const handleEditClick = (profile: UserProfile) => {
    setEditingProfile(profile);
    setFormData({
      nome: profile.nome,
      descricao: profile.descricao || '',
      permissions: { ...profile.permissions },
    });
  };

  const handleSaveProfile = () => {
    if (!formData.nome.trim()) {
      toast({ title: 'Nome do perfil é obrigatório', variant: 'destructive' });
      return;
    }

    if (editingProfile) {
      updateProfileMutation.mutate({
        id: editingProfile.id,
        data: formData,
      });
    } else {
      createProfileMutation.mutate(formData);
    }
  };

  const handleTogglePermission = (menuKey: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [menuKey]: !prev.permissions[menuKey],
      },
    }));
  };

  const handleToggleCategory = (category: string, enable: boolean) => {
    const categoryMenus = AVAILABLE_MENUS.filter(m => m.category === category);
    setFormData(prev => {
      const newPermissions = { ...prev.permissions };
      categoryMenus.forEach(menu => {
        newPermissions[menu.key] = enable;
      });
      return { ...prev, permissions: newPermissions };
    });
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-xl font-bold text-foreground mb-2">Acesso Restrito</h1>
        <p className="text-muted-foreground text-center mb-4">
          Apenas Super Administradores podem gerenciar perfis de usuários.
        </p>
        <Button onClick={() => navigate('/')}>Voltar ao Início</Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-card p-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <img src={logoImex} alt="IMEX Solutions" className="h-8" />
        </div>
        <h1 className="text-lg font-semibold text-foreground">Gerenciar Perfis</h1>
        <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Perfil
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {profiles.map((profile) => (
              <Card key={profile.id} className={profile.is_active ? '' : 'opacity-60'}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Shield className="h-4 w-4 text-primary" />
                        {profile.nome}
                        {profile.is_system && (
                          <Badge variant="secondary" className="text-xs">Sistema</Badge>
                        )}
                      </CardTitle>
                      {profile.descricao && (
                        <CardDescription className="mt-1">{profile.descricao}</CardDescription>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditClick(profile)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {!profile.is_system && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteProfile(profile)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                    <Users className="h-4 w-4" />
                    <span>{profile.user_count || 0} usuário(s)</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(profile.permissions || {})
                      .filter(([_, hasAccess]) => hasAccess)
                      .slice(0, 5)
                      .map(([menuKey]) => {
                        const menu = AVAILABLE_MENUS.find(m => m.key === menuKey);
                        return menu ? (
                          <Badge key={menuKey} variant="outline" className="text-xs">
                            {menu.label}
                          </Badge>
                        ) : null;
                      })}
                    {Object.values(profile.permissions || {}).filter(Boolean).length > 5 && (
                      <Badge variant="outline" className="text-xs">
                        +{Object.values(profile.permissions || {}).filter(Boolean).length - 5}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dialog de Criar/Editar */}
      <Dialog open={showCreateDialog || !!editingProfile} onOpenChange={(open) => {
        if (!open) {
          setShowCreateDialog(false);
          setEditingProfile(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProfile ? `Editar Perfil: ${editingProfile.nome}` : 'Criar Novo Perfil'}
            </DialogTitle>
            <DialogDescription>
              Configure o nome e as permissões de acesso para este perfil.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Nome e Descrição */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome do Perfil *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Ex: vendas, financeiro"
                  disabled={editingProfile?.is_system}
                />
                {editingProfile?.is_system && (
                  <p className="text-xs text-muted-foreground">Perfis do sistema não podem ter o nome alterado</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Input
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                  placeholder="Descrição do perfil"
                />
              </div>
            </div>

            {/* Permissões por Categoria */}
            <div className="space-y-4">
              <Label>Permissões de Acesso</Label>
              
              {MENU_CATEGORIES.map((category) => {
                const categoryMenus = AVAILABLE_MENUS.filter(m => m.category === category);
                const enabledCount = categoryMenus.filter(m => formData.permissions[m.key]).length;
                const allEnabled = enabledCount === categoryMenus.length;
                
                return (
                  <Card key={category} className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{category}</h4>
                        <Badge variant="secondary" className="text-xs">
                          {enabledCount}/{categoryMenus.length}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleCategory(category, !allEnabled)}
                        >
                          {allEnabled ? 'Desmarcar Todos' : 'Marcar Todos'}
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {categoryMenus.map((menu) => (
                        <div
                          key={menu.key}
                          className="flex items-start gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors"
                        >
                          <Switch
                            checked={formData.permissions[menu.key] || false}
                            onCheckedChange={() => handleTogglePermission(menu.key)}
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{menu.label}</p>
                            <p className="text-xs text-muted-foreground">{menu.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreateDialog(false);
              setEditingProfile(null);
            }}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveProfile}
              disabled={createProfileMutation.isPending || updateProfileMutation.isPending}
            >
              {(createProfileMutation.isPending || updateProfileMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editingProfile ? 'Salvar Alterações' : 'Criar Perfil'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={!!deleteProfile} onOpenChange={() => setDeleteProfile(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Perfil</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o perfil "{deleteProfile?.nome}"?
              {(deleteProfile?.user_count || 0) > 0 && (
                <span className="block mt-2 text-destructive">
                  Atenção: Este perfil possui {deleteProfile?.user_count} usuário(s) vinculado(s).
                  Os usuários serão movidos para o perfil "user".
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteProfile && deleteProfileMutation.mutate(deleteProfile.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteProfileMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default GerenciarPerfis;
