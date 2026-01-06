import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Search, Edit2, X, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
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
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { listFabricantes, getCatalogoDescricao, insertEndereco, checkEnderecoDuplicado, getEnderecoById, listEnderecos, deleteEndereco } from '@/hooks/useDataOperations';
import { formatEndereco } from '@/utils/formatEndereco';
import logoImex from '@/assets/logo-imex.png';

const TIPOS_MATERIAL = [
  'Atuador',
  'Chapa',
  'Conexão',
  'Elétrico',
  'Flange',
  'Instrumento',
  'Mecânico',
  'Tubo',
  'Válvula Borboleta',
  'Válvula Esfera',
  'Válvula Gaveta',
  'Válvula Globo',
  'Válvula Macho',
  'Válvula Retenção',
  'Outro',
];

interface Fabricante {
  id: string;
  nome: string;
  codigo: string;
}

interface EnderecoExistente {
  id: string;
  codigo: string;
  descricao: string;
  endereco_formatado: string;
}

interface EnderecoResult {
  id: string;
  codigo: string;
  descricao: string;
  tipo_material: string;
  fabricante_id: string | null;
  peso: number;
  rua: number;
  coluna: number;
  nivel: number;
  posicao: number;
  comentario: string | null;
  ativo: boolean;
  fabricantes?: { nome: string } | null;
}

