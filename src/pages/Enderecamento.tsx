import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Save, Loader2 } from 'lucide-react';
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
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
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
  const { getProductByCode, appendData, isLoading: isLoadingSheet } = useGoogleSheets();
  
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
      const { data, error } = await supabase
        .from('fabricantes')
        .select('*')
        .order('nome');
      
      if (error) {
        console.error('Erro ao carregar fabricantes:', error);
      } else {
        setFabricantes(data || []);
      }
    };
    
    loadFabricantes();
  }, []);

  // Buscar descrição ao digitar código
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
      const product = await getProductByCode(codigo, 'Bdados');
      
      if (product) {
        setDescricao(product.descricao);
        toast({
          title: 'Sucesso',
          description: 'Descrição encontrada!',
        });
      } else {
        toast({
          title: 'Não encontrado',
          description: 'Material não encontrado na base de produtos',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao buscar descrição',
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
      // Buscar nome do fabricante
      const fabricanteSelecionado = fabricantes.find(f => f.id === fabricanteId);
      const nomeFabricante = fabricanteSelecionado?.nome || '';

      // Salvar no Supabase
      const { error } = await supabase
        .from('enderecos_materiais')
        .insert({
          codigo: codigo.trim(),
          descricao: descricao.trim(),
          tipo_material: tipoMaterial,
          fabricante_id: fabricanteId,
          peso: parseFloat(peso),
          rua: parseInt(rua),
          coluna: parseInt(coluna),
          nivel: parseInt(nivel),
          posicao: parseInt(posicao),
          comentario: comentario.trim() || null,
          created_by: user?.nome || 'Sistema',
        });

      if (error) throw error;

      // Salvar na planilha Google Sheets (aba ITENS_CADASTRO)
      // Formato: Código, Descrição, Tipo, Fabricante, Peso, Rua, Coluna, Nível, Posição, Data, Usuário
      const dataAtual = new Date().toLocaleString('pt-BR');
      const rowData = [
        codigo.trim(),
        descricao.trim(),
        tipoMaterial,
        nomeFabricante,
        peso,
        rua,
        coluna,
        nivel,
        posicao,
        dataAtual,
        user?.nome || 'Sistema'
      ];

      const sheetSuccess = await appendData('ITENS_CADASTRO', [rowData]);
      
      if (!sheetSuccess) {
        console.warn('Dados salvos no banco, mas houve erro ao salvar na planilha');
      }

      toast({
        title: 'Sucesso',
        description: sheetSuccess 
          ? 'Endereçamento salvo no banco e na planilha!' 
          : 'Salvo no banco, mas erro ao salvar na planilha',
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
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-border bg-card p-4">
        <button
          onClick={() => navigate('/')}
          className="rounded-lg p-2 hover:bg-accent"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <img src={logoImex} alt="IMEX Solutions" className="h-8" />
        <h1 className="text-lg font-bold">Endereçamento</h1>
      </div>

      {/* Form */}
      <div className="flex-1 space-y-4 p-4">
        {/* Código + Buscar */}
        <div className="space-y-2">
          <Label htmlFor="codigo">Código do Material *</Label>
          <div className="flex gap-2">
            <Input
              id="codigo"
              placeholder="Digite o código"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              inputMode="numeric"
              pattern="[0-9]*"
              className="flex-1"
            />
            <Button
              onClick={handleBuscarDescricao}
              disabled={isSearching || isLoadingSheet}
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

        {/* Descrição */}
        <div className="space-y-2">
          <Label htmlFor="descricao">Descrição *</Label>
          <Input
            id="descricao"
            placeholder="Descrição do material"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            readOnly
            className="bg-muted"
          />
        </div>

        {/* Tipo de Material */}
        <div className="space-y-2">
          <Label>Tipo de Material *</Label>
          <Select value={tipoMaterial} onValueChange={setTipoMaterial}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo" />
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

        {/* Fabricante */}
        <div className="space-y-2">
          <Label>Fabricante *</Label>
          <Select value={fabricanteId} onValueChange={setFabricanteId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o fabricante" />
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

        {/* Peso */}
        <div className="space-y-2">
          <Label htmlFor="peso">Peso (kg) *</Label>
          <Input
            id="peso"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={peso}
            onChange={(e) => setPeso(e.target.value)}
          />
        </div>

        {/* Endereço - Grid 2x2 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="rua">Rua *</Label>
            <Input
              id="rua"
              type="number"
              placeholder="Nº"
              value={rua}
              onChange={(e) => setRua(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="coluna">Coluna *</Label>
            <Input
              id="coluna"
              type="number"
              placeholder="Nº"
              value={coluna}
              onChange={(e) => setColuna(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nivel">Nível *</Label>
            <Input
              id="nivel"
              type="number"
              placeholder="Nº"
              value={nivel}
              onChange={(e) => setNivel(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="posicao">Posição *</Label>
            <Input
              id="posicao"
              type="number"
              placeholder="Nº"
              value={posicao}
              onChange={(e) => setPosicao(e.target.value)}
            />
          </div>
        </div>

        {/* Comentário */}
        <div className="space-y-2">
          <Label htmlFor="comentario">Comentário (opcional)</Label>
          <Input
            id="comentario"
            placeholder="Observações sobre o material"
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            maxLength={500}
          />
        </div>

        {/* Botão Salvar */}
        <Button
          onClick={handleSalvar}
          disabled={isSaving}
          className="mt-6 w-full"
          size="lg"
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
