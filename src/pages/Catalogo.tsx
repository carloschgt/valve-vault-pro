import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Plus, Trash2, Loader2, Search, Download, AlertTriangle, Edit2, Save, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { insertCatalogo, deleteCatalogo, upsertCatalogo, updateCatalogo } from '@/hooks/useDataOperations';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import logoImex from '@/assets/logo-imex.png';
import { sanitizeSearchTerm } from '@/lib/security';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from '@/components/ui/scroll-area';

interface Produto {
  id: string;
  codigo: string;
  descricao: string;
  peso_kg?: number | null;
  ativo?: boolean;
}

interface DuplicateItem {
  codigo: string;
  descricao: string;
  existingDescricao: string;
}

const Catalogo = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const isAdmin = user?.tipo === 'admin';
  
  const [searchTerm, setSearchTerm] = useState('');
  const [novoCodigo, setNovoCodigo] = useState('');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novoPeso, setNovoPeso] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateItem[]>([]);
  const [showDuplicatesDialog, setShowDuplicatesDialog] = useState(false);
  const [pendingImport, setPendingImport] = useState<{ codigo: string; descricao: string; peso_kg?: number }[]>([]);
  
  // Edit mode state
  const [editingProduct, setEditingProduct] = useState<Produto | null>(null);
  const [editDescricao, setEditDescricao] = useState('');
  const [editPeso, setEditPeso] = useState('');

  // Buscar produtos - lista todos automaticamente
  const { data: produtos = [], isLoading } = useQuery({
    queryKey: ['catalogo_produtos', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('catalogo_produtos')
        .select('*')
        .eq('ativo', true)
        .order('codigo');
      
      if (searchTerm) {
        const safeSearch = sanitizeSearchTerm(searchTerm);
        if (safeSearch) {
          query = query.or(`codigo.ilike.%${safeSearch}%,descricao.ilike.%${safeSearch}%`);
        }
      }
      
      const { data, error } = await query.limit(500);
      if (error) throw error;
      return data as Produto[];
    },
  });

  // Download template
  const handleDownloadTemplate = () => {
    const templateContent = 'Codigo;Descricao\n12345;Exemplo de produto 1\n67890;Exemplo de produto 2';
    const blob = new Blob(['\ufeff' + templateContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'template_catalogo_produtos.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({
      title: 'Template baixado',
      description: 'Preencha o arquivo e faça upload para importar os produtos.',
    });
  };

  // Verificar duplicados antes de adicionar individualmente
  const checkDuplicateBeforeAdd = async (codigo: string): Promise<Produto | null> => {
    const { data } = await supabase
      .from('catalogo_produtos')
      .select('*')
      .eq('codigo', codigo.trim())
      .maybeSingle();
    return data as Produto | null;
  };

  // Adicionar produto com verificação de duplicado
  const addMutation = useMutation({
    mutationFn: async ({ codigo, descricao, peso_kg }: { codigo: string; descricao: string; peso_kg?: number }) => {
      // Check for duplicate first
      const existing = await checkDuplicateBeforeAdd(codigo);
      if (existing) {
        throw new Error(`DUPLICATE:${existing.descricao}`);
      }
      
      const result = await insertCatalogo(codigo.trim(), descricao.trim(), peso_kg);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalogo_produtos'] });
      setNovoCodigo('');
      setNovaDescricao('');
      setNovoPeso('');
      toast({ title: 'Sucesso', description: 'Produto adicionado!' });
    },
    onError: (error: any) => {
      if (error.message?.startsWith('DUPLICATE:')) {
        const existingDesc = error.message.replace('DUPLICATE:', '');
        toast({
          title: 'Produto já existe',
          description: `Código já cadastrado com descrição: "${existingDesc}"`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Erro',
          description: error.message?.includes('unique') 
            ? 'Código já existe no catálogo' 
            : error.message,
          variant: 'destructive',
        });
      }
    },
  });

  // Editar produto
  const editMutation = useMutation({
    mutationFn: async ({ id, codigo, descricao, peso_kg }: { id: string; codigo: string; descricao: string; peso_kg?: number }) => {
      const result = await updateCatalogo(id, codigo, descricao, peso_kg);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalogo_produtos'] });
      setEditingProduct(null);
      toast({ title: 'Sucesso', description: 'Produto atualizado!' });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Deletar produto
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteCatalogo(id);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalogo_produtos'] });
      toast({ title: 'Sucesso', description: 'Produto removido!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  // Importar CSV com verificação de duplicados
  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      // Pular cabeçalho se existir
      const startIndex = lines[0]?.toLowerCase().includes('codigo') ? 1 : 0;
      
      const produtosToImport: { codigo: string; descricao: string }[] = [];
      
      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i];
        // Suporta CSV com ; ou ,
        const parts = line.includes(';') ? line.split(';') : line.split(',');
        
        if (parts.length >= 2) {
          const codigo = parts[0]?.trim().replace(/"/g, '');
          const descricao = parts[1]?.trim().replace(/"/g, '');
          
          if (codigo && descricao) {
            produtosToImport.push({ codigo, descricao });
          }
        }
      }

      if (produtosToImport.length === 0) {
        throw new Error('Nenhum produto válido encontrado no arquivo');
      }

      // Verificar duplicados
      const codigos = produtosToImport.map(p => p.codigo);
      const { data: existingProducts } = await supabase
        .from('catalogo_produtos')
        .select('codigo, descricao')
        .in('codigo', codigos);

      const existingMap = new Map((existingProducts || []).map(p => [p.codigo, p.descricao]));
      
      const duplicateItems: DuplicateItem[] = [];
      const newItems: { codigo: string; descricao: string }[] = [];

      for (const item of produtosToImport) {
        if (existingMap.has(item.codigo)) {
          duplicateItems.push({
            codigo: item.codigo,
            descricao: item.descricao,
            existingDescricao: existingMap.get(item.codigo)!,
          });
        } else {
          newItems.push(item);
        }
      }

      if (duplicateItems.length > 0) {
        setDuplicates(duplicateItems);
        setPendingImport(produtosToImport);
        setShowDuplicatesDialog(true);
        setIsImporting(false);
        return;
      }

      // Se não houver duplicados, importar diretamente
      await performImport(newItems, false);
      
    } catch (error: any) {
      toast({
        title: 'Erro na importação',
        description: error.message,
        variant: 'destructive',
      });
      setIsImporting(false);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const performImport = async (items: { codigo: string; descricao: string }[], overwrite: boolean) => {
    setIsImporting(true);
    try {
      const batchSize = 100;
      let inserted = 0;
      let errors = 0;

      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        
        const result = await upsertCatalogo(batch, overwrite);
        
        if (!result.success) {
          errors += batch.length;
        } else {
          inserted += result.count || batch.length;
        }
      }

      queryClient.invalidateQueries({ queryKey: ['catalogo_produtos'] });
      
      toast({
        title: 'Importação concluída',
        description: `${inserted} produtos ${overwrite ? 'importados/atualizados' : 'importados'}${errors > 0 ? `, ${errors} erros` : ''}`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro na importação',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
      setShowDuplicatesDialog(false);
      setDuplicates([]);
      setPendingImport([]);
    }
  };

  const handleConfirmOverwrite = () => {
    performImport(pendingImport, true);
  };

  const handleSkipDuplicates = () => {
    const duplicateCodes = new Set(duplicates.map(d => d.codigo));
    const newItems = pendingImport.filter(p => !duplicateCodes.has(p.codigo));
    performImport(newItems, false);
  };

  const handleAddProduct = () => {
    if (!novoCodigo.trim() || !novaDescricao.trim()) {
      toast({
        title: 'Atenção',
        description: 'Preencha código e descrição',
        variant: 'destructive',
      });
      return;
    }
    const pesoNum = novoPeso.trim() ? parseFloat(novoPeso) : undefined;
    addMutation.mutate({ codigo: novoCodigo, descricao: novaDescricao, peso_kg: pesoNum });
  };

  const startEditing = (produto: Produto) => {
    setEditingProduct(produto);
    setEditDescricao(produto.descricao);
    setEditPeso(produto.peso_kg?.toString() || '');
  };

  const cancelEditing = () => {
    setEditingProduct(null);
    setEditDescricao('');
    setEditPeso('');
  };

  const saveEdit = () => {
    if (!editingProduct) return;
    
    const pesoNum = editPeso.trim() ? parseFloat(editPeso) : undefined;
    editMutation.mutate({
      id: editingProduct.id,
      codigo: editingProduct.codigo,
      descricao: editDescricao,
      peso_kg: pesoNum,
    });
  };

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
        <button onClick={() => navigate('/')} className="rounded-lg p-2 hover:bg-accent">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <img src={logoImex} alt="IMEX Solutions" className="h-8" />
        <h1 className="text-lg font-bold">Catálogo de Produtos</h1>
      </div>

      <div className="flex-1 space-y-4 p-4">
        {/* Download Template e Importar CSV */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 font-semibold">Importar do Excel/CSV</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Baixe o template, preencha os dados e faça o upload. Colunas: <strong>Codigo;Descricao</strong>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleDownloadTemplate}
              variant="outline"
            >
              <Download className="mr-2 h-4 w-4" />
              Baixar Template
            </Button>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleImportCSV}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              variant="default"
            >
              {isImporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {isImporting ? 'Importando...' : 'Fazer Upload'}
            </Button>
          </div>
        </div>

        {/* Adicionar manualmente */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 font-semibold">Adicionar Produto</h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <Label htmlFor="novoCodigo">Código</Label>
              <Input
                id="novoCodigo"
                placeholder="Ex: 12345"
                value={novoCodigo}
                onChange={(e) => setNovoCodigo(e.target.value.replace(/\D/g, ''))}
                inputMode="numeric"
                pattern="[0-9]*"
              />
            </div>
            <div className="flex-[2]">
              <Label htmlFor="novaDescricao">Descrição</Label>
              <Input
                id="novaDescricao"
                placeholder="Descrição do produto"
                value={novaDescricao}
                onChange={(e) => setNovaDescricao(e.target.value)}
              />
            </div>
            <div className="w-24">
              <Label htmlFor="novoPeso">Peso (kg)</Label>
              <Input
                id="novoPeso"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={novoPeso}
                onChange={(e) => setNovoPeso(e.target.value)}
                inputMode="decimal"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleAddProduct}
                disabled={addMutation.isPending}
              >
                {addMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Buscar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por código ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              inputMode="text"
            />
          </div>
        </div>

        {/* Lista de produtos */}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {produtos.length} produto(s) encontrado(s)
          </p>
          
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-2">
              {produtos.map((produto) => (
                <div
                  key={produto.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
                >
                  {editingProduct?.id === produto.id ? (
                    // Edit mode
                    <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                      <div className="font-medium text-primary shrink-0">{produto.codigo}</div>
                      <div className="flex-1">
                        <Input
                          value={editDescricao}
                          onChange={(e) => setEditDescricao(e.target.value)}
                          placeholder="Descrição"
                          className="h-8"
                        />
                      </div>
                      <div className="w-24">
                        <Input
                          value={editPeso}
                          onChange={(e) => setEditPeso(e.target.value)}
                          placeholder="Peso (kg)"
                          type="number"
                          step="0.01"
                          inputMode="decimal"
                          className="h-8"
                        />
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="default"
                          size="icon"
                          className="h-8 w-8"
                          onClick={saveEdit}
                          disabled={editMutation.isPending}
                        >
                          {editMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={cancelEditing}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // View mode
                    <>
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2">
                          <p className="font-medium text-primary">{produto.codigo}</p>
                          {produto.peso_kg && (
                            <span className="text-xs text-muted-foreground">
                              {produto.peso_kg} kg
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {produto.descricao}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => startEditing(produto)}
                        >
                          <Edit2 className="h-4 w-4 text-primary" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(produto.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dialog para duplicados */}
      <Dialog open={showDuplicatesDialog} onOpenChange={setShowDuplicatesDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Produtos Duplicados Encontrados
            </DialogTitle>
            <DialogDescription>
              {duplicates.length} produto(s) já existem no catálogo. O que deseja fazer?
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-60">
            <div className="space-y-2">
              {duplicates.map((dup, idx) => (
                <div key={idx} className="rounded border border-border p-2 text-sm">
                  <p className="font-medium">Código: {dup.codigo}</p>
                  <p className="text-muted-foreground">
                    <span className="text-destructive">Existente:</span> {dup.existingDescricao}
                  </p>
                  <p className="text-muted-foreground">
                    <span className="text-primary">Novo:</span> {dup.descricao}
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
          
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="destructive"
              onClick={handleConfirmOverwrite}
              disabled={isImporting}
              className="flex-1"
            >
              {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Sobrescrever Todos
            </Button>
            <Button
              variant="outline"
              onClick={handleSkipDuplicates}
              disabled={isImporting}
              className="flex-1"
            >
              Pular Duplicados
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setShowDuplicatesDialog(false);
                setDuplicates([]);
                setPendingImport([]);
              }}
              disabled={isImporting}
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Catalogo;