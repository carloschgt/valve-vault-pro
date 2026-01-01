import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Edit2, Search, Loader2, MapPin, Package, BookOpen, Users, ChevronDown, ChevronUp } from 'lucide-react';
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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import logoImex from '@/assets/logo-imex.png';

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const isAdmin = user?.tipo === 'admin';
  
  const [searchEnderecos, setSearchEnderecos] = useState('');
  const [searchInventario, setSearchInventario] = useState('');
  const [searchCatalogo, setSearchCatalogo] = useState('');
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
        query = query.or(`codigo.ilike.%${searchEnderecos}%,descricao.ilike.%${searchEnderecos}%`);
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
      
      // Filtrar no cliente se houver busca
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
        query = query.or(`codigo.ilike.%${searchCatalogo}%,descricao.ilike.%${searchCatalogo}%`);
      }
      
      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data;
    },
  });

  // Deletar endereço
  const deleteEndereco = useMutation({
    mutationFn: async (id: string) => {
      // Primeiro deletar inventário relacionado
      await supabase.from('inventario').delete().eq('endereco_material_id', id);
      const { error } = await supabase.from('enderecos_materiais').delete().eq('id', id);
      if (error) throw error;
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
  const deleteInventario = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('inventario').delete().eq('id', id);
      if (error) throw error;
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
  const deleteCatalogo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('catalogo_produtos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_catalogo'] });
      toast({ title: 'Sucesso', description: 'Produto excluído do catálogo!' });
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
      <Tabs defaultValue="enderecos" className="flex-1 p-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="enderecos" className="gap-1 text-xs sm:text-sm">
            <MapPin className="h-4 w-4" />
            <span className="hidden sm:inline">Endereços</span>
            <Badge variant="secondary" className="ml-1">{enderecos.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="inventario" className="gap-1 text-xs sm:text-sm">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Inventário</span>
            <Badge variant="secondary" className="ml-1">{inventario.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="catalogo" className="gap-1 text-xs sm:text-sm">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Catálogo</span>
            <Badge variant="secondary" className="ml-1">{catalogo.length}</Badge>
          </TabsTrigger>
        </TabsList>

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
                        <p>Cadastrado por: {e.created_by}</p>
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
                              <AlertDialogAction onClick={() => deleteEndereco.mutate(e.id)}>
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
                      <span>Por: {i.contado_por}</span>
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
                          <AlertDialogAction onClick={() => deleteInventario.mutate(i.id)}>
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
                        <AlertDialogAction onClick={() => deleteCatalogo.mutate(c.id)}>
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
