import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Plus, Trash2, Loader2, Search, Download, AlertTriangle, Edit2, Save, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { listCatalogo, insertCatalogo, deleteCatalogo, upsertCatalogo, updateCatalogo, checkCatalogoDuplicates } from '@/hooks/useDataOperations';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import logoImex from '@/assets/logo-imex.png';
import { sanitizeSearchTerm } from '@/lib/security';
import { wildcardToILike } from '@/lib/wildcardSearch';
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
  descricao_imex?: string | null;
  valor_unitario?: number | null;
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
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  
  const [searchTerm, setSearchTerm] = useState('');
  const [novoCodigo, setNovoCodigo] = useState('');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novaDescricaoImex, setNovaDescricaoImex] = useState('');
  const [novoValorUnitario, setNovoValorUnitario] = useState('');
  const [novoPeso, setNovoPeso] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateItem[]>([]);
  const [showDuplicatesDialog, setShowDuplicatesDialog] = useState(false);
  const [pendingImport, setPendingImport] = useState<{ codigo: string; descricao: string; peso_kg?: number }[]>([]);
  
  // Edit mode state
  const [editingProduct, setEditingProduct] = useState<Produto | null>(null);
  const [editCodigo, setEditCodigo] = useState('');
  const [editDescricao, setEditDescricao] = useState('');
  const [editDescricaoImex, setEditDescricaoImex] = useState('');
  const [editValorUnitario, setEditValorUnitario] = useState('');
  const [editPeso, setEditPeso] = useState('');

  // Buscar produtos - lista todos automaticamente via edge function
  const { data: produtos = [], isLoading } = useQuery({
    queryKey: ['catalogo_produtos', searchTerm],
    queryFn: async () => {
      const result = await listCatalogo(searchTerm.trim() || undefined, 500);
      if (!result.success) {
        throw new Error(result.error);
      }
      // Filter for ativo only (edge function returns all, we filter here)
      return (result.data || []).filter((p: Produto) => p.ativo !== false) as Produto[];
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

  // Verificar duplicados antes de adicionar individualmente via edge function
  const checkDuplicateBeforeAdd = async (codigo: string): Promise<Produto | null> => {
    const result = await checkCatalogoDuplicates([codigo.trim()]);
    if (!result.success || !result.data || result.data.length === 0) {
      return null;
    }
    const existing = result.data[0];
    return existing ? { id: '', codigo: existing.codigo, descricao: existing.descricao } as Produto : null;
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
      setNovaDescricaoImex('');
      setNovoValorUnitario('');
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
    mutationFn: async ({ id, codigo, descricao, descricao_imex, valor_unitario, peso_kg, novo_codigo }: { 
      id: string; 
      codigo: string; 
      descricao: string; 
      descricao_imex?: string;
      valor_unitario?: number;
      peso_kg?: number;
      novo_codigo?: string;
    }) => {
      const result = await updateCatalogo(id, codigo, descricao, peso_kg, novo_codigo, descricao_imex, valor_unitario);
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

      // Verificar duplicados via edge function
      const codigos = produtosToImport.map(p => p.codigo);
      const duplicateResult = await checkCatalogoDuplicates(codigos);
      const existingProducts = duplicateResult.success ? (duplicateResult.data || []) : [];

      const existingMap = new Map<string, string>(existingProducts.map((p: any) => [p.codigo, p.descricao]));
      
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
    setEditCodigo(produto.codigo);
    setEditDescricao(produto.descricao);
    setEditDescricaoImex(produto.descricao_imex || '');
    setEditValorUnitario(produto.valor_unitario !== null && produto.valor_unitario !== undefined 
      ? produto.valor_unitario.toString() 
      : '');
    const pesoValue = produto.peso_kg !== null && produto.peso_kg !== undefined 
      ? produto.peso_kg.toString() 
      : '';
    setEditPeso(pesoValue);
  };

  const cancelEditing = () => {
    setEditingProduct(null);
    setEditCodigo('');
    setEditDescricao('');
    setEditDescricaoImex('');
    setEditValorUnitario('');
    setEditPeso('');
  };

  const saveEdit = () => {
    if (!editingProduct) return;
    
    // Se Super Admin está editando o código, validar 6 caracteres
    const novoCodigo = editCodigo.trim();
    if (isSuperAdmin && novoCodigo !== editingProduct.codigo) {
      if (novoCodigo.length !== 6) {
        toast({
          title: 'Código inválido',
          description: 'O código deve ter exatamente 6 caracteres',
          variant: 'destructive',
        });
        return;
      }
    }
    
    const pesoNum = editPeso.trim() ? parseFloat(editPeso) : undefined;
    const valorNum = editValorUnitario.trim() ? parseFloat(editValorUnitario) : undefined;
    editMutation.mutate({
      id: editingProduct.id,
      codigo: editingProduct.codigo,
      descricao: editDescricao,
      descricao_imex: editDescricaoImex.trim() || undefined,
      valor_unitario: valorNum,
      peso_kg: pesoNum,
      novo_codigo: isSuperAdmin && novoCodigo !== editingProduct.codigo ? novoCodigo : undefined,
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <div className="sm:col-span-1">
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
            <div className="sm:col-span-1 lg:col-span-2">
              <Label htmlFor="novaDescricao">Descrição</Label>
              <Input
                id="novaDescricao"
                placeholder="Descrição do produto"
                value={novaDescricao}
                onChange={(e) => setNovaDescricao(e.target.value)}
              />
            </div>
            <div className="sm:col-span-1">
              <Label htmlFor="novaDescricaoImex">Descrição IMEX</Label>
              <Input
                id="novaDescricaoImex"
                placeholder="Descrição IMEX"
                value={novaDescricaoImex}
                onChange={(e) => setNovaDescricaoImex(e.target.value)}
              />
            </div>
            <div className="sm:col-span-1">
              <Label htmlFor="novoValorUnitario">Valor Unit. (R$)</Label>
              <Input
                id="novoValorUnitario"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={novoValorUnitario}
                onChange={(e) => setNovoValorUnitario(e.target.value)}
                inputMode="decimal"
              />
            </div>
            <div className="flex items-end gap-2 sm:col-span-1">
              <div className="flex-1">
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
              <Button
                onClick={handleAddProduct}
                disabled={addMutation.isPending}
                className="shrink-0"
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
              placeholder="Buscar... (use * como coringa, ex: 002* ou *ABC*)"
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
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        {isSuperAdmin ? (
                          <div className="shrink-0 space-y-1">
                            <Input
                              value={editCodigo}
                              onChange={(e) => setEditCodigo(e.target.value.toUpperCase().slice(0, 6))}
                              placeholder="Código"
                              className={`h-8 w-20 font-mono text-sm ${editCodigo.length !== 6 ? 'border-destructive' : ''}`}
                              maxLength={6}
                            />
                            <span className={`text-xs ${editCodigo.length !== 6 ? 'text-destructive' : 'text-muted-foreground'}`}>
                              {editCodigo.length}/6
                            </span>
                          </div>
                        ) : (
                          <div className="font-medium text-primary shrink-0 w-16">{produto.codigo}</div>
                        )}
                        <div className="flex-1">
                          <Input
                            value={editDescricao}
                            onChange={(e) => setEditDescricao(e.target.value)}
                            placeholder="Descrição"
                            className="h-8"
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <div className="flex-1 min-w-[150px]">
                          <Input
                            value={editDescricaoImex}
                            onChange={(e) => setEditDescricaoImex(e.target.value)}
                            placeholder="Descrição IMEX"
                            className="h-8"
                          />
                        </div>
                        <div className="w-28">
                          <Input
                            value={editValorUnitario}
                            onChange={(e) => setEditValorUnitario(e.target.value)}
                            placeholder="Valor Unit."
                            type="number"
                            step="0.01"
                            inputMode="decimal"
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
                    </div>
                  ) : (
                    // View mode
                    <>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <p className="font-medium text-primary">{produto.codigo}</p>
                          {produto.valor_unitario !== null && produto.valor_unitario !== undefined && (
                            <span className="text-xs font-medium text-emerald-600">
                              R$ {produto.valor_unitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          )}
                          {produto.peso_kg && (
                            <span className="text-xs text-muted-foreground">
                              {produto.peso_kg} kg
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {produto.descricao}
                        </p>
                        {produto.descricao_imex && (
                          <p className="text-xs text-primary/70 line-clamp-1">
                            IMEX: {produto.descricao_imex}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
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