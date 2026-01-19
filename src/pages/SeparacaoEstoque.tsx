import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Package, Loader2, RefreshCw, Clock, CheckCircle2, MapPin, Minus, Plus, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import logoImex from '@/assets/logo-imex.png';
import {
  useSeparacaoMaterial,
  Solicitacao,
  LinhasSolicitacao,
  EnderecoEstoque,
  filaSeparacao,
  detalheSolicitacao,
  iniciarSeparacao,
  buscarEnderecosCodigo,
  reservarEndereco,
  confirmarSeparacao,
} from '@/hooks/useSeparacaoMaterial';

const statusColors: Record<string, string> = {
  Rascunho: 'bg-gray-500',
  Enviada: 'bg-blue-500',
  EmSeparacao: 'bg-amber-500',
  Parcial: 'bg-orange-500',
  Concluida: 'bg-green-500',
  Cancelada: 'bg-red-500',
};

const statusLabels: Record<string, string> = {
  Rascunho: 'Rascunho',
  Enviada: 'Enviada',
  EmSeparacao: 'Em Separação',
  Parcial: 'Parcial',
  Concluida: 'Concluída',
  Cancelada: 'Cancelada',
};

const linhaStatusColors: Record<string, string> = {
  Pendente: 'bg-gray-500',
  FaltaPrioridade: 'bg-purple-500',
  Separando: 'bg-amber-500',
  Parcial: 'bg-orange-500',
  Separado: 'bg-green-500',
  CompraNecessaria: 'bg-red-500',
  Cancelado: 'bg-red-800',
};

const linhaStatusLabels: Record<string, string> = {
  Pendente: 'Pendente',
  FaltaPrioridade: 'Aguardando Prioridade',
  Separando: 'Separando',
  Parcial: 'Parcial',
  Separado: 'Separado',
  CompraNecessaria: 'Compra Necessária',
  Cancelado: 'Cancelado',
};

