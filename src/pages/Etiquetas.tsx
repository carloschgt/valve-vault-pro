import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, Loader2, Check, X, MapPin, Tag, Filter, QrCode, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { listRuasDisponiveis, listEnderecosByRua, getRuaFilters, consultaMaterial } from '@/hooks/useDataOperations';
import { QRCodeSVG } from 'qrcode.react';
import { QRScanner } from '@/components/QRScanner';
import logoImex from '@/assets/logo-imex.png';

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

interface RuaFilters {
  colunas: number[];
  niveis: number[];
  posicoes: number[];
}

interface MaterialConsulta {
  codigo: string;
  descricao: string;
  tipo_material: string;
  peso: number;
  fabricante: string;
  alocacao_principal: {
    id: string;
    endereco: string;
    rua: number;
    coluna: number;
    nivel: number;
    posicao: number;
    quantidade: number;
  };
  todas_alocacoes: Array<{
    id: string;
    endereco: string;
    rua: number;
    coluna: number;
    nivel: number;
    posicao: number;
    quantidade: number;
  }>;
  total_alocacoes: number;
  quantidade_total: number;
}

const Etiquetas = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);

  // Estado para controle de abas
  const [activeTab, setActiveTab] = useState('material');

  // Estados para etiquetas de material - Nova lógica por rua
  const [ruasDisponiveis, setRuasDisponiveis] = useState<number[]>([]);
  const [selectedRuaMaterial, setSelectedRuaMaterial] = useState<string>('');
  const [ruaFilters, setRuaFilters] = useState<RuaFilters>({ colunas: [], niveis: [], posicoes: [] });
  const [selectedColuna, setSelectedColuna] = useState<string>('');
  const [selectedNivel, setSelectedNivel] = useState<string>('');
  const [selectedPosicao, setSelectedPosicao] = useState<string>('');
  const [isLoadingRuas, setIsLoadingRuas] = useState(false);
  const [isLoadingFilters, setIsLoadingFilters] = useState(false);
  const [isLoadingEnderecos, setIsLoadingEnderecos] = useState(false);
  
  const [enderecos, setEnderecos] = useState<EnderecoMaterial[]>([]);
  const [selectedEnderecos, setSelectedEnderecos] = useState<Set<string>>(new Set());
  const [showPreview, setShowPreview] = useState(false);

  // Estados para identificação de rua
  const [selectedRua, setSelectedRua] = useState<string>('');

  // Estados para consulta de material via QR
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [materialConsulta, setMaterialConsulta] = useState<MaterialConsulta | null>(null);
  const [isLoadingConsulta, setIsLoadingConsulta] = useState(false);

  // Carregar ruas disponíveis ao montar
  useEffect(() => {
    loadRuasDisponiveis();
  }, []);

  // Carregar filtros quando selecionar rua para etiqueta de material
  useEffect(() => {
    if (selectedRuaMaterial) {
      loadRuaFilters(parseInt(selectedRuaMaterial));
    } else {
      setRuaFilters({ colunas: [], niveis: [], posicoes: [] });
      setSelectedColuna('');
      setSelectedNivel('');
      setSelectedPosicao('');
      setEnderecos([]);
      setSelectedEnderecos(new Set());
    }
  }, [selectedRuaMaterial]);

  // Buscar endereços quando mudar filtros
  useEffect(() => {
    if (selectedRuaMaterial) {
      loadEnderecosByFilters();
    }
  }, [selectedRuaMaterial, selectedColuna, selectedNivel, selectedPosicao]);

  const loadRuasDisponiveis = async () => {
    setIsLoadingRuas(true);
    try {
      const result = await listRuasDisponiveis();

      if (!result.success) {
        throw new Error(result.error || 'Erro ao buscar ruas');
      }

      setRuasDisponiveis(result.data || []);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível carregar as ruas disponíveis',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingRuas(false);
    }
  };

  const loadRuaFilters = async (rua: number) => {
    setIsLoadingFilters(true);
    try {
      const result = await getRuaFilters(rua);

      if (!result.success) {
        throw new Error(result.error || 'Erro ao buscar filtros');
      }

      setRuaFilters(result.data || { colunas: [], niveis: [], posicoes: [] });
      setSelectedColuna('');
      setSelectedNivel('');
      setSelectedPosicao('');
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível carregar os filtros',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingFilters(false);
    }
  };

  const loadEnderecosByFilters = async () => {
    if (!selectedRuaMaterial) return;
    
    setIsLoadingEnderecos(true);
    try {
      const result = await listEnderecosByRua(
        parseInt(selectedRuaMaterial),
        selectedColuna ? parseInt(selectedColuna) : undefined,
        selectedNivel ? parseInt(selectedNivel) : undefined,
        selectedPosicao ? parseInt(selectedPosicao) : undefined
      );

      if (!result.success) {
        throw new Error(result.error || 'Erro ao buscar endereços');
      }

      const formatted: EnderecoMaterial[] = (result.data || []).map((d: any) => ({
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

      setEnderecos(formatted);
      // Auto-select all active
      setSelectedEnderecos(new Set(formatted.filter(e => e.ativo).map(e => e.id)));
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao buscar endereços',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingEnderecos(false);
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
    const activeIds = enderecos.filter(e => e.ativo).map(e => e.id);
    setSelectedEnderecos(new Set(activeIds));
  };

  const deselectAll = () => {
    setSelectedEnderecos(new Set());
  };

  const clearFilters = () => {
    setSelectedRuaMaterial('');
    setSelectedColuna('');
    setSelectedNivel('');
    setSelectedPosicao('');
    setEnderecos([]);
    setSelectedEnderecos(new Set());
  };

  const formatEndereco = (e: EnderecoMaterial) => {
    return `R${String(e.rua).padStart(2, '0')}.C${String(e.coluna).padStart(2, '0')}.N${String(e.nivel).padStart(2, '0')}.P${String(e.posicao).padStart(2, '0')}`;
  };

  const getEtiquetasData = (): EtiquetaData[] => {
    return enderecos
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

  // Handler para leitura do QR Code
  const handleQRScan = async (data: string) => {
    setShowQRScanner(false);
    setIsLoadingConsulta(true);
    
    try {
      // Tentar parsear como JSON (QR da etiqueta de material)
      let codigo: string | null = null;
      let endereco: string | null = null;

      try {
        const parsed = JSON.parse(data);
        codigo = parsed.cod || parsed.codigo;
        endereco = parsed.end || parsed.endereco;
      } catch {
        // Se não for JSON, tratar como código simples
        codigo = data;
      }

      if (!codigo) {
        toast({
          title: 'QR inválido',
          description: 'Não foi possível identificar o código do material',
          variant: 'destructive',
        });
        return;
      }

      const result = await consultaMaterial(codigo, endereco || undefined);

      if (!result.success || !result.data) {
        toast({
          title: 'Material não encontrado',
          description: result.error || 'O código não foi encontrado no sistema',
          variant: 'destructive',
        });
        setMaterialConsulta(null);
        return;
      }

      setMaterialConsulta(result.data);

      // Se tiver endereço no QR, filtrar automaticamente
      if (endereco) {
        const alocPrincipal = result.data.alocacao_principal;
        setSelectedRuaMaterial(String(alocPrincipal.rua));
        // Os filtros serão carregados automaticamente pelo useEffect
      }

    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao consultar material',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingConsulta(false);
    }
  };

  const formatEnderecoFromAlocacao = (aloc: { rua: number; coluna: number; nivel: number; posicao: number }) => {
    return `R${String(aloc.rua).padStart(2, '0')}.C${String(aloc.coluna).padStart(2, '0')}.N${String(aloc.nivel).padStart(2, '0')}.P${String(aloc.posicao).padStart(2, '0')}`;
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
              {/* Botão de Consulta via QR */}
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-foreground">Consultar Material</h3>
                      <p className="text-sm text-muted-foreground">
                        Escaneie o QR da etiqueta para ver saldo e alocações
                      </p>
                    </div>
                    <Button 
                      onClick={() => setShowQRScanner(true)} 
                      variant="default"
                      disabled={isLoadingConsulta}
                    >
                      {isLoadingConsulta ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <QrCode className="mr-2 h-4 w-4" />
                      )}
                      Ler QR
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Resultado da Consulta de Material */}
              {materialConsulta && (
                <Card className="border-2 border-primary/50">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-lg text-foreground">
                        {materialConsulta.codigo}
                      </h3>
                      <Button variant="ghost" size="sm" onClick={() => setMaterialConsulta(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {materialConsulta.descricao}
                    </p>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Fabricante:</span>
                        <p className="font-medium">{materialConsulta.fabricante}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Tipo:</span>
                        <p className="font-medium">{materialConsulta.tipo_material}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Peso Unit.:</span>
                        <p className="font-medium">{materialConsulta.peso} kg</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Qtde Total:</span>
                        <p className="font-bold text-primary">{materialConsulta.quantidade_total}</p>
                      </div>
                    </div>

                    {/* Alerta de múltiplas alocações */}
                    {materialConsulta.total_alocacoes > 1 && (
                      <div className="flex items-center gap-2 rounded-lg bg-mrx-warning/10 border border-mrx-warning/30 p-3">
                        <AlertTriangle className="h-5 w-5 text-mrx-warning flex-shrink-0" />
                        <p className="text-sm font-medium text-mrx-warning">
                          Atenção: Este item tem saldo em {materialConsulta.total_alocacoes} alocações diferentes!
                        </p>
                      </div>
                    )}

                    {/* Lista de alocações */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground">
                        {materialConsulta.total_alocacoes === 1 ? 'Alocação:' : 'Alocações:'}
                      </h4>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {materialConsulta.todas_alocacoes.map((aloc) => (
                          <div 
                            key={aloc.id}
                            className={`flex items-center justify-between rounded-lg border p-2 ${
                              aloc.id === materialConsulta.alocacao_principal.id 
                                ? 'border-primary bg-primary/10' 
                                : 'border-border bg-muted/50'
                            }`}
                          >
                            <span className="font-mono text-sm font-medium">
                              {formatEnderecoFromAlocacao(aloc)}
                            </span>
                            <span className={`font-bold ${aloc.quantidade > 0 ? 'text-mrx-success' : 'text-muted-foreground'}`}>
                              {aloc.quantidade} un
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Filtros por Rua */}
              <Card>
                <CardContent className="p-4 space-y-4">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      1. Selecione a Rua
                    </label>
                    <Select value={selectedRuaMaterial} onValueChange={setSelectedRuaMaterial} disabled={isLoadingRuas}>
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
                  </div>

                  {/* Filtros opcionais */}
                  {selectedRuaMaterial && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Filter className="h-4 w-4" />
                        <span>Filtros opcionais (para refinar a busca):</span>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">Coluna</label>
                          <Select value={selectedColuna || "_all"} onValueChange={(v) => setSelectedColuna(v === "_all" ? "" : v)} disabled={isLoadingFilters}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Todas" />
                            </SelectTrigger>
                            <SelectContent className="bg-card border border-border z-50">
                              <SelectItem value="_all">Todas</SelectItem>
                              {ruaFilters.colunas.map((coluna) => (
                                <SelectItem key={coluna} value={String(coluna)}>
                                  C{String(coluna).padStart(2, '0')}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">Nível</label>
                          <Select value={selectedNivel || "_all"} onValueChange={(v) => setSelectedNivel(v === "_all" ? "" : v)} disabled={isLoadingFilters}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Todos" />
                            </SelectTrigger>
                            <SelectContent className="bg-card border border-border z-50">
                              <SelectItem value="_all">Todos</SelectItem>
                              {ruaFilters.niveis.map((nivel) => (
                                <SelectItem key={nivel} value={String(nivel)}>
                                  N{String(nivel).padStart(2, '0')}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">Posição</label>
                          <Select value={selectedPosicao || "_all"} onValueChange={(v) => setSelectedPosicao(v === "_all" ? "" : v)} disabled={isLoadingFilters}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Todas" />
                            </SelectTrigger>
                            <SelectContent className="bg-card border border-border z-50">
                              <SelectItem value="_all">Todas</SelectItem>
                              {ruaFilters.posicoes.map((posicao) => (
                                <SelectItem key={posicao} value={String(posicao)}>
                                  P{String(posicao).padStart(2, '0')}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedRuaMaterial && (
                    <Button variant="outline" size="sm" onClick={clearFilters} className="w-full">
                      <X className="mr-1 h-3 w-3" />
                      Limpar Filtros
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Loading state */}
              {isLoadingEnderecos && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="ml-2 text-muted-foreground">Carregando endereços...</span>
                </div>
              )}

              {/* Selected Items Summary */}
              {!isLoadingEnderecos && enderecos.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {selectedEnderecos.size} de {enderecos.filter(e => e.ativo).length} selecionado(s)
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={selectAll}>
                        <Check className="mr-1 h-3 w-3" />
                        Todos
                      </Button>
                      <Button variant="outline" size="sm" onClick={deselectAll}>
                        <X className="mr-1 h-3 w-3" />
                        Nenhum
                      </Button>
                    </div>
                  </div>

                  <div className="flex-1 space-y-2 overflow-auto">
                    {enderecos.map((endereco) => (
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

              {/* Empty state */}
              {!isLoadingEnderecos && selectedRuaMaterial && enderecos.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Tag className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">Nenhum endereço encontrado com os filtros selecionados.</p>
                </div>
              )}

              {/* Initial state */}
              {!selectedRuaMaterial && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <MapPin className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">Selecione uma rua para visualizar os endereços disponíveis.</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    A etiqueta identifica a posição de alocação do material no rack.
                  </p>
                </div>
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
              <div ref={printRef} className="flex-1 bg-white p-4 overflow-auto">
                <div className="mx-auto flex flex-col items-center gap-6">
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

      {/* QR Scanner Modal */}
      {showQRScanner && (
        <QRScanner
          onScan={handleQRScan}
          onClose={() => setShowQRScanner(false)}
        />
      )}
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
    <div 
      className="flex flex-col rounded-lg border-2 border-gray-800 bg-white p-3"
      style={{ 
        width: '128mm',
        height: '80mm',
      }}
    >
      {/* Header with Logo and Procedure */}
      <div className="mb-2 flex items-center justify-between border-b border-gray-300 pb-1">
        <img src={logoImex} alt="IMEX" className="h-6" />
        <div className="text-center">
          <span className="text-[8px] font-medium text-gray-600">F03/01 - 8.5.2-01</span>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold text-gray-900">{data.endereco}</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 gap-3">
        {/* QR Code */}
        <div className="flex flex-col items-center justify-center">
          <div className="rounded border border-gray-200 bg-white p-1">
            <QRCodeSVG
              value={qrData}
              size={70}
              level="M"
              bgColor="#ffffff"
              fgColor="#000000"
            />
          </div>
          <span className="mt-1 text-[8px] text-gray-500">Escaneie para info</span>
        </div>

        {/* Info */}
        <div className="flex flex-1 flex-col justify-center space-y-0.5">
          <div className="rounded-lg bg-gray-100 px-2 py-1">
            <label className="text-[8px] font-bold uppercase text-gray-500">
              Código
            </label>
            <p className="text-4xl font-black tracking-wider text-gray-900">{data.codigo}</p>
          </div>
          
          <div>
            <label className="text-[8px] font-medium uppercase text-gray-500">
              Descrição
            </label>
            <p className="text-[10px] font-medium text-gray-800 line-clamp-2">
              {data.descricao}
            </p>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[8px] font-medium uppercase text-gray-500">
                Fabricante
              </label>
              <p className="text-[10px] font-semibold text-gray-800">
                {data.fabricante}
              </p>
            </div>
            <div className="flex-1">
              <label className="text-[8px] font-medium uppercase text-gray-500">
                Tipo
              </label>
              <p className="text-[10px] font-semibold text-gray-800">
                {data.tipoMaterial}
              </p>
            </div>
            <div className="flex-1">
              <label className="text-[8px] font-medium uppercase text-gray-500">
                Peso Unitário
              </label>
              <p className="text-[10px] font-semibold text-gray-800">
                {data.peso} kg
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-1 border-t border-gray-300 pt-1 text-center">
        <p className="text-[7px] text-gray-500">
          IMEX SOLUTIONS - Sistema de Gerenciamento de Materiais
        </p>
      </div>
    </div>
  );
};

export default Etiquetas;
