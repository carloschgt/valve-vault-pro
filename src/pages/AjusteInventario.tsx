import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Loader2, Save, Edit2, History } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { updateInventario } from '@/hooks/useDataOperations';
import { Skeleton } from '@/components/ui/skeleton';
import { formatEndereco } from '@/utils/formatEndereco';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import logoImex from '@/assets/logo-imex.png';

interface InventarioItem {
  id: string;
  endereco_material_id: string;
  quantidade: number;
  contagem_num: number;
  contado_por: string;
  created_at: string;
  comentario?: string;
  enderecos_materiais: {
    codigo: string;
    descricao: string;
    rua: number;
    coluna: number;
    nivel: number;
    posicao: number;
  };
}

interface AuditLog {
  id: string;
  inventario_id: string;
  quantidade_anterior: number;
  quantidade_nova: number;
  motivo: string;
  editado_por: string;
  editado_em: string;
}

const AjusteInventario = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [inventarioItems, setInventarioItems] = useState<InventarioItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Edit state
  const [editingItem, setEditingItem] = useState<InventarioItem | null>(null);
  const [editQuantidade, setEditQuantidade] = useState('');
  const [editMotivo, setEditMotivo] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Audit history
  const [showHistory, setShowHistory] = useState(false);
  const [historyItem, setHistoryItem] = useState<InventarioItem | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const isAdmin = user?.tipo === 'admin';

  useEffect(() => {
    if (!authLoading && user) {
      setPermissionsLoaded(true);
    }
  }, [authLoading, user]);

  const handleBuscar = async () => {
    if (!searchTerm.trim()) {
      toast({
        title: 'Atenção',
        description: 'Digite um código ou descrição para buscar',
        variant: 'destructive',
      });
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('inventario')
        .select(`
          id,
          endereco_material_id,
          quantidade,
          contagem_num,
          contado_por,
          created_at,
          comentario,
          enderecos_materiais (
            codigo,
            descricao,
            rua,
            coluna,
            nivel,
            posicao
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter by search term
      const filtered = (data || []).filter((item: any) =>
        item.enderecos_materiais?.codigo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.enderecos_materiais?.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
      );

      setInventarioItems(filtered as InventarioItem[]);

      if (filtered.length === 0) {
        toast({
          title: 'Nenhum resultado',
          description: 'Nenhuma contagem encontrada para esta busca',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao buscar inventário',
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleEdit = (item: InventarioItem) => {
    setEditingItem(item);
    setEditQuantidade(item.quantidade.toString());
    setEditMotivo('');
  };

  const handleSave = async () => {
    if (!editingItem || !isAdmin) return;

    if (!editMotivo.trim()) {
      toast({
        title: 'Atenção',
        description: 'Informe o motivo do ajuste',
        variant: 'destructive',
      });
      return;
    }

    const newQty = parseInt(editQuantidade);
    if (isNaN(newQty) || newQty < 0) {
      toast({
        title: 'Atenção',
        description: 'Quantidade inválida',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateInventario(
        editingItem.id,
        editQuantidade,
        editingItem.comentario,
        editMotivo.trim()
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      // Update local state
      setInventarioItems((prev) =>
        prev.map((item) =>
          item.id === editingItem.id
            ? { ...item, quantidade: newQty }
            : item
        )
      );

      setEditingItem(null);
      toast({
        title: 'Sucesso',
        description: 'Contagem ajustada com sucesso!',
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao ajustar contagem',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleViewHistory = async (item: InventarioItem) => {
    setHistoryItem(item);
    setShowHistory(true);
    setLoadingHistory(true);

    try {
      const { data, error } = await supabase
        .from('inventario_audit')
        .select('*')
        .eq('inventario_id', item.id)
        .order('editado_em', { ascending: false });

      if (error) throw error;
      setAuditLogs(data || []);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao carregar histórico',
        variant: 'destructive',
      });
    } finally {
      setLoadingHistory(false);
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
          <Skeleton className="h-20 w-full" />
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
        <h1 className="text-lg font-bold">Ajuste de Inventário</h1>
      </div>

      {/* Search */}
      <div className="border-b border-border bg-card p-4">
        <Label htmlFor="search">Buscar Material</Label>
        <div className="mt-2 flex gap-2">
          <Input
            id="search"
            placeholder="Código ou descrição do material"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
            className="flex-1"
          />
          <Button
            onClick={handleBuscar}
            disabled={isSearching}
            variant="secondary"
          >
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto p-4">
        {inventarioItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Busque por um material para ver suas contagens
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground mb-4">
              {inventarioItems.length} contagem(s) encontrada(s)
            </p>
            {inventarioItems.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-primary truncate">
                      {item.enderecos_materiais.codigo}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {item.enderecos_materiais.descricao}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatEndereco(
                        item.enderecos_materiais.rua,
                        item.enderecos_materiais.coluna,
                        item.enderecos_materiais.nivel,
                        item.enderecos_materiais.posicao
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="rounded bg-primary/10 px-2 py-1 text-sm font-medium">
                      Contagem {item.contagem_num}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{item.quantidade}</p>
                    <p className="text-xs text-muted-foreground">
                      Por: {item.contado_por} em{' '}
                      {new Date(item.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewHistory(item)}
                    >
                      <History className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(item)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar Contagem</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-3">
                <p className="font-semibold">{editingItem.enderecos_materiais.codigo}</p>
                <p className="text-sm text-muted-foreground">
                  {editingItem.enderecos_materiais.descricao}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Contagem {editingItem.contagem_num} •{' '}
                  {formatEndereco(
                    editingItem.enderecos_materiais.rua,
                    editingItem.enderecos_materiais.coluna,
                    editingItem.enderecos_materiais.nivel,
                    editingItem.enderecos_materiais.posicao
                  )}
                </p>
              </div>

              <div>
                <Label>Valor atual</Label>
                <p className="text-2xl font-bold text-muted-foreground">
                  {editingItem.quantidade}
                </p>
              </div>

              <div>
                <Label htmlFor="novaQuantidade">Nova quantidade *</Label>
                <Input
                  id="novaQuantidade"
                  type="number"
                  inputMode="numeric"
                  value={editQuantidade}
                  onChange={(e) => setEditQuantidade(e.target.value)}
                  className="text-2xl font-bold"
                />
              </div>

              <div>
                <Label htmlFor="motivo">Motivo do ajuste *</Label>
                <Textarea
                  id="motivo"
                  placeholder="Informe o motivo da alteração..."
                  value={editMotivo}
                  onChange={(e) => setEditMotivo(e.target.value)}
                  maxLength={500}
                />
              </div>

              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full"
              >
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Salvar Ajuste
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Histórico de Alterações</DialogTitle>
          </DialogHeader>
          {historyItem && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-3">
                <p className="font-semibold">{historyItem.enderecos_materiais.codigo}</p>
                <p className="text-sm text-muted-foreground">
                  Contagem {historyItem.contagem_num}
                </p>
              </div>

              {loadingHistory ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : auditLogs.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  Nenhuma alteração registrada
                </p>
              ) : (
                <ScrollArea className="max-h-[300px]">
                  <div className="space-y-3">
                    {auditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="rounded-lg border border-border p-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-bold text-destructive">
                            {log.quantidade_anterior}
                          </span>
                          <span className="text-muted-foreground">→</span>
                          <span className="text-lg font-bold text-mrx-success">
                            {log.quantidade_nova}
                          </span>
                        </div>
                        <p className="mt-2 text-sm">{log.motivo}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Por {log.editado_por} em{' '}
                          {new Date(log.editado_em).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AjusteInventario;
