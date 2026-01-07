import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Settings, Loader2, Save, AlertTriangle, CheckCircle, 
  Plus, Trash2, FileSpreadsheet, Printer, Filter, ChevronDown, ChevronUp, Eye, EyeOff 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { 
  getInventarioConfig, 
  updateInventarioConfig,
  listRuasDisponiveis,
  listInventarioConfigRua,
  upsertInventarioConfigRua,
  deleteInventarioConfigRua,
  listInventarioSelecao,
  addInventarioSelecao,
  removeInventarioSelecao,
  clearInventarioSelecao,
  getInventarioDivergencias,
  exportInventarioCompleto,
  listEnderecosByRua
} from '@/hooks/useDataOperations';
import { Skeleton } from '@/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatEndereco } from '@/utils/formatEndereco';
import * as XLSX from 'xlsx';
import logoImex from '@/assets/logo-imex.png';

interface RuaConfig {
  rua: number;
  contagem_ativa: number;
  updated_by?: string;
  updated_at?: string;
}

interface Divergencia {
  endereco_material_id: string;
  codigo: string;
  descricao: string;
  rua: number;
  coluna: number;
  nivel: number;
  posicao: number;
  tipo_material: string;
  fabricante_nome: string | null;
  quantidade_1: number | null;
  quantidade_2: number | null;
  quantidade_3: number | null;
  diferenca: number;
}

interface EnderecoMaterial {
  id: string;
  codigo: string;
  descricao: string;
  rua: number;
  coluna: number;
  nivel: number;
  posicao: number;
  tipo_material: string;
  fabricantes?: { nome: string };
}

interface Selecao {
  id: string;
  endereco_material_id: string;
  contagem_num: number;
  rua: number;
  enderecos_materiais: EnderecoMaterial;
}