const SeparacaoEstoque = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { showError, showSuccess } = useSeparacaoMaterial();

  const [activeTab, setActiveTab] = useState('fila');
  const [isLoading, setIsLoading] = useState(true);
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  
  // Detail state
  const [selectedSolicitacao, setSelectedSolicitacao] = useState<Solicitacao | null>(null);
  const [linhas, setLinhas] = useState<LinhasSolicitacao[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  
  // Separation dialog
  const [separatingLine, setSeparatingLine] = useState<LinhasSolicitacao | null>(null);
  const [enderecos, setEnderecos] = useState<EnderecoEstoque[]>([]);
  const [isLoadingEnderecos, setIsLoadingEnderecos] = useState(false);
  const [selectedEndereco, setSelectedEndereco] = useState<EnderecoEstoque | null>(null);
  const [qtdRetirar, setQtdRetirar] = useState(0);
  const [isReserving, setIsReserving] = useState(false);
  
  // Confirm separation dialog
  const [confirmingLine, setConfirmingLine] = useState<LinhasSolicitacao | null>(null);
  const [qtdConfirmar, setQtdConfirmar] = useState(0);
  const [obsEstoque, setObsEstoque] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  
  // Start confirmation
  const [startConfirm, setStartConfirm] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const loadFila = useCallback(async () => {
    setIsLoading(true);
    const result = await filaSeparacao();
    if (result.success && result.data) {
      setSolicitacoes(result.data);
    } else if (result.error) {
      toast({
        title: 'Erro',
        description: result.error,
        variant: 'destructive',
      });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    loadFila();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDetail = async (sol: Solicitacao) => {
    setSelectedSolicitacao(sol);
    setIsLoadingDetail(true);
    setActiveTab('detalhe');
    
    const result = await detalheSolicitacao(sol.id);
    if (result.success && result.data) {
      setSelectedSolicitacao(result.data.solicitacao);
      setLinhas(result.data.linhas || []);
    } else if (result.error) {
      showError(result.error);
    }
    setIsLoadingDetail(false);
  };

  const handleStart = async () => {
    if (!startConfirm) return;
    
    setIsStarting(true);
    const result = await iniciarSeparacao(startConfirm);
    if (result.success) {
      showSuccess('Separação iniciada!');
      loadFila();
      if (selectedSolicitacao?.id === startConfirm) {
        loadDetail(selectedSolicitacao);
      }
    } else if (result.error) {
      showError(result.error);
    }
    setIsStarting(false);
    setStartConfirm(null);
  };

  const openSeparationDialog = async (linha: LinhasSolicitacao) => {
    setSeparatingLine(linha);
    setEnderecos([]);
    setSelectedEndereco(null);
    setQtdRetirar(0);
    setIsLoadingEnderecos(true);
    
    const result = await buscarEnderecosCodigo(linha.codigo_item);
    if (result.success && result.data) {
      setEnderecos(result.data);
    } else if (result.error) {
      showError(result.error);
    }
    setIsLoadingEnderecos(false);
  };

  const handleReserve = async () => {
    if (!separatingLine || !selectedEndereco || qtdRetirar <= 0) return;
    
    if (qtdRetirar > selectedEndereco.quantidade) {
      showError('Quantidade maior que disponível no endereço');
      return;
    }
    
    setIsReserving(true);
    const result = await reservarEndereco(separatingLine.id, selectedEndereco.id, qtdRetirar);
    if (result.success) {
      showSuccess('Material reservado!');
      setSeparatingLine(null);
      if (selectedSolicitacao) loadDetail(selectedSolicitacao);
    } else if (result.error) {
      showError(result.error);
    }
    setIsReserving(false);
  };

  const openConfirmDialog = (linha: LinhasSolicitacao) => {
    setConfirmingLine(linha);
    setQtdConfirmar(linha.qtd_reservada);
    setObsEstoque('');
  };

  const handleConfirmSeparation = async () => {
    if (!confirmingLine) return;
    
    setIsConfirming(true);
    const result = await confirmarSeparacao(confirmingLine.id, qtdConfirmar, obsEstoque || undefined);
    if (result.success) {
      showSuccess('Separação confirmada!');
      setConfirmingLine(null);
      if (selectedSolicitacao) loadDetail(selectedSolicitacao);
    } else if (result.error) {
      showError(result.error);
    }
    setIsConfirming(false);
  };

  const calcSLA = (dataAbertura: string | null, dataInicio: string | null, dataConclusao: string | null) => {
    if (!dataAbertura) return { inicio: '-', total: '-', aberto: '-' };
    
    const abertura = new Date(dataAbertura);
    const inicio = dataInicio ? new Date(dataInicio) : null;
    const conclusao = dataConclusao ? new Date(dataConclusao) : null;
    const now = new Date();
    
    const slaInicio = inicio ? Math.round((inicio.getTime() - abertura.getTime()) / 60000) : null;
    const slaTotal = conclusao ? Math.round((conclusao.getTime() - abertura.getTime()) / 60000) : null;
    const tempoAberto = Math.round((now.getTime() - abertura.getTime()) / 60000);
    
    const formatMin = (min: number | null) => {
      if (min === null) return '-';
      if (min < 60) return `${min}min`;
      const h = Math.floor(min / 60);
      const m = min % 60;
      return `${h}h${m > 0 ? ` ${m}min` : ''}`;
    };
    
    return {
      inicio: formatMin(slaInicio),
      total: formatMin(slaTotal),
      aberto: formatMin(tempoAberto),
    };
  };

  const calcProgress = (lns: LinhasSolicitacao[]) => {
    if (lns.length === 0) return 0;
    const done = lns.filter(l => l.status_linha === 'Separado').length;
    return Math.round((done / lns.length) * 100);
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
          <h1 className="text-base font-bold">Separação - Estoque</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={loadFila} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-3 mt-2 grid w-auto grid-cols-2">
          <TabsTrigger value="fila">Fila de Separação</TabsTrigger>
          <TabsTrigger value="detalhe" disabled={!selectedSolicitacao}>Detalhe</TabsTrigger>
        </TabsList>

        {/* Queue List */}
        <TabsContent value="fila" className="flex-1 overflow-auto p-3 space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : solicitacoes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Package className="h-10 w-10 mb-2" />
              <p>Nenhuma solicitação na fila</p>
            </div>
          ) : (
            <div className="space-y-2">
              {solicitacoes.map((sol) => {
                const sla = calcSLA(sol.data_abertura, sol.data_inicio_estoque, sol.data_conclusao);
                return (
                  <Card key={sol.id} className="cursor-pointer hover:bg-accent/50" onClick={() => loadDetail(sol)}>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{sol.codigo_lista}</p>
                          <p className="text-xs text-muted-foreground">Por: {sol.criado_por}</p>
                        </div>
                        <Badge className={`${statusColors[sol.status]} text-white shrink-0`}>
                          {statusLabels[sol.status]}
                        </Badge>
                      </div>
                      <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Aberto há: {sla.aberto}
                        </span>
                        {sol.status === 'Enviada' && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={(e) => {
                              e.stopPropagation();
                              setStartConfirm(sol.id);
                            }}
                            className="gap-1 h-6 text-xs"
                          >
                            <Play className="h-3 w-3" />
                            Iniciar
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Detail View */}
        <TabsContent value="detalhe" className="flex-1 overflow-auto p-3 space-y-3">
          {selectedSolicitacao && (
            <>
              {/* Header info */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{selectedSolicitacao.codigo_lista}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">Por: {selectedSolicitacao.criado_por}</p>
                    </div>
                    <Badge className={`${statusColors[selectedSolicitacao.status]} text-white`}>
                      {statusLabels[selectedSolicitacao.status]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Progresso: {calcProgress(linhas)}%</span>
                    <span>{linhas.filter(l => l.status_linha === 'Separado').length} / {linhas.length} linhas</span>
                  </div>
                  
                  {selectedSolicitacao.status === 'Enviada' && (
                    <Button
                      className="w-full mt-3 gap-2"
                      onClick={() => setStartConfirm(selectedSolicitacao.id)}
                    >
                      <Play className="h-4 w-4" />
                      Iniciar Separação
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Linhas */}
              {isLoadingDetail ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : linhas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Package className="h-10 w-10 mb-2" />
                  <p>Nenhuma linha</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">Linhas ({linhas.length})</h3>
                  {linhas
                    .sort((a, b) => (a.prioridade || 999) - (b.prioridade || 999))
                    .map((linha) => {
                      const faltante = Math.max(0, linha.qtd_solicitada - linha.qtd_reservada);
                      const canSeparate = selectedSolicitacao.status === 'EmSeparacao' && 
                        linha.status_linha !== 'Separado' && 
                        linha.status_linha !== 'Cancelado' &&
                        linha.status_linha !== 'FaltaPrioridade';
                      
                      // Show confirm button when reservado > separado
                      const canConfirm = selectedSolicitacao.status === 'EmSeparacao' && 
                        linha.qtd_reservada > 0 && 
                        linha.qtd_separada < linha.qtd_reservada;
                      
                      return (
                        <Card key={linha.id}>
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm">{linha.codigo_item}</p>
                                {/* Show description if available */}
                                {linha.descricao && (
                                  <p className="text-xs text-muted-foreground truncate">{linha.descricao}</p>
                                )}
                                <p className="text-xs text-muted-foreground">Pedido: {linha.pedido_cliente}</p>
                                {linha.fornecedor && <p className="text-xs text-muted-foreground">Forn: {linha.fornecedor}</p>}
                                {linha.prioridade && (
                                  <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded inline-block mt-1">
                                    Prioridade: {linha.prioridade}
                                  </span>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <Badge className={`${linhaStatusColors[linha.status_linha]} text-white text-xs`}>
                                  {linhaStatusLabels[linha.status_linha]}
                                </Badge>
                                <div className="text-xs mt-1 space-y-0.5">
                                  <p>Solicitado: <span className="font-medium">{linha.qtd_solicitada}</span></p>
                                  {/* Show available stock */}
                                  <p>Disponível: <span className="font-medium text-blue-600">{linha.qtd_disponivel_atual ?? '-'}</span></p>
                                  <p>Reservado: <span className="font-medium text-amber-600">{linha.qtd_reservada}</span></p>
                                  <p>Separado: <span className="font-medium text-green-600">{linha.qtd_separada}</span></p>
                                  {faltante > 0 && (
                                    <p className="text-red-600">Faltante: {faltante}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {linha.status_linha === 'FaltaPrioridade' && (
                              <div className="mt-2 p-2 bg-purple-50 rounded flex items-center gap-2 text-xs text-purple-700">
                                <AlertTriangle className="h-4 w-4" />
                                Aguardando Comercial definir prioridade
                              </div>
                            )}
                            
                            {canSeparate && (
                              <div className="flex gap-2 mt-2">
                                {faltante > 0 && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openSeparationDialog(linha)}
                                    className="gap-1 flex-1"
                                  >
                                    <MapPin className="h-3 w-3" />
                                    Retirar do Endereço
                                  </Button>
                                )}
                                {canConfirm && (
                                  <Button
                                    size="sm"
                                    onClick={() => openConfirmDialog(linha)}
                                    className="gap-1 flex-1"
                                  >
                                    <CheckCircle2 className="h-3 w-3" />
                                    Confirmar Separação
                                  </Button>
                                )}
                              </div>
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

      {/* Separation Dialog */}
      <Dialog open={!!separatingLine} onOpenChange={() => setSeparatingLine(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Retirar do Endereço</DialogTitle>
          </DialogHeader>
          
          {separatingLine && (
            <div className="space-y-4">
              <div className="bg-muted p-3 rounded">
                <p className="font-medium">{separatingLine.codigo_item}</p>
                <p className="text-sm text-muted-foreground">
                  Faltante: {Math.max(0, separatingLine.qtd_solicitada - separatingLine.qtd_reservada)}
                </p>
              </div>
              
              {isLoadingEnderecos ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : enderecos.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <Package className="h-8 w-8 mx-auto mb-2" />
                  <p>Nenhum endereço com saldo disponível</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Selecione o Endereço</Label>
                    {enderecos.map((end) => (
                      <div
                        key={end.id}
                        className={`p-3 border rounded cursor-pointer transition-colors ${
                          selectedEndereco?.id === end.id ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                        }`}
                        onClick={() => {
                          setSelectedEndereco(end);
                          setQtdRetirar(Math.min(
                            end.quantidade,
                            Math.max(0, (separatingLine?.qtd_solicitada || 0) - (separatingLine?.qtd_reservada || 0))
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
                            <p className="font-bold text-lg text-green-600">{end.quantidade}</p>
                            <p className="text-xs text-muted-foreground">disponível</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {selectedEndereco && (
                    <div className="space-y-2">
                      <Label>Quantidade a Retirar</Label>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setQtdRetirar(Math.max(1, qtdRetirar - 1))}
                          disabled={qtdRetirar <= 1}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          type="number"
                          value={qtdRetirar}
                          onChange={(e) => setQtdRetirar(Math.min(selectedEndereco.quantidade, Math.max(1, parseInt(e.target.value) || 0)))}
                          className="text-center"
                          min={1}
                          max={selectedEndereco.quantidade}
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setQtdRetirar(Math.min(selectedEndereco.quantidade, qtdRetirar + 1))}
                          disabled={qtdRetirar >= selectedEndereco.quantidade}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground text-center">
                        Máximo: {selectedEndereco.quantidade}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setSeparatingLine(null)}>Cancelar</Button>
            <Button
              onClick={handleReserve}
              disabled={!selectedEndereco || qtdRetirar <= 0 || isReserving}
            >
              {isReserving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reservar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Separation Dialog */}
      <Dialog open={!!confirmingLine} onOpenChange={() => setConfirmingLine(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Separação</DialogTitle>
          </DialogHeader>
          
          {confirmingLine && (
            <div className="space-y-4">
              <div className="bg-muted p-3 rounded">
                <p className="font-medium">{confirmingLine.codigo_item}</p>
                <p className="text-sm text-muted-foreground">
                  Reservado: {confirmingLine.qtd_reservada} | Já separado: {confirmingLine.qtd_separada}
                </p>
              </div>
              
              <div>
                <Label>Quantidade Separada</Label>
                <Input
                  type="number"
                  value={qtdConfirmar}
                  onChange={(e) => setQtdConfirmar(parseInt(e.target.value) || 0)}
                  min={0}
                  max={confirmingLine.qtd_reservada}
                />
              </div>
              
              <div>
                <Label>Observações (opcional)</Label>
                <Textarea
                  value={obsEstoque}
                  onChange={(e) => setObsEstoque(e.target.value)}
                  placeholder="Observações sobre a separação..."
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmingLine(null)}>Cancelar</Button>
            <Button onClick={handleConfirmSeparation} disabled={isConfirming}>
              {isConfirming && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Start Confirmation */}
      <AlertDialog open={!!startConfirm} onOpenChange={() => setStartConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Iniciar Separação</AlertDialogTitle>
            <AlertDialogDescription>
              Ao iniciar, o SLA será registrado. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleStart} disabled={isStarting}>
              {isStarting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Iniciar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SeparacaoEstoque;
