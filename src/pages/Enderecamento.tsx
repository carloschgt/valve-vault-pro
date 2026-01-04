import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Search, Edit2 } from 'lucide-react';
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
import { listFabricantes, getCatalogoDescricao, insertEndereco, checkEnderecoDuplicado, getEnderecoById } from '@/hooks/useDataOperations';
import { formatEndereco } from '@/utils/formatEndereco';
import logoImex from '@/assets/logo-imex.png';

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

const Enderecamento = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();
  
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

  // Buscar descrição no catálogo
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
        <h1 className="text-sm font-bold">
          {editingId ? 'Editar Endereçamento' : 'Endereçamento'}
        </h1>
      </div>

      {/* Form ultra compacto */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
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

        {/* Botão Salvar */}
        <Button
          onClick={handleSalvar}
          disabled={isSaving}
          className="w-full h-10"
          size="default"
        >
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : editingId ? (
            <Edit2 className="mr-2 h-4 w-4" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {editingId ? 'Atualizar Endereçamento' : 'Salvar Endereçamento'}
        </Button>
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
    </div>
  );
};

export default Enderecamento;