const ControleInventario = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Global config
  const [contagemAtiva, setContagemAtiva] = useState<number>(1);
  const [bloquearVisualizacaoEstoque, setBloquearVisualizacaoEstoque] = useState<boolean>(false);
  const [lastUpdatedBy, setLastUpdatedBy] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  
  // Ruas disponíveis
  const [ruasDisponiveis, setRuasDisponiveis] = useState<number[]>([]);
  const [ruaConfigs, setRuaConfigs] = useState<RuaConfig[]>([]);
  
  // Per-rua config
  const [selectedRuaConfig, setSelectedRuaConfig] = useState<number | null>(null);
  const [ruaContagemSelecionada, setRuaContagemSelecionada] = useState<number>(1);
  const [isSavingRua, setIsSavingRua] = useState(false);
  
  // Selection of items
  const [selectionRua, setSelectionRua] = useState<number | null>(null);
  const [selectionContagem, setSelectionContagem] = useState<number>(2);
  const [enderecosRua, setEnderecosRua] = useState<EnderecoMaterial[]>([]);
  const [selecoes, setSelecoes] = useState<Selecao[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isLoadingEnderecos, setIsLoadingEnderecos] = useState(false);
  const [isAddingSelection, setIsAddingSelection] = useState(false);
  
  // Divergências
  const [divergencias, setDivergencias] = useState<Divergencia[]>([]);
  const [divergenciaRua, setDivergenciaRua] = useState<number | null>(null);
  const [isLoadingDivergencias, setIsLoadingDivergencias] = useState(false);
  const [selectedDivergencias, setSelectedDivergencias] = useState<Set<string>>(new Set());
  
  // Export
  const [isExporting, setIsExporting] = useState(false);
  
  // Collapsed sections
  const [expandedSection, setExpandedSection] = useState<string>('global');

  const isAdmin = user?.tipo === 'admin';

  useEffect(() => {
    if (!authLoading && user) {
      setPermissionsLoaded(true);
      if (user.tipo === 'admin') {
        loadAllData();
      }
    }
  }, [authLoading, user]);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [configResult, ruasResult, ruaConfigsResult] = await Promise.all([
        getInventarioConfig(),
        listRuasDisponiveis(),
        listInventarioConfigRua()
      ]);
      
      if (configResult.success && configResult.data) {
        setContagemAtiva(configResult.data.contagem_ativa || 1);
        setBloquearVisualizacaoEstoque(configResult.data.bloquear_visualizacao_estoque || false);
        setLastUpdatedBy(configResult.data.updated_by);
        setLastUpdatedAt(configResult.data.updated_at);
      }
      
      if (ruasResult.success && ruasResult.data) {
        setRuasDisponiveis(ruasResult.data);
      }
      
      if (ruaConfigsResult.success && ruaConfigsResult.data) {
        setRuaConfigs(ruaConfigsResult.data);
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao carregar configuração',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSalvarGlobal = async () => {
    if (!isAdmin) return;
    
    setIsSaving(true);
    try {
      const result = await updateInventarioConfig(contagemAtiva);

      if (!result.success) {
        throw new Error(result.error);
      }

      setLastUpdatedBy(user?.nome || null);
      setLastUpdatedAt(new Date().toISOString());

      toast({
        title: 'Sucesso',
        description: `Contagem ${contagemAtiva} definida como ativa globalmente!`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao salvar configuração',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSalvarRuaConfig = async () => {
    if (!isAdmin || !selectedRuaConfig) return;
    
    setIsSavingRua(true);
    try {
      const result = await upsertInventarioConfigRua(selectedRuaConfig, ruaContagemSelecionada);

      if (!result.success) {
        throw new Error(result.error);
      }

      // Reload rua configs
      const ruaConfigsResult = await listInventarioConfigRua();
      if (ruaConfigsResult.success) {
        setRuaConfigs(ruaConfigsResult.data || []);
      }

      toast({
        title: 'Sucesso',
        description: `Rua ${selectedRuaConfig} configurada para Contagem ${ruaContagemSelecionada}!`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao salvar configuração da rua',
        variant: 'destructive',
      });
    } finally {
      setIsSavingRua(false);
    }
  };

  const handleRemoverRuaConfig = async (rua: number) => {
    if (!isAdmin) return;
    
    try {
      const result = await deleteInventarioConfigRua(rua);

      if (!result.success) {
        throw new Error(result.error);
      }

      setRuaConfigs(prev => prev.filter(c => c.rua !== rua));

      toast({
        title: 'Sucesso',
        description: `Configuração da Rua ${rua} removida. Usará a configuração global.`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao remover configuração',
        variant: 'destructive',
      });
    }
  };

  const loadEnderecosParaSelecao = async () => {
    if (!selectionRua) return;
    
    setIsLoadingEnderecos(true);
    try {
      const [enderecosResult, selecoesResult] = await Promise.all([
        listEnderecosByRua(selectionRua),
        listInventarioSelecao(selectionContagem, selectionRua)
      ]);
      
      if (enderecosResult.success) {
        setEnderecosRua(enderecosResult.data || []);
      }
      
      if (selecoesResult.success) {
        setSelecoes(selecoesResult.data || []);
        // Mark already selected items
        const selectedIds = new Set<string>((selecoesResult.data || []).map((s: Selecao) => s.endereco_material_id));
        setSelectedItems(selectedIds);
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao carregar endereços',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingEnderecos(false);
    }
  };

  useEffect(() => {
    if (selectionRua && selectionContagem) {
      loadEnderecosParaSelecao();
    }
  }, [selectionRua, selectionContagem]);

  const handleToggleItem = (id: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedItems.size === enderecosRua.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(enderecosRua.map(e => e.id)));
    }
  };

  const handleAdicionarSelecao = async () => {
    if (!selectionRua || selectedItems.size === 0) return;
    
    setIsAddingSelection(true);
    try {
      // Get only newly selected items (not already in selecoes)
      const existingIds = new Set(selecoes.map(s => s.endereco_material_id));
      const newIds = Array.from(selectedItems).filter(id => !existingIds.has(id));
      
      if (newIds.length === 0) {
        toast({
          title: 'Atenção',
          description: 'Todos os itens selecionados já estão na lista',
        });
        return;
      }

      const result = await addInventarioSelecao(newIds, selectionContagem, selectionRua);

      if (!result.success) {
        throw new Error(result.error);
      }

      // Reload selections
      await loadEnderecosParaSelecao();

      toast({
        title: 'Sucesso',
        description: `${newIds.length} item(s) adicionado(s) à seleção!`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao adicionar seleção',
        variant: 'destructive',
      });
    } finally {
      setIsAddingSelection(false);
    }
  };

  const handleRemoverSelecao = async (id: string) => {
    try {
      const result = await removeInventarioSelecao(id);

      if (!result.success) {
        throw new Error(result.error);
      }

      setSelecoes(prev => prev.filter(s => s.id !== id));
      
      toast({
        title: 'Sucesso',
        description: 'Item removido da seleção',
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao remover item',
        variant: 'destructive',
      });
    }
  };

  const handleLimparSelecao = async () => {
    if (!selectionRua) return;
    
    try {
      const result = await clearInventarioSelecao(selectionContagem, selectionRua);

      if (!result.success) {
        throw new Error(result.error);
      }

      setSelecoes([]);
      setSelectedItems(new Set());

      toast({
        title: 'Sucesso',
        description: 'Seleção limpa!',
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao limpar seleção',
        variant: 'destructive',
      });
    }
  };

  const loadDivergencias = async () => {
    setIsLoadingDivergencias(true);
    try {
      const result = await getInventarioDivergencias(divergenciaRua || undefined);
      
      if (result.success) {
        setDivergencias(result.data || []);
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao carregar divergências',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingDivergencias(false);
    }
  };

  useEffect(() => {
    if (expandedSection === 'divergencias') {
      loadDivergencias();
    }
  }, [expandedSection, divergenciaRua]);

  const handleExportarInventario = async () => {
    setIsExporting(true);
    try {
      const result = await exportInventarioCompleto();

      if (!result.success) {
        throw new Error(result.error);
      }

      // Create Excel
      const ws = XLSX.utils.json_to_sheet(result.data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Inventário Completo');
      
      const fileName = `inventario_completo_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast({
        title: 'Sucesso',
        description: 'Arquivo exportado com sucesso!',
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao exportar',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImprimirDivergencias = () => {
    const printContent = divergencias.map(d => ({
      Código: d.codigo,
      Descrição: d.descricao,
      Endereço: formatEndereco(d.rua, d.coluna, d.nivel, d.posicao),
      'Contagem 1': d.quantidade_1 ?? '-',
      'Contagem 2': d.quantidade_2 ?? '-',
      Diferença: d.diferenca
    }));

    const ws = XLSX.utils.json_to_sheet(printContent);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Divergências');
    
    const fileName = `divergencias_contagem_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);

    toast({
      title: 'Sucesso',
      description: 'Lista de divergências exportada!',
    });
  };

  const handleAdicionarDivergenciasAoContagem3 = async () => {
    if (selectedDivergencias.size === 0) {
      toast({
        title: 'Atenção',
        description: 'Selecione ao menos um item',
        variant: 'destructive',
      });
      return;
    }

    // Group by rua
    const divergenciasPorRua = new Map<number, string[]>();
    divergencias
      .filter(d => selectedDivergencias.has(d.endereco_material_id))
      .forEach(d => {
        if (!divergenciasPorRua.has(d.rua)) {
          divergenciasPorRua.set(d.rua, []);
        }
        divergenciasPorRua.get(d.rua)!.push(d.endereco_material_id);
      });

    try {
      // Add to selection for contagem 3
      for (const [rua, ids] of divergenciasPorRua) {
        await addInventarioSelecao(ids, 3, rua);
      }

      toast({
        title: 'Sucesso',
        description: `${selectedDivergencias.size} item(s) adicionado(s) à Contagem 3!`,
      });

      setSelectedDivergencias(new Set());
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao adicionar itens',
        variant: 'destructive',
      });
    }
  };

  const getRuaContagemAtiva = (rua: number): number => {
    const config = ruaConfigs.find(c => c.rua === rua);
    return config?.contagem_ativa || contagemAtiva;
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
          <Skeleton className="h-40 w-full" />
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
        <h1 className="text-lg font-bold">Controle de Inventário</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Export Button */}
            <Button
              onClick={handleExportarInventario}
              disabled={isExporting}
              variant="outline"
              className="w-full"
            >
              {isExporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="mr-2 h-4 w-4" />
              )}
              Exportar Inventário Completo (Excel)
            </Button>

            {/* Global Config Section */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <button
                onClick={() => setExpandedSection(expandedSection === 'global' ? '' : 'global')}
                className="flex w-full items-center justify-between p-4 hover:bg-accent/50"
              >
                <div className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold">Configuração Global</h2>
                </div>
                {expandedSection === 'global' ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </button>

              {expandedSection === 'global' && (
                <div className="border-t border-border p-4">
                  <div className="rounded-lg bg-primary/10 p-4 mb-4">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-primary" />
                      <p className="text-sm">
                        Esta é a fase de contagem padrão para todas as ruas sem configuração específica.
                      </p>
                    </div>
                  </div>

                  <RadioGroup
                    value={contagemAtiva.toString()}
                    onValueChange={(value) => setContagemAtiva(parseInt(value))}
                    className="space-y-3"
                  >
                    {[1, 2, 3].map((num) => (
                      <div key={num} className="flex items-center space-x-3 rounded-lg border border-border p-4 hover:bg-accent/50">
                        <RadioGroupItem value={num.toString()} id={`contagem-${num}`} />
                        <Label htmlFor={`contagem-${num}`} className="flex-1 cursor-pointer">
                          <span className="font-semibold">Contagem {num}</span>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>

                  {/* Bloqueio de visualização de estoque */}
                  <div className="mt-6 rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {bloquearVisualizacaoEstoque ? (
                          <EyeOff className="h-5 w-5 text-destructive" />
                        ) : (
                          <Eye className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div>
                          <p className="font-semibold">Bloquear Visualização do Estoque</p>
                          <p className="text-xs text-muted-foreground">
                            Impede usuários comuns de ver o saldo do estoque durante o inventário
                          </p>
                        </div>
                      </div>
                      <Button
                        variant={bloquearVisualizacaoEstoque ? "destructive" : "outline"}
                        size="sm"
                        onClick={async () => {
                          const newValue = !bloquearVisualizacaoEstoque;
                          setBloquearVisualizacaoEstoque(newValue);
                          try {
                            const result = await updateInventarioConfig(undefined, newValue);
                            if (!result.success) {
                              setBloquearVisualizacaoEstoque(!newValue);
                              throw new Error(result.error);
                            }
                            toast({
                              title: 'Sucesso',
                              description: newValue 
                                ? 'Visualização bloqueada para usuários comuns' 
                                : 'Visualização liberada para todos',
                            });
                          } catch (error: any) {
                            toast({
                              title: 'Erro',
                              description: error.message || 'Erro ao atualizar',
                              variant: 'destructive',
                            });
                          }
                        }}
                      >
                        {bloquearVisualizacaoEstoque ? 'Desbloquear' : 'Bloquear'}
                      </Button>
                    </div>
                  </div>

                  {lastUpdatedBy && lastUpdatedAt && (
                    <div className="mt-4 text-xs text-muted-foreground">
                      Última alteração por {lastUpdatedBy} em{' '}
                      {new Date(lastUpdatedAt).toLocaleString('pt-BR')}
                    </div>
                  )}

                  <Button
                    onClick={handleSalvarGlobal}
                    disabled={isSaving}
                    className="mt-4 w-full"
                  >
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Salvar Configuração Global
                  </Button>
                </div>
              )}
            </div>

            {/* Per-Rua Config Section */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <button
                onClick={() => setExpandedSection(expandedSection === 'rua' ? '' : 'rua')}
                className="flex w-full items-center justify-between p-4 hover:bg-accent/50"
              >
                <div className="flex items-center gap-2">
                  <Filter className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold">Configuração por Rua</h2>
                </div>
                {expandedSection === 'rua' ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </button>

              {expandedSection === 'rua' && (
                <div className="border-t border-border p-4 space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Configure uma fase de contagem diferente para ruas específicas.
                  </p>

                  {/* Current configs */}
                  {ruaConfigs.length > 0 && (
                    <div className="space-y-2">
                      <Label>Configurações ativas:</Label>
                      {ruaConfigs.map((config) => (
                        <div key={config.rua} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                          <span className="font-medium">Rua {config.rua}: Contagem {config.contagem_ativa}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoverRuaConfig(config.rua)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add new config */}
                  <div className="space-y-3">
                    <Label>Adicionar configuração:</Label>
                    <div className="flex gap-2">
                      <Select
                        value={selectedRuaConfig?.toString() || ''}
                        onValueChange={(v) => setSelectedRuaConfig(parseInt(v))}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="Rua" />
                        </SelectTrigger>
                        <SelectContent>
                          {ruasDisponiveis.map((rua) => (
                            <SelectItem key={rua} value={rua.toString()}>
                              Rua {rua}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <Select
                        value={ruaContagemSelecionada.toString()}
                        onValueChange={(v) => setRuaContagemSelecionada(parseInt(v))}
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Contagem 1</SelectItem>
                          <SelectItem value="2">Contagem 2</SelectItem>
                          <SelectItem value="3">Contagem 3</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Button
                        onClick={handleSalvarRuaConfig}
                        disabled={!selectedRuaConfig || isSavingRua}
                      >
                        {isSavingRua ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Status grid */}
                  <div className="mt-4">
                    <Label className="mb-2 block">Status por Rua:</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {ruasDisponiveis.map((rua) => {
                        const ctg = getRuaContagemAtiva(rua);
                        const hasSpecific = ruaConfigs.some(c => c.rua === rua);
                        return (
                          <div
                            key={rua}
                            className={`rounded-lg border p-2 text-center ${
                              hasSpecific ? 'border-primary bg-primary/10' : 'border-border'
                            }`}
                          >
                            <p className="text-xs text-muted-foreground">Rua {rua}</p>
                            <p className="font-bold">C{ctg}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Item Selection Section */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <button
                onClick={() => setExpandedSection(expandedSection === 'selecao' ? '' : 'selecao')}
                className="flex w-full items-center justify-between p-4 hover:bg-accent/50"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold">Selecionar Itens Específicos</h2>
                </div>
                {expandedSection === 'selecao' ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </button>

              {expandedSection === 'selecao' && (
                <div className="border-t border-border p-4 space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Selecione quais itens específicos devem ser contados em cada fase. Se não houver seleção, todos os itens serão contados.
                  </p>

                  <div className="flex gap-2">
                    <Select
                      value={selectionRua?.toString() || ''}
                      onValueChange={(v) => setSelectionRua(parseInt(v))}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Rua" />
                      </SelectTrigger>
                      <SelectContent>
                        {ruasDisponiveis.map((rua) => (
                          <SelectItem key={rua} value={rua.toString()}>
                            Rua {rua}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Select
                      value={selectionContagem.toString()}
                      onValueChange={(v) => setSelectionContagem(parseInt(v))}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">Contagem 2</SelectItem>
                        <SelectItem value="3">Contagem 3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {selectionRua && (
                    <>
                      {/* Current selections */}
                      {selecoes.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Itens selecionados ({selecoes.length}):</Label>
                            <Button variant="ghost" size="sm" onClick={handleLimparSelecao}>
                              <Trash2 className="mr-1 h-4 w-4" />
                              Limpar
                            </Button>
                          </div>
                          <div className="max-h-40 overflow-auto space-y-1">
                            {selecoes.map((s) => (
                              <div key={s.id} className="flex items-center justify-between rounded border border-border bg-muted/30 p-2 text-sm">
                                <span>{s.enderecos_materiais?.codigo} - {formatEndereco(s.enderecos_materiais?.rua, s.enderecos_materiais?.coluna, s.enderecos_materiais?.nivel, s.enderecos_materiais?.posicao)}</span>
                                <Button variant="ghost" size="sm" onClick={() => handleRemoverSelecao(s.id)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Add items */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Adicionar itens:</Label>
                          <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                            {selectedItems.size === enderecosRua.length ? 'Desmarcar todos' : 'Selecionar todos'}
                          </Button>
                        </div>
                        
                        {isLoadingEnderecos ? (
                          <Skeleton className="h-40 w-full" />
                        ) : (
                          <div className="max-h-60 overflow-auto rounded border border-border">
                            {enderecosRua.map((e) => {
                              const isSelected = selectedItems.has(e.id);
                              const isAlreadyInSelection = selecoes.some(s => s.endereco_material_id === e.id);
                              return (
                                <div
                                  key={e.id}
                                  className={`flex items-center gap-2 border-b border-border p-2 last:border-b-0 ${
                                    isAlreadyInSelection ? 'bg-muted/50' : ''
                                  }`}
                                >
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => handleToggleItem(e.id)}
                                    disabled={isAlreadyInSelection}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">{e.codigo}</p>
                                    <p className="text-xs text-muted-foreground truncate">{e.descricao}</p>
                                  </div>
                                  <span className="text-xs shrink-0">
                                    {formatEndereco(e.rua, e.coluna, e.nivel, e.posicao)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <Button
                          onClick={handleAdicionarSelecao}
                          disabled={selectedItems.size === 0 || isAddingSelection}
                          className="w-full"
                        >
                          {isAddingSelection ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Plus className="mr-2 h-4 w-4" />
                          )}
                          Adicionar Selecionados ({selectedItems.size})
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Divergências Section */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <button
                onClick={() => setExpandedSection(expandedSection === 'divergencias' ? '' : 'divergencias')}
                className="flex w-full items-center justify-between p-4 hover:bg-accent/50"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <h2 className="text-lg font-semibold">Divergências</h2>
                  {divergencias.length > 0 && (
                    <span className="rounded-full bg-destructive px-2 py-0.5 text-xs text-destructive-foreground">
                      {divergencias.length}
                    </span>
                  )}
                </div>
                {expandedSection === 'divergencias' ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </button>

              {expandedSection === 'divergencias' && (
                <div className="border-t border-border p-4 space-y-4">
                  <div className="flex gap-2">
                    <Select
                      value={divergenciaRua?.toString() || 'all'}
                      onValueChange={(v) => setDivergenciaRua(v === 'all' ? null : parseInt(v))}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Todas as ruas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as ruas</SelectItem>
                        {ruasDisponiveis.map((rua) => (
                          <SelectItem key={rua} value={rua.toString()}>
                            Rua {rua}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button variant="outline" onClick={handleImprimirDivergencias} disabled={divergencias.length === 0}>
                      <Printer className="mr-2 h-4 w-4" />
                      Exportar Lista
                    </Button>
                  </div>

                  {isLoadingDivergencias ? (
                    <Skeleton className="h-40 w-full" />
                  ) : divergencias.length === 0 ? (
                    <div className="rounded-lg bg-muted/30 p-8 text-center">
                      <CheckCircle className="mx-auto mb-2 h-8 w-8 text-mrx-success" />
                      <p className="text-muted-foreground">Nenhuma divergência encontrada!</p>
                    </div>
                  ) : (
                    <>
                      <div className="max-h-80 overflow-auto rounded border border-border">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-card border-b border-border">
                            <tr>
                              <th className="p-2 text-left">
                                <Checkbox
                                  checked={selectedDivergencias.size === divergencias.length}
                                  onCheckedChange={() => {
                                    if (selectedDivergencias.size === divergencias.length) {
                                      setSelectedDivergencias(new Set());
                                    } else {
                                      setSelectedDivergencias(new Set(divergencias.map(d => d.endereco_material_id)));
                                    }
                                  }}
                                />
                              </th>
                              <th className="p-2 text-left">Código</th>
                              <th className="p-2 text-left">Endereço</th>
                              <th className="p-2 text-right">C1</th>
                              <th className="p-2 text-right">C2</th>
                              <th className="p-2 text-right">C3</th>
                              <th className="p-2 text-right">Dif</th>
                            </tr>
                          </thead>
                          <tbody>
                            {divergencias.map((d) => (
                              <tr key={d.endereco_material_id} className="border-b border-border hover:bg-muted/30">
                                <td className="p-2">
                                  <Checkbox
                                    checked={selectedDivergencias.has(d.endereco_material_id)}
                                    onCheckedChange={() => {
                                      setSelectedDivergencias(prev => {
                                        const newSet = new Set(prev);
                                        if (newSet.has(d.endereco_material_id)) {
                                          newSet.delete(d.endereco_material_id);
                                        } else {
                                          newSet.add(d.endereco_material_id);
                                        }
                                        return newSet;
                                      });
                                    }}
                                  />
                                </td>
                                <td className="p-2 font-medium">{d.codigo}</td>
                                <td className="p-2 text-xs">{formatEndereco(d.rua, d.coluna, d.nivel, d.posicao)}</td>
                                <td className="p-2 text-right">{d.quantidade_1 ?? '-'}</td>
                                <td className="p-2 text-right">{d.quantidade_2 ?? '-'}</td>
                                <td className="p-2 text-right">{d.quantidade_3 ?? '-'}</td>
                                <td className="p-2 text-right font-bold text-destructive">{d.diferenca}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <Button
                        onClick={handleAdicionarDivergenciasAoContagem3}
                        disabled={selectedDivergencias.size === 0}
                        className="w-full"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar {selectedDivergencias.size} item(s) à Contagem 3
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ControleInventario;