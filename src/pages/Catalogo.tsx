import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Plus, Trash2, Loader2, Search, FileSpreadsheet } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import logoImex from '@/assets/logo-imex.png';

interface Produto {
  id: string;
  codigo: string;
  descricao: string;
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
  const [isImporting, setIsImporting] = useState(false);

  // Buscar produtos
  const { data: produtos = [], isLoading } = useQuery({
    queryKey: ['catalogo_produtos', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('catalogo_produtos')
        .select('*')
        .order('codigo');
      
      if (searchTerm) {
        query = query.or(`codigo.ilike.%${searchTerm}%,descricao.ilike.%${searchTerm}%`);
      }
      
      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data as Produto[];
    },
  });

  // Adicionar produto
  const addMutation = useMutation({
    mutationFn: async ({ codigo, descricao }: { codigo: string; descricao: string }) => {
      const { error } = await supabase
        .from('catalogo_produtos')
        .insert({ codigo: codigo.trim(), descricao: descricao.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalogo_produtos'] });
      setNovoCodigo('');
      setNovaDescricao('');
      toast({ title: 'Sucesso', description: 'Produto adicionado!' });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message?.includes('unique') 
          ? 'Código já existe no catálogo' 
          : error.message,
        variant: 'destructive',
      });
    },
  });

  // Deletar produto
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('catalogo_produtos')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalogo_produtos'] });
      toast({ title: 'Sucesso', description: 'Produto removido!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  // Importar CSV
  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      // Pular cabeçalho se existir
      const startIndex = lines[0]?.toLowerCase().includes('codigo') ? 1 : 0;
      
      const produtos: { codigo: string; descricao: string }[] = [];
      
      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i];
        // Suporta CSV com ; ou ,
        const parts = line.includes(';') ? line.split(';') : line.split(',');
        
        if (parts.length >= 2) {
          const codigo = parts[0]?.trim().replace(/"/g, '');
          const descricao = parts[1]?.trim().replace(/"/g, '');
          
          if (codigo && descricao) {
            produtos.push({ codigo, descricao });
          }
        }
      }

      if (produtos.length === 0) {
        throw new Error('Nenhum produto válido encontrado no arquivo');
      }

      // Inserir em lotes de 100
      const batchSize = 100;
      let inserted = 0;
      let errors = 0;

      for (let i = 0; i < produtos.length; i += batchSize) {
        const batch = produtos.slice(i, i + batchSize);
        const { error } = await supabase
          .from('catalogo_produtos')
          .upsert(batch, { onConflict: 'codigo', ignoreDuplicates: false });
        
        if (error) {
          errors += batch.length;
        } else {
          inserted += batch.length;
        }
      }

      queryClient.invalidateQueries({ queryKey: ['catalogo_produtos'] });
      
      toast({
        title: 'Importação concluída',
        description: `${inserted} produtos importados${errors > 0 ? `, ${errors} erros` : ''}`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro na importação',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
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
    addMutation.mutate({ codigo: novoCodigo, descricao: novaDescricao });
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
        {/* Importar CSV */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 font-semibold">Importar do Excel/CSV</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Arquivo deve ter colunas: <strong>Código;Descrição</strong> (separado por ; ou ,)
          </p>
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
            variant="outline"
          >
            {isImporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="mr-2 h-4 w-4" />
            )}
            {isImporting ? 'Importando...' : 'Selecionar Arquivo CSV'}
          </Button>
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
                onChange={(e) => setNovoCodigo(e.target.value)}
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
                  <div className="flex-1">
                    <p className="font-medium text-primary">{produto.codigo}</p>
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {produto.descricao}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(produto.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Catalogo;