const Enderecamento = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.tipo === 'admin';
  
  const [codigo, setCodigo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tipoMaterial, setTipoMaterial] = useState('');
  const [fabricanteId, setFabricanteId] = useState('');
  const [peso, setPeso] = useState('');
  const [rua, setRua] = useState('');
  const [coluna, setColuna] = useState('');
  const [nivel, setNivel] = useState('');
  const [posicao, setPosicao] = useState('');
  const [comentario, setComentario] = useState('');
  
  const [fabricantes, setFabricantes] = useState<Fabricante[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Estado para modal de duplicado
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [enderecoExistente, setEnderecoExistente] = useState<EnderecoExistente | null>(null);
  
  // Estados para busca de endereçamentos (admin)
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<EnderecoResult[]>([]);
  const [isSearchingEnderecos, setIsSearchingEnderecos] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  
  // Estado para confirmação de exclusão (admin)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Carregar fabricantes do banco
  useEffect(() => {
    const loadFabricantes = async () => {
      const result = await listFabricantes();
      
      if (!result.success) {
        console.error('Erro ao carregar fabricantes:', result.error);
      } else {
        setFabricantes(result.data || []);
      }
    };
    
    loadFabricantes();
  }, []);

  // Carregar endereço existente se vier via URL (para edição)
  useEffect(() => {
    const enderecoId = searchParams.get('edit');
    if (enderecoId) {
      loadEnderecoForEdit(enderecoId);
    }
  }, [searchParams]);

  const loadEnderecoForEdit = async (id: string) => {
    const result = await getEnderecoById(id);
    if (result.success && result.data) {
      const e = result.data;
      setEditingId(e.id);
      setCodigo(e.codigo);
      setDescricao(e.descricao);
      setTipoMaterial(e.tipo_material);
      setFabricanteId(e.fabricante_id || '');
      setPeso(String(e.peso));
      setRua(String(e.rua));
      setColuna(String(e.coluna));
      setNivel(String(e.nivel));
      setPosicao(String(e.posicao));
      setComentario(e.comentario || '');
      toast({
        title: 'Registro carregado',
        description: 'Edite os campos e salve as alterações',
      });
    }
  };

  // Buscar endereçamentos cadastrados (admin)
  const handleSearchEnderecos = async () => {
    if (!searchTerm.trim()) {
      toast({
        title: 'Atenção',
        description: 'Digite um termo para buscar',
        variant: 'destructive',
      });
      return;
    }

    setIsSearchingEnderecos(true);
    setShowSearchResults(true);
    try {
      const result = await listEnderecos(searchTerm.trim(), 50);
      if (!result.success) throw new Error(result.error);
      setSearchResults(result.data || []);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao buscar endereçamentos',
        variant: 'destructive',
      });
      setSearchResults([]);
    } finally {
      setIsSearchingEnderecos(false);
    }
  };

  const handleSelectEndereco = (endereco: EnderecoResult) => {
    setEditingId(endereco.id);
    setCodigo(endereco.codigo);
    setDescricao(endereco.descricao);
    setTipoMaterial(endereco.tipo_material);
    setFabricanteId(endereco.fabricante_id || '');
    setPeso(String(endereco.peso));
    setRua(String(endereco.rua));
    setColuna(String(endereco.coluna));
    setNivel(String(endereco.nivel));
    setPosicao(String(endereco.posicao));
    setComentario(endereco.comentario || '');
    setShowSearchResults(false);
    setSearchTerm('');
    setSearchResults([]);
    toast({
      title: 'Registro carregado',
      description: 'Edite os campos e salve as alterações',
    });
  };

  const handleClearEdit = () => {
    setEditingId(null);
    setCodigo('');
    setDescricao('');
    setTipoMaterial('');
    setFabricanteId('');
    setPeso('');
    setRua('');
    setColuna('');
    setNivel('');
    setPosicao('');
    setComentario('');
    if (searchParams.get('edit')) {
      navigate('/enderecamento', { replace: true });
    }
  };


  const handleBuscarDescricao = async () => {
    if (!codigo.trim()) {
      toast({
        title: 'Atenção',
        description: 'Digite um código para buscar',
        variant: 'destructive',
      });
      return;
    }

    setIsSearching(true);
    try {
      const result = await getCatalogoDescricao(codigo.trim());

      if (!result.success) throw new Error(result.error);

      if (result.data) {
        setDescricao(result.data.descricao);
        // Preencher peso se disponível no catálogo
        if (result.data.peso_kg) {
          setPeso(String(result.data.peso_kg));
        }
        toast({
          title: 'Sucesso',
          description: 'Descrição encontrada!',
        });
      } else {
        toast({
          title: 'Não encontrado',
          description: 'Código não encontrado no catálogo',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao buscar descrição',
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSalvar = async () => {
    // Validar campos obrigatórios
    if (!codigo || !descricao || !tipoMaterial || !fabricanteId || !peso || !rua || !coluna || !nivel || !posicao) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha todos os campos antes de salvar',
        variant: 'destructive',
      });
      return;
    }

    // Verificar duplicidade antes de salvar (apenas para novos registros)
    if (!editingId) {
      const duplicateCheck = await checkEnderecoDuplicado(
        codigo.trim(),
        parseInt(rua),
        parseInt(coluna),
        parseInt(nivel),
        parseInt(posicao)
      );

      if (duplicateCheck.success && duplicateCheck.data) {
        const existente = duplicateCheck.data;
        setEnderecoExistente({
          id: existente.id,
          codigo: existente.codigo,
          descricao: existente.descricao,
          endereco_formatado: formatEndereco(existente.rua, existente.coluna, existente.nivel, existente.posicao),
        });
        setShowDuplicateDialog(true);
        return;
      }
    }

    await executeSalvar();
  };

  const executeSalvar = async () => {
    setIsSaving(true);
    try {
      const result = await insertEndereco({
        codigo: codigo.trim(),
        descricao: descricao.trim(),
        tipo_material: tipoMaterial,
        fabricante_id: fabricanteId,
        peso,
        rua,
        coluna,
        nivel,
        posicao,
        comentario: comentario.trim() || undefined,
      }, editingId || undefined);

      if (!result.success) {
        // Verificar se é erro de duplicidade retornado pelo backend
        if ((result as any).duplicateId) {
          setEnderecoExistente({
            id: (result as any).duplicateId,
            codigo: codigo.trim().toUpperCase(),
            descricao: descricao.trim().toUpperCase(),
            endereco_formatado: formatEndereco(parseInt(rua), parseInt(coluna), parseInt(nivel), parseInt(posicao)),
          });
          setShowDuplicateDialog(true);
          return;
        }
        throw new Error(result.error);
      }

      toast({
        title: 'Sucesso',
        description: editingId ? 'Endereçamento atualizado com sucesso!' : 'Endereçamento salvo com sucesso!',
      });

      // Limpar formulário
      setCodigo('');
      setDescricao('');
      setTipoMaterial('');
      setFabricanteId('');
      setPeso('');
      setRua('');
      setColuna('');
      setNivel('');
      setPosicao('');
      setComentario('');
      setEditingId(null);
      
      // Remover parâmetro de edição da URL
      if (searchParams.get('edit')) {
        navigate('/enderecamento', { replace: true });
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao salvar endereçamento',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAbrirRegistroExistente = () => {
    if (enderecoExistente) {
      setShowDuplicateDialog(false);
      navigate(`/enderecamento?edit=${enderecoExistente.id}`);
    }
  };

  const handleExcluir = async () => {
    if (!editingId) return;
    
    setIsDeleting(true);
    try {
      const result = await deleteEndereco(editingId);
      if (!result.success) throw new Error(result.error);
      
      toast({
        title: 'Sucesso',
        description: 'Endereçamento excluído com sucesso!',
      });
      
      handleClearEdit();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao excluir endereçamento',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-background overflow-hidden">
      {/* Header compacto */}
      <div className="flex items-center gap-2 border-b border-border bg-card px-2 py-1.5 shrink-0">
        <button
          onClick={() => navigate('/')}
          className="rounded-lg p-1 hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <img src={logoImex} alt="IMEX Solutions" className="h-5" />
        <h1 className="text-sm font-bold flex-1">
          {editingId ? 'Editar Endereçamento' : 'Endereçamento'}
        </h1>
        {editingId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearEdit}
            className="h-7 px-2 text-xs"
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      {/* Form ultra compacto */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {/* Busca de Endereçamentos (Admin) */}
        {isAdmin && !editingId && (
          <div className="border border-border rounded-lg p-2 bg-muted/30 space-y-2">
            <Label className="text-[10px] font-medium text-muted-foreground">
              Buscar Endereçamento Cadastrado (Admin)
            </Label>
            <div className="flex gap-1.5">
              <Input
                placeholder="Buscar por código ou descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchEnderecos()}
                className="h-8 text-sm flex-1"
              />
              <Button
                onClick={handleSearchEnderecos}
                disabled={isSearchingEnderecos}
                variant="secondary"
                size="sm"
                className="h-8 px-3"
              >
                {isSearchingEnderecos ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
            
            {/* Resultados da busca */}
            {showSearchResults && (
              <div className="max-h-48 overflow-y-auto border border-border rounded-md bg-background">
                {isSearchingEnderecos ? (
                  <div className="p-3 text-center text-muted-foreground text-sm">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />
                    Buscando...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="p-3 text-center text-muted-foreground text-sm">
                    Nenhum endereçamento encontrado
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {searchResults.map((end) => (
                      <button
                        key={end.id}
                        onClick={() => handleSelectEndereco(end)}
                        className="w-full p-2 text-left hover:bg-accent transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{end.codigo}</div>
                            <div className="text-xs text-muted-foreground truncate">{end.descricao}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-xs font-medium text-primary">
                              {formatEndereco(end.rua, end.coluna, end.nivel, end.posicao)}
                            </div>
                            <div className="text-[10px] text-muted-foreground">{end.tipo_material}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => {
                    setShowSearchResults(false);
                    setSearchResults([]);
                  }}
                  className="w-full p-2 text-center text-xs text-muted-foreground hover:bg-muted border-t border-border"
                >
                  Fechar resultados
                </button>
              </div>
            )}
          </div>
        )}

        {/* Código + Buscar */}
        <div className="flex gap-1.5">
          <div className="flex-1">
            <Label htmlFor="codigo" className="text-[10px] font-medium">Código *</Label>
            <Input
              id="codigo"
              placeholder="Código"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleBuscarDescricao()}
              inputMode="numeric"
              pattern="[0-9]*"
              className="h-8 text-sm"
              disabled={!!editingId}
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={handleBuscarDescricao}
              disabled={isSearching || !!editingId}
              variant="secondary"
              size="sm"
              className="h-8 px-2"
            >
              {isSearching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Search className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>

        {/* Descrição */}
        <div>
          <Label htmlFor="descricao" className="text-[10px] font-medium">Descrição *</Label>
          <Input
            id="descricao"
            placeholder="Descrição do material"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="h-8 text-sm"
          />
        </div>

        {/* Tipo + Fabricante */}
        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <Label className="text-[10px] font-medium">Tipo *</Label>
            <Select value={tipoMaterial} onValueChange={setTipoMaterial}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_MATERIAL.map((tipo) => (
                  <SelectItem key={tipo} value={tipo}>
                    {tipo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] font-medium">Fabricante *</Label>
            <Select value={fabricanteId} onValueChange={setFabricanteId}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Fab." />
              </SelectTrigger>
              <SelectContent>
                {fabricantes.map((fab) => (
                  <SelectItem key={fab.id} value={fab.id}>
                    {fab.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Peso */}
        <div className="grid grid-cols-5 gap-1.5">
          <div>
            <Label htmlFor="peso" className="text-[10px] font-medium">Peso(kg)*</Label>
            <Input
              id="peso"
              type="number"
              step="0.01"
              placeholder="0"
              value={peso}
              onChange={(e) => setPeso(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label htmlFor="rua" className="text-[10px] font-medium">Rua *</Label>
            <Input
              id="rua"
              type="number"
              inputMode="numeric"
              placeholder="Nº"
              value={rua}
              onChange={(e) => setRua(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label htmlFor="coluna" className="text-[10px] font-medium">Coluna *</Label>
            <Input
              id="coluna"
              type="number"
              inputMode="numeric"
              placeholder="Nº"
              value={coluna}
              onChange={(e) => setColuna(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label htmlFor="nivel" className="text-[10px] font-medium">Nível *</Label>
            <Input
              id="nivel"
              type="number"
              inputMode="numeric"
              placeholder="Nº"
              value={nivel}
              onChange={(e) => setNivel(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label htmlFor="posicao" className="text-[10px] font-medium">Posição *</Label>
            <Input
              id="posicao"
              type="number"
              inputMode="numeric"
              placeholder="Nº"
              value={posicao}
              onChange={(e) => setPosicao(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        </div>

        {/* Comentário */}
        <div>
          <Label htmlFor="comentario" className="text-[10px] font-medium">Comentário (opcional)</Label>
          <Input
            id="comentario"
            placeholder="Observações"
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            maxLength={500}
            className="h-8 text-sm"
          />
        </div>

        {/* Botões de ação */}
        <div className="flex gap-2">
          <Button
            onClick={handleSalvar}
            disabled={isSaving || isDeleting}
            className="flex-1 h-10"
            size="default"
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : editingId ? (
              <Edit2 className="mr-2 h-4 w-4" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {editingId ? 'Atualizar' : 'Salvar'}
          </Button>
          
          {/* Botão Excluir - apenas admin no modo edição */}
          {isAdmin && editingId && (
            <Button
              onClick={() => setShowDeleteDialog(true)}
              disabled={isSaving || isDeleting}
              variant="destructive"
              className="h-10 px-4"
              size="default"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Dialog de duplicado */}
      <AlertDialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              Endereçamento já existe!
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Este código já está cadastrado neste endereço:</p>
              {enderecoExistente && (
                <div className="rounded-lg border border-border bg-muted p-3">
                  <p className="font-bold text-primary">{enderecoExistente.codigo}</p>
                  <p className="text-sm">{enderecoExistente.descricao}</p>
                  <p className="text-sm text-muted-foreground">
                    Endereço: {enderecoExistente.endereco_formatado}
                  </p>
                </div>
              )}
              <p>Você pode editar o registro existente.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleAbrirRegistroExistente}>
              <Edit2 className="mr-2 h-4 w-4" />
              Abrir registro existente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Tem certeza que deseja excluir este endereçamento?</p>
              <div className="rounded-lg border border-border bg-muted p-3">
                <p className="font-bold text-primary">{codigo}</p>
                <p className="text-sm">{descricao}</p>
                <p className="text-sm text-muted-foreground">
                  Endereço: {formatEndereco(parseInt(rua) || 0, parseInt(coluna) || 0, parseInt(nivel) || 0, parseInt(posicao) || 0)}
                </p>
              </div>
              <p className="text-destructive font-medium">Esta ação não pode ser desfeita!</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExcluir}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Enderecamento;
