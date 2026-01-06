import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Printer, QrCode, Loader2, Check, X, Plus, MapPin, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InputUppercase } from '@/components/ui/input-uppercase';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { listEnderecos } from '@/hooks/useDataOperations';
import { QRCodeSVG } from 'qrcode.react';
import logoImex from '@/assets/logo-imex.png';
import { supabase } from '@/integrations/supabase/client';

interface EnderecoMaterial {
  id: string;
  codigo: string;
  descricao: string;
  tipo_material: string;
  peso: number;
  rua: number;
  coluna: number;
  nivel: number;
  posicao: number;
  fabricante_nome: string;
  ativo: boolean;
}

interface EtiquetaData {
  codigo: string;
  descricao: string;
  fabricante: string;
  tipoMaterial: string;
  endereco: string;
  peso: number;
}

const Etiquetas = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);

  // Estado para controle de abas
  const [activeTab, setActiveTab] = useState('material');

  // Estados para etiquetas de material
  const [searchCode, setSearchCode] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [enderecos, setEnderecos] = useState<EnderecoMaterial[]>([]);
  const [allEnderecos, setAllEnderecos] = useState<EnderecoMaterial[]>([]);
  const [selectedEnderecos, setSelectedEnderecos] = useState<Set<string>>(new Set());
  const [showPreview, setShowPreview] = useState(false);

  // Estados para identificação de rua
  const [ruasDisponiveis, setRuasDisponiveis] = useState<number[]>([]);
  const [selectedRua, setSelectedRua] = useState<string>('');
  const [isLoadingRuas, setIsLoadingRuas] = useState(false);

  // Carregar ruas disponíveis ao montar ou trocar para aba de rua
  useEffect(() => {
    if (activeTab === 'rua') {
      loadRuasDisponiveis();
    }
  }, [activeTab]);

  const loadRuasDisponiveis = async () => {
    setIsLoadingRuas(true);
    try {
      const { data, error } = await supabase
        .from('enderecos_materiais')
        .select('rua')
        .eq('ativo', true);

      if (error) throw error;

      // Extrair ruas únicas e ordenar
      const ruasUnicas = [...new Set(data?.map(d => d.rua) || [])].sort((a, b) => a - b);
      setRuasDisponiveis(ruasUnicas);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as ruas disponíveis',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingRuas(false);
    }
  };

  const handleSearch = async () => {
    if (!searchCode.trim()) {
      toast({
        title: 'Atenção',
        description: 'Digite o código do material',
        variant: 'destructive',
      });
      return;
    }

    setIsSearching(true);

    try {
      const result = await listEnderecos(searchCode.trim());
      
      if (!result.success) {
        throw new Error(result.error || 'Erro ao buscar endereços');
      }

      if (!result.data || result.data.length === 0) {
        toast({
          title: 'Não encontrado',
          description: 'Nenhum endereço encontrado com esse código',
          variant: 'destructive',
        });
        return;
      }

      const formatted: EnderecoMaterial[] = result.data.map((d: any) => ({
        id: d.id,
        codigo: d.codigo,
        descricao: d.descricao,
        tipo_material: d.tipo_material,
        peso: d.peso,
        rua: d.rua,
        coluna: d.coluna,
        nivel: d.nivel,
        posicao: d.posicao,
        fabricante_nome: d.fabricantes?.nome || 'N/A',
        ativo: d.ativo,
      }));

      // Adicionar os novos resultados aos já existentes (sem duplicar)
      const existingIds = new Set(allEnderecos.map(e => e.id));
      const newEnderecos = formatted.filter(e => !existingIds.has(e.id));
      const updatedAll = [...allEnderecos, ...newEnderecos];
      
      setAllEnderecos(updatedAll);
      setEnderecos(formatted);
      
      // Selecionar automaticamente os novos ativos
      const newActiveIds = newEnderecos.filter(e => e.ativo).map(e => e.id);
      setSelectedEnderecos(prev => {
        const updated = new Set(prev);
        newActiveIds.forEach(id => updated.add(id));
        return updated;
      });

      toast({
        title: 'Sucesso',
        description: `${formatted.length} endereço(s) encontrado(s)${newEnderecos.length > 0 ? `, ${newEnderecos.length} novo(s) adicionado(s)` : ''}`,
      });
      
      setSearchCode('');
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao buscar endereços',
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedEnderecos);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedEnderecos(newSelection);
  };

  const selectAll = () => {
    const activeIds = allEnderecos.filter(e => e.ativo).map(e => e.id);
    setSelectedEnderecos(new Set(activeIds));
  };

  const deselectAll = () => {
    setSelectedEnderecos(new Set());
  };

  const clearAll = () => {
    setAllEnderecos([]);
    setEnderecos([]);
    setSelectedEnderecos(new Set());
  };

  const formatEndereco = (e: EnderecoMaterial) => {
    return `R${String(e.rua).padStart(2, '0')}.C${String(e.coluna).padStart(2, '0')}.N${String(e.nivel).padStart(2, '0')}.P${String(e.posicao).padStart(2, '0')}`;
  };

  const getEtiquetasData = (): EtiquetaData[] => {
    return allEnderecos
      .filter(e => selectedEnderecos.has(e.id))
      .map(e => ({
        codigo: e.codigo,
        descricao: e.descricao,
        fabricante: e.fabricante_nome,
        tipoMaterial: e.tipo_material,
        endereco: formatEndereco(e),
        peso: e.peso,
      }));
  };

  const handlePrint = () => {
    if (selectedEnderecos.size === 0) {
      toast({
        title: 'Atenção',
        description: 'Selecione pelo menos um endereço',
        variant: 'destructive',
      });
      return;
    }
    setShowPreview(true);
  };

  // Open dedicated print page for material labels
  const openPrintPage = () => {
    const etiquetas = getEtiquetasData();
    const dataParam = encodeURIComponent(JSON.stringify(etiquetas));
    navigate(`/etiquetas/print?data=${dataParam}`);
  };

  // Open dedicated print page for street identification
  const openRuaPrintPage = () => {
    if (!selectedRua) {
      toast({
        title: 'Atenção',
        description: 'Selecione uma rua',
        variant: 'destructive',
      });
      return;
    }
    navigate(`/etiquetas/identificacao-rua?rua=${selectedRua}`);
  };

  const etiquetas = getEtiquetasData();

  // URL para preview do QR
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const qrUrlPreview = selectedRua ? `${baseUrl}/estoque-rua?rua=${selectedRua}` : '';
  const ruaFormatada = selectedRua ? `R${selectedRua.toString().padStart(2, '0')}` : '';

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-border bg-card p-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-lg font-bold text-foreground">Gerar Etiquetas</h1>
          <p className="text-sm text-muted-foreground">Etiquetas de material e identificação de rua</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="border-b border-border bg-card px-4">
          <TabsList className="h-12 w-full justify-start gap-4 bg-transparent p-0">
            <TabsTrigger 
              value="material" 
              className="flex items-center gap-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
            >
              <Tag className="h-4 w-4" />
              Etiqueta de Material
            </TabsTrigger>
            <TabsTrigger 
              value="rua" 
              className="flex items-center gap-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
            >
              <MapPin className="h-4 w-4" />
              Identificação de Rua (A4)
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab: Etiqueta de Material */}
        <TabsContent value="material" className="flex-1 flex flex-col m-0">
          {!showPreview ? (
            <div className="flex flex-1 flex-col gap-4 p-4">
              {/* Search */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex gap-2">
                    <InputUppercase
                      placeholder="Digite o código do material"
                      value={searchCode}
                      onChange={(e) => setSearchCode(e.target.value.replace(/\D/g, ''))}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="flex-1"
                    />
                    <Button onClick={handleSearch} disabled={isSearching}>
                      {isSearching ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Você pode buscar vários códigos. Cada busca adiciona à lista de seleção.
                  </p>
                </CardContent>
              </Card>

              {/* Selected Items Summary */}
              {allEnderecos.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {selectedEnderecos.size} de {allEnderecos.filter(e => e.ativo).length} selecionado(s)
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={selectAll}>
                        <Check className="mr-1 h-3 w-3" />
                        Todos
                      </Button>
                      <Button variant="outline" size="sm" onClick={deselectAll}>
                        <X className="mr-1 h-3 w-3" />
                        Limpar
                      </Button>
                      <Button variant="destructive" size="sm" onClick={clearAll}>
                        <X className="mr-1 h-3 w-3" />
                        Resetar
                      </Button>
                    </div>
                  </div>

                  <div className="flex-1 space-y-2 overflow-auto">
                    {allEnderecos.map((endereco) => (
                      <Card
                        key={endereco.id}
                        className={`cursor-pointer transition-all ${
                          !endereco.ativo 
                            ? 'opacity-50 bg-muted' 
                            : selectedEnderecos.has(endereco.id)
                              ? 'border-primary bg-primary/5'
                              : ''
                        }`}
                        onClick={() => endereco.ativo && toggleSelection(endereco.id)}
                      >
                        <CardContent className="flex items-center gap-3 p-3">
                          <Checkbox
                            checked={selectedEnderecos.has(endereco.id)}
                            disabled={!endereco.ativo}
                            onCheckedChange={() => toggleSelection(endereco.id)}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-primary">
                                {endereco.codigo}
                              </span>
                              {!endereco.ativo && (
                                <span className="text-xs text-destructive">(INATIVO)</span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {endereco.descricao}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-2 text-xs">
                              <span className="rounded bg-secondary px-2 py-0.5">
                                {formatEndereco(endereco)}
                              </span>
                              <span className="rounded bg-muted px-2 py-0.5">
                                {endereco.fabricante_nome}
                              </span>
                              <span className="rounded bg-muted px-2 py-0.5">
                                {endereco.tipo_material}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handlePrint}
                    disabled={selectedEnderecos.size === 0}
                  >
                    <Printer className="mr-2 h-5 w-5" />
                    Gerar Etiquetas ({selectedEnderecos.size})
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-1 flex-col">
              {/* Print Preview Controls */}
              <div className="flex items-center justify-between border-b border-border bg-card p-4">
                <Button variant="outline" onClick={() => setShowPreview(false)}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar
                </Button>
                <Button onClick={openPrintPage}>
                  <Printer className="mr-2 h-4 w-4" />
                  Abrir para Impressão
                </Button>
              </div>

              {/* Print Preview */}
              <div ref={printRef} className="flex-1 bg-white p-4">
                <div className="mx-auto grid max-w-[210mm] grid-cols-2 gap-4">
                  {etiquetas.map((etiqueta, index) => (
                    <EtiquetaCard key={index} data={etiqueta} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Tab: Identificação de Rua */}
        <TabsContent value="rua" className="flex-1 flex flex-col m-0">
          <div className="flex flex-1 flex-col gap-4 p-4">
            {/* Seleção de Rua */}
            <Card>
              <CardContent className="p-4">
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Selecione a Rua
                </label>
                <Select value={selectedRua} onValueChange={setSelectedRua} disabled={isLoadingRuas}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={isLoadingRuas ? "Carregando..." : "Selecione uma rua"} />
                  </SelectTrigger>
                  <SelectContent className="bg-card border border-border z-50">
                    {ruasDisponiveis.map((rua) => (
                      <SelectItem key={rua} value={String(rua)}>
                        Rua {String(rua).padStart(2, '0')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-2 text-xs text-muted-foreground">
                  Gera uma identificação A4 com QR code para consulta de materiais da rua.
                </p>
              </CardContent>
            </Card>

            {/* Preview */}
            {selectedRua && (
              <Card className="flex-1">
                <CardContent className="p-4">
                  <h3 className="text-sm font-medium text-muted-foreground mb-4">
                    Pré-visualização
                  </h3>
                  
                  {/* Mini Preview */}
                  <div className="mx-auto max-w-sm border-2 border-dashed border-border rounded-lg bg-white p-6">
                    <div className="flex flex-col items-center text-center">
                      {/* Logo */}
                      <img src={logoImex} alt="IMEX" className="h-8 mb-4" />
                      
                      {/* Título */}
                      <h2 className="text-4xl font-black text-gray-900 mb-1">RUA</h2>
                      <h2 className="text-5xl font-black text-gray-900 mb-4">{ruaFormatada}</h2>
                      
                      {/* QR Code Preview */}
                      <div className="border-2 border-gray-800 rounded p-2 bg-white">
                        <QRCodeSVG
                          value={qrUrlPreview}
                          size={100}
                          level="H"
                          bgColor="#ffffff"
                          fgColor="#000000"
                        />
                      </div>
                      
                      <p className="mt-3 text-xs text-gray-600">
                        Escaneie para consultar os materiais
                      </p>
                      
                      <div className="mt-4 pt-3 border-t border-gray-200 w-full">
                        <p className="text-[10px] text-gray-400">
                          Desenvolvido por Carlos Teixeira
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="mt-4 text-center text-xs text-muted-foreground">
                    O documento final será em tamanho A4 com fontes grandes para visualização a distância.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Botão de Impressão */}
            <Button
              className="w-full"
              size="lg"
              onClick={openRuaPrintPage}
              disabled={!selectedRua}
            >
              <Printer className="mr-2 h-5 w-5" />
              Gerar Identificação A4
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

interface EtiquetaCardProps {
  data: EtiquetaData;
}

const EtiquetaCard = ({ data }: EtiquetaCardProps) => {
  // QR contém código + endereço formatado para identificação única
  const qrData = JSON.stringify({
    cod: data.codigo,
    end: data.endereco, // Formato Rxx.Cxx.Nxx.Pxx
    desc: data.descricao.substring(0, 50),
    fab: data.fabricante,
    tipo: data.tipoMaterial,
    peso: data.peso,
  });

  return (
    <div className="flex h-[120mm] w-full flex-col rounded-lg border-2 border-border bg-white p-4">
      {/* Header with Logo */}
      <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
        <img src={logoImex} alt="IMEX" className="h-8" />
        <div className="text-right">
          <div className="text-2xl font-bold text-primary">{data.endereco}</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 gap-4">
        {/* QR Code */}
        <div className="flex flex-col items-center justify-center">
          <QRCodeSVG
            value={qrData}
            size={100}
            level="M"
          />
          <span className="mt-1 text-[10px] text-muted-foreground">Escaneie para info</span>
        </div>

        {/* Info */}
        <div className="flex flex-1 flex-col justify-center space-y-2">
          <div>
            <label className="text-[10px] font-medium uppercase text-muted-foreground">
              Código
            </label>
            <p className="text-xl font-bold text-foreground">{data.codigo}</p>
          </div>
          
          <div>
            <label className="text-[10px] font-medium uppercase text-muted-foreground">
              Descrição
            </label>
            <p className="text-sm font-medium text-foreground line-clamp-2">
              {data.descricao}
            </p>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-[10px] font-medium uppercase text-muted-foreground">
                Fabricante
              </label>
              <p className="text-sm font-semibold text-foreground">
                {data.fabricante}
              </p>
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-medium uppercase text-muted-foreground">
                Tipo
              </label>
              <p className="text-sm font-semibold text-foreground">
                {data.tipoMaterial}
              </p>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-medium uppercase text-muted-foreground">
              Peso
            </label>
            <p className="text-sm font-semibold text-foreground">
              {data.peso} kg
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-2 border-t border-border pt-2 text-center">
        <p className="text-[9px] text-muted-foreground">
          IMEX SOLUTIONS - Sistema de Gerenciamento de Materiais
        </p>
      </div>
    </div>
  );
};

export default Etiquetas;
