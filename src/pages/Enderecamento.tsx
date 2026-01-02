import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Search } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { listFabricantes, getCatalogoDescricao, insertEndereco } from '@/hooks/useDataOperations';
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

const Enderecamento = () => {
  const navigate = useNavigate();
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
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      toast({
        title: 'Sucesso',
        description: 'Endereçamento salvo com sucesso!',
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

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header compacto */}
      <div className="flex items-center gap-3 border-b border-border bg-card px-3 py-2">
        <button
          onClick={() => navigate('/')}
          className="rounded-lg p-1.5 hover:bg-accent"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <img src={logoImex} alt="IMEX Solutions" className="h-6" />
        <h1 className="text-base font-bold">Endereçamento</h1>
      </div>

      {/* Form otimizado para mobile */}
      <div className="flex-1 space-y-3 p-3">
        {/* Código + Buscar - layout compacto */}
        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="codigo" className="text-xs">Código *</Label>
            <Input
              id="codigo"
              placeholder="Código"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleBuscarDescricao()}
              inputMode="numeric"
              pattern="[0-9]*"
              className="h-9"
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={handleBuscarDescricao}
              disabled={isSearching}
              variant="secondary"
              size="sm"
              className="h-9"
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Descrição */}
        <div>
          <Label htmlFor="descricao" className="text-xs">Descrição *</Label>
          <Input
            id="descricao"
            placeholder="Descrição do material"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="h-9"
          />
        </div>

        {/* Tipo + Fabricante - lado a lado */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Tipo *</Label>
            <Select value={tipoMaterial} onValueChange={setTipoMaterial}>
              <SelectTrigger className="h-9">
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
            <Label className="text-xs">Fabricante *</Label>
            <Select value={fabricanteId} onValueChange={setFabricanteId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Fabricante" />
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

        {/* Peso + Endereço - tudo em uma linha compacta */}
        <div className="grid grid-cols-5 gap-2">
          <div>
            <Label htmlFor="peso" className="text-xs">Peso(kg)*</Label>
            <Input
              id="peso"
              type="number"
              step="0.01"
              placeholder="0"
              value={peso}
              onChange={(e) => setPeso(e.target.value)}
              className="h-9"
            />
          </div>
          <div>
            <Label htmlFor="rua" className="text-xs">Rua *</Label>
            <Input
              id="rua"
              type="number"
              placeholder="Nº"
              value={rua}
              onChange={(e) => setRua(e.target.value)}
              className="h-9"
            />
          </div>
          <div>
            <Label htmlFor="coluna" className="text-xs">Coluna *</Label>
            <Input
              id="coluna"
              type="number"
              placeholder="Nº"
              value={coluna}
              onChange={(e) => setColuna(e.target.value)}
              className="h-9"
            />
          </div>
          <div>
            <Label htmlFor="nivel" className="text-xs">Nível *</Label>
            <Input
              id="nivel"
              type="number"
              placeholder="Nº"
              value={nivel}
              onChange={(e) => setNivel(e.target.value)}
              className="h-9"
            />
          </div>
          <div>
            <Label htmlFor="posicao" className="text-xs">Posição *</Label>
            <Input
              id="posicao"
              type="number"
              placeholder="Nº"
              value={posicao}
              onChange={(e) => setPosicao(e.target.value)}
              className="h-9"
            />
          </div>
        </div>

        {/* Comentário */}
        <div>
          <Label htmlFor="comentario" className="text-xs">Comentário (opcional)</Label>
          <Input
            id="comentario"
            placeholder="Observações"
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            maxLength={500}
            className="h-9"
          />
        </div>

        {/* Botão Salvar */}
        <Button
          onClick={handleSalvar}
          disabled={isSaving}
          className="w-full"
          size="default"
        >
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Salvar Endereçamento
        </Button>
      </div>
    </div>
  );
};

export default Enderecamento;