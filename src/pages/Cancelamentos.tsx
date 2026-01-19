import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Package, Loader2, RefreshCw, MapPin, Minus, Undo2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import logoImex from '@/assets/logo-imex.png';
import {
  useSeparacaoMaterial,
  Cancelamento,
  CancelamentoLinha,
  EnderecoEstoque,
  listarCancelamentos,
  criarCancelamento,
  detalheCancelamento,
  buscarEnderecosDevolucao,
  enderecarDevolucao,
} from '@/hooks/useSeparacaoMaterial';

const statusColors: Record<string, string> = {
  Aberto: 'bg-blue-500',
  EmProcesso: 'bg-amber-500',
  Concluido: 'bg-green-500',
  Cancelado: 'bg-red-500',
};

const statusLabels: Record<string, string> = {
  Aberto: 'Aberto',
  EmProcesso: 'Em Processo',
  Concluido: 'Concluído',
  Cancelado: 'Cancelado',
};

const linhaStatusColors: Record<string, string> = {
  PendenteDevolucao: 'bg-amber-500',
  Devolvendo: 'bg-blue-500',
  DevolvidoTotal: 'bg-green-500',
};

const linhaStatusLabels: Record<string, string> = {
  PendenteDevolucao: 'Pendente Devolução',
  Devolvendo: 'Devolvendo',
  DevolvidoTotal: 'Devolvido Total',
};

const Cancelamentos = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { showError, showSuccess } = useSeparacaoMaterial();
  
  const isEstoque = user?.tipo === 'estoque' || user?.tipo === 'admin';
  const isComercial = user?.tipo === 'comercial' || user?.tipo === 'admin';

  const [activeTab, setActiveTab] = useState('lista');
  const [isLoading, setIsLoading] = useState(true);
  const [cancelamentos, setCancelamentos] = useState<Cancelamento[]>([]);
  
  // Detail state
  const [selectedCancelamento, setSelectedCancelamento] = useState<Cancelamento | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  
  // Create dialog
  const [showCreate, setShowCreate] = useState(false);
  const [newPedido, setNewPedido] = useState('');
  const [newMotivo, setNewMotivo] = useState('');
  const [newLinhas, setNewLinhas] = useState<{ codigo_item: string; fornecedor: string; qtd_cancelada: number }[]>([
    { codigo_item: '', fornecedor: '', qtd_cancelada: 0 },
  ]);
  const [isCreating, setIsCreating] = useState(false);
  
  // Return dialog (Estoque)
  const [returningLine, setReturningLine] = useState<CancelamentoLinha | null>(null);
  const [enderecos, setEnderecos] = useState<EnderecoEstoque[]>([]);
  const [isLoadingEnderecos, setIsLoadingEnderecos] = useState(false);
  const [selectedEndereco, setSelectedEndereco] = useState<EnderecoEstoque | null>(null);
  const [qtdDevolver, setQtdDevolver] = useState(0);
  const [isReturning, setIsReturning] = useState(false);

  const loadCancelamentos = useCallback(async () => {
    setIsLoading(true);
    const result = await listarCancelamentos();
    if (result.success && result.data) {
      setCancelamentos(result.data);
    } else if (result.error) {
      showError(result.error);
    }
    setIsLoading(false);
  }, [showError]);

  useEffect(() => {
    loadCancelamentos();
  }, [loadCancelamentos]);

  const loadDetail = async (canc: Cancelamento) => {
    setSelectedCancelamento(canc);
    setIsLoadingDetail(true);
    setActiveTab('detalhe');
    
    const result = await detalheCancelamento(canc.id);
    if (result.success && result.data) {
      setSelectedCancelamento(result.data);
    } else if (result.error) {
      showError(result.error);
    }
    setIsLoadingDetail(false);
  };

  const handleCreate = async () => {
    if (!newPedido.trim()) {
      showError('Informe o pedido cliente');
      return;
    }
    
    const linhasValidas = newLinhas.filter(l => l.codigo_item.trim() && l.qtd_cancelada > 0);
    if (linhasValidas.length === 0) {
      showError('Adicione pelo menos uma linha válida');
      return;
    }
    
    setIsCreating(true);
    const result = await criarCancelamento(newPedido.trim(), linhasValidas, newMotivo.trim() || undefined);
    if (result.success && result.data) {
      showSuccess('Cancelamento criado!');
      setShowCreate(false);
      setNewPedido('');
      setNewMotivo('');
      setNewLinhas([{ codigo_item: '', fornecedor: '', qtd_cancelada: 0 }]);
      loadCancelamentos();
      loadDetail(result.data);
    } else if (result.error) {
      showError(result.error);
    }
    setIsCreating(false);
  };

  const addNewLine = () => {
    setNewLinhas([...newLinhas, { codigo_item: '', fornecedor: '', qtd_cancelada: 0 }]);
  };

  const updateNewLine = (index: number, field: string, value: string | number) => {
    const updated = [...newLinhas];
    (updated[index] as any)[field] = value;
    setNewLinhas(updated);
  };

  const removeNewLine = (index: number) => {
    if (newLinhas.length === 1) return;
    setNewLinhas(newLinhas.filter((_, i) => i !== index));
  };

  const openReturnDialog = async (linha: CancelamentoLinha) => {
    setReturningLine(linha);
    setEnderecos([]);
    setSelectedEndereco(null);
    setQtdDevolver(0);
    setIsLoadingEnderecos(true);
    
    const result = await buscarEnderecosDevolucao(linha.codigo_item);
    if (result.success && result.data) {
      setEnderecos(result.data);
    } else if (result.error) {
      showError(result.error);
    }
    setIsLoadingEnderecos(false);
  };

  const handleReturn = async () => {
    if (!returningLine || !selectedEndereco || qtdDevolver <= 0) return;
    
    const pendente = returningLine.qtd_cancelada - returningLine.qtd_devolvida_total;
    if (qtdDevolver > pendente) {
      showError('Quantidade maior que pendente');
      return;
    }
    
    setIsReturning(true);
    const result = await enderecarDevolucao(returningLine.id, selectedEndereco.id, qtdDevolver);
    if (result.success) {
      showSuccess('Devolução registrada!');
      setReturningLine(null);
      if (selectedCancelamento) loadDetail(selectedCancelamento);
    } else if (result.error) {
      showError(result.error);
    }
    setIsReturning(false);
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border bg-card px-3 py-2 shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/')} className="rounded-lg p-1.5 hover:bg-accent">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <img src={logoImex} alt="IMEX Solutions" className="h-6" />
          <h1 className="text-base font-bold">Cancelamentos</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={loadCancelamentos} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-3 mt-2 grid w-auto grid-cols-2">
          <TabsTrigger value="lista">Lista</TabsTrigger>
          <TabsTrigger value="detalhe" disabled={!selectedCancelamento}>Detalhe</TabsTrigger>
        </TabsList>

        {/* List */}
        <TabsContent value="lista" className="flex-1 overflow-auto p-3 space-y-3">
          {isComercial && (
            <Button onClick={() => setShowCreate(true)} className="w-full gap-2">
              <Plus className="h-4 w-4" />
              Novo Cancelamento
            </Button>
          )}
          
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : cancelamentos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Package className="h-10 w-10 mb-2" />
              <p>Nenhum cancelamento encontrado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cancelamentos.map((canc) => (
                <Card key={canc.id} className="cursor-pointer hover:bg-accent/50" onClick={() => loadDetail(canc)}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">Pedido: {canc.pedido_cliente}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(canc.data_cancelamento).toLocaleDateString('pt-BR')} por {canc.criado_por}
                        </p>
                        {canc.motivo && <p className="text-xs text-muted-foreground mt-1 truncate">{canc.motivo}</p>}
                      </div>
                      <Badge className={`${statusColors[canc.status]} text-white shrink-0`}>
                        {statusLabels[canc.status]}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Detail View */}
        <TabsContent value="detalhe" className="flex-1 overflow-auto p-3 space-y-3">
          {selectedCancelamento && (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">Pedido: {selectedCancelamento.pedido_cliente}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(selectedCancelamento.data_cancelamento).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <Badge className={`${statusColors[selectedCancelamento.status]} text-white`}>
                      {statusLabels[selectedCancelamento.status]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {selectedCancelamento.motivo && (
                    <p className="text-sm text-muted-foreground">{selectedCancelamento.motivo}</p>
                  )}
                </CardContent>
              </Card>

              {/* Linhas */}
              {isLoadingDetail ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : !selectedCancelamento.linhas || selectedCancelamento.linhas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Package className="h-10 w-10 mb-2" />
                  <p>Nenhuma linha</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">Itens ({selectedCancelamento.linhas.length})</h3>
                  {selectedCancelamento.linhas.map((linha) => {
                    const pendente = linha.qtd_cancelada - linha.qtd_devolvida_total;
                    
                    return (
                      <Card key={linha.id}>
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{linha.codigo_item}</p>
                              {linha.fornecedor && <p className="text-xs text-muted-foreground">Forn: {linha.fornecedor}</p>}
                            </div>
                            <div className="text-right shrink-0">
                              <Badge className={`${linhaStatusColors[linha.status_linha]} text-white text-xs`}>
                                {linhaStatusLabels[linha.status_linha]}
                              </Badge>
                              <div className="text-xs mt-1 space-y-0.5">
                                <p>Cancelado: <span className="font-medium">{linha.qtd_cancelada}</span></p>
                                <p>Devolvido: <span className="font-medium text-green-600">{linha.qtd_devolvida_total}</span></p>
                                {pendente > 0 && (
                                  <p className="text-amber-600">Pendente: {pendente}</p>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {isEstoque && pendente > 0 && selectedCancelamento.status !== 'Cancelado' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openReturnDialog(linha)}
                              className="gap-1 w-full mt-2"
                            >
                              <Undo2 className="h-3 w-3" />
                              Endereçar Devolução
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Cancelamento</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Pedido Cliente *</Label>
              <Input
                value={newPedido}
                onChange={(e) => setNewPedido(e.target.value)}
                placeholder="PED-001"
              />
            </div>
            
            <div>
              <Label>Motivo</Label>
              <Textarea
                value={newMotivo}
                onChange={(e) => setNewMotivo(e.target.value)}
                placeholder="Motivo do cancelamento..."
              />
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Itens a Cancelar</Label>
                <Button type="button" variant="outline" size="sm" onClick={addNewLine}>
                  <Plus className="h-3 w-3 mr-1" />
                  Adicionar
                </Button>
              </div>
              
              {newLinhas.map((linha, index) => (
                <div key={index} className="border rounded p-3 space-y-2">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label className="text-xs">Código *</Label>
                      <Input
                        value={linha.codigo_item}
                        onChange={(e) => updateNewLine(index, 'codigo_item', e.target.value)}
                        placeholder="000001"
                      />
                    </div>
                    <div className="w-20">
                      <Label className="text-xs">Qtd *</Label>
                      <Input
                        type="number"
                        value={linha.qtd_cancelada || ''}
                        onChange={(e) => updateNewLine(index, 'qtd_cancelada', parseInt(e.target.value) || 0)}
                        min={1}
                      />
                    </div>
                    {newLinhas.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeNewLine(index)}
                        className="mt-5 text-destructive"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs">Fornecedor</Label>
                    <Input
                      value={linha.fornecedor}
                      onChange={(e) => updateNewLine(index, 'fornecedor', e.target.value)}
                      placeholder="Opcional"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Dialog */}
      <Dialog open={!!returningLine} onOpenChange={() => setReturningLine(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Endereçar Devolução</DialogTitle>
          </DialogHeader>
          
          {returningLine && (
            <div className="space-y-4">
              <div className="bg-muted p-3 rounded">
                <p className="font-medium">{returningLine.codigo_item}</p>
                <p className="text-sm text-muted-foreground">
                  Pendente: {returningLine.qtd_cancelada - returningLine.qtd_devolvida_total}
                </p>
              </div>
              
              {isLoadingEnderecos ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : enderecos.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <Package className="h-8 w-8 mx-auto mb-2" />
                  <p>Nenhum endereço disponível para este código</p>
                  <p className="text-xs">O sistema mostrará endereços existentes ou você pode criar um novo</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Selecione o Endereço de Destino</Label>
                    {enderecos.map((end) => (
                      <div
                        key={end.id}
                        className={`p-3 border rounded cursor-pointer transition-colors ${
                          selectedEndereco?.id === end.id ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                        }`}
                        onClick={() => {
                          setSelectedEndereco(end);
                          setQtdDevolver(Math.min(
                            returningLine.qtd_cancelada - returningLine.qtd_devolvida_total,
                            999
                          ));
                        }}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium text-sm">
                              R{String(end.rua).padStart(2, '0')} - 
                              C{String(end.coluna).padStart(2, '0')} - 
                              N{String(end.nivel).padStart(2, '0')} - 
                              P{String(end.posicao).padStart(2, '0')}
                            </p>
                            <p className="text-xs text-muted-foreground">{end.descricao}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg">{end.quantidade}</p>
                            <p className="text-xs text-muted-foreground">atual</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {selectedEndereco && (
                    <div className="space-y-2">
                      <Label>Quantidade a Devolver</Label>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setQtdDevolver(Math.max(1, qtdDevolver - 1))}
                          disabled={qtdDevolver <= 1}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          type="number"
                          value={qtdDevolver}
                          onChange={(e) => {
                            const max = returningLine.qtd_cancelada - returningLine.qtd_devolvida_total;
                            setQtdDevolver(Math.min(max, Math.max(1, parseInt(e.target.value) || 0)));
                          }}
                          className="text-center"
                          min={1}
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            const max = returningLine.qtd_cancelada - returningLine.qtd_devolvida_total;
                            setQtdDevolver(Math.min(max, qtdDevolver + 1));
                          }}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground text-center">
                        Máximo: {returningLine.qtd_cancelada - returningLine.qtd_devolvida_total}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturningLine(null)}>Cancelar</Button>
            <Button
              onClick={handleReturn}
              disabled={!selectedEndereco || qtdDevolver <= 0 || isReturning}
            >
              {isReturning && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Devolver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Cancelamentos;
