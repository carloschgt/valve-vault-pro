import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Upload, Send, FileText, Loader2, Trash2, Clock, CheckCircle2, AlertTriangle, Package, RefreshCw, X, Pencil, Check, XCircle } from 'lucide-react';
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
import * as XLSX from 'xlsx';
import {
  useSeparacaoMaterial,
  Solicitacao,
  LinhasSolicitacao,
  LinhaImportacao,
  listarSolicitacoes,
  criarSolicitacao,
  adicionarLinha,
  importarLinhas,
  enviarSolicitacao,
  excluirLinha,
  excluirSolicitacao,
  detalheSolicitacao,
  definirPrioridade,
  buscarProduto,
  editarLinha,
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
  FaltaPrioridade: 'Definir Prioridade',
  Separando: 'Separando',
  Parcial: 'Parcial',
  Separado: 'Separado',
  CompraNecessaria: 'Compra Necessária',
  Cancelado: 'Cancelado',
};

const SeparacaoComercial = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { showError, showSuccess } = useSeparacaoMaterial();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState('solicitacoes');
  const [isLoading, setIsLoading] = useState(true);
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  
  // Create/Edit state
  const [selectedSolicitacao, setSelectedSolicitacao] = useState<Solicitacao | null>(null);
  const [linhas, setLinhas] = useState<LinhasSolicitacao[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  
  // New/Edit line form
  const [showAddLine, setShowAddLine] = useState(false);
  const [editingLinha, setEditingLinha] = useState<LinhasSolicitacao | null>(null);
  const [newLine, setNewLine] = useState<LinhaImportacao & { descricao?: string }>({
    pedido_cliente: '',
    item_cliente: '',
    qtd: 0,
    codigo_item: '',
    fornecedor: '',
    descricao: '',
  });
  const [isAddingLine, setIsAddingLine] = useState(false);
  const [isSearchingCodigo, setIsSearchingCodigo] = useState(false);
  const [codigoValidado, setCodigoValidado] = useState<boolean | null>(null);
  
  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'linha' | 'solicitacao'; id: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Priority dialog
  const [priorityDialog, setPriorityDialog] = useState<{ linhaId: string; currentPriority: number | null } | null>(null);
  const [newPriority, setNewPriority] = useState('');
  const [isSavingPriority, setIsSavingPriority] = useState(false);
  
  // Send confirmation
  const [sendConfirm, setSendConfirm] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const loadSolicitacoes = useCallback(async () => {
    setIsLoading(true);
    const result = await listarSolicitacoes();
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
    loadSolicitacoes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDetail = async (sol: Solicitacao) => {
    setSelectedSolicitacao(sol);
    setIsLoadingDetail(true);
    setActiveTab('detalhe');
    
    const result = await detalheSolicitacao(sol.id);
    if (result.success && result.data) {
      setLinhas(result.data.linhas || []);
    } else if (result.error) {
      showError(result.error);
    }
    setIsLoadingDetail(false);
  };

  const handleCreateNew = async () => {
    setIsLoading(true);
    const result = await criarSolicitacao();
    if (result.success && result.data) {
      showSuccess('Solicitação criada!');
      await loadSolicitacoes();
      loadDetail(result.data);
    } else if (result.error) {
      showError(result.error);
    }
    setIsLoading(false);
  };

  const handleBuscarCodigo = async (codigo: string) => {
    if (!codigo || codigo.length < 3) {
      setCodigoValidado(null);
      setNewLine(prev => ({ ...prev, descricao: '', fornecedor: '' }));
      return;
    }
    
    setIsSearchingCodigo(true);
    const result = await buscarProduto(codigo);
    if (result.success && result.data) {
      if (result.data.encontrado) {
        setCodigoValidado(true);
        setNewLine(prev => ({
          ...prev,
          codigo_item: result.data!.codigo,
          descricao: result.data!.descricao || '',
          fornecedor: result.data!.fornecedor || prev.fornecedor || '',
        }));
      } else {
        setCodigoValidado(false);
        setNewLine(prev => ({ ...prev, descricao: '', fornecedor: '' }));
      }
    } else {
      setCodigoValidado(null);
    }
    setIsSearchingCodigo(false);
  };

  const handleAddLine = async () => {
    if (!selectedSolicitacao) return;
    if (!newLine.pedido_cliente || !newLine.codigo_item || newLine.qtd <= 0) {
      showError('Preencha todos os campos obrigatórios');
      return;
    }
    
    if (codigoValidado === false) {
      showError('Código não existe no sistema');
      return;
    }
    
    setIsAddingLine(true);
    
    if (editingLinha) {
      // Edit mode
      const result = await editarLinha(editingLinha.id, {
        pedido_cliente: newLine.pedido_cliente,
        item_cliente: newLine.item_cliente,
        codigo_item: newLine.codigo_item,
        fornecedor: newLine.fornecedor,
        qtd_solicitada: newLine.qtd,
      });
      
      if (result.success) {
        showSuccess('Linha atualizada!');
        resetLineForm();
        loadDetail(selectedSolicitacao);
      } else if (result.error) {
        showError(result.error);
      }
    } else {
      // Add mode
      const result = await adicionarLinha(selectedSolicitacao.id, {
        pedido_cliente: newLine.pedido_cliente,
        item_cliente: newLine.item_cliente,
        qtd: newLine.qtd,
        codigo_item: newLine.codigo_item,
        fornecedor: newLine.fornecedor,
      });
      
      if (result.success) {
        showSuccess('Linha adicionada!');
        resetLineForm();
        loadDetail(selectedSolicitacao);
      } else if (result.error) {
        showError(result.error);
      }
    }
    setIsAddingLine(false);
  };

  const resetLineForm = () => {
    setNewLine({ pedido_cliente: '', item_cliente: '', qtd: 0, codigo_item: '', fornecedor: '', descricao: '' });
    setShowAddLine(false);
    setEditingLinha(null);
    setCodigoValidado(null);
  };

  const handleEditLinha = (linha: LinhasSolicitacao) => {
    setEditingLinha(linha);
    setNewLine({
      pedido_cliente: linha.pedido_cliente,
      item_cliente: linha.item_cliente || '',
      qtd: linha.qtd_solicitada,
      codigo_item: linha.codigo_item,
      fornecedor: linha.fornecedor || '',
      descricao: '',
    });
    setCodigoValidado(true); // Assume it's valid since it's already in the system
    setShowAddLine(true);
  };

  const canEditLinha = (linha: LinhasSolicitacao): boolean => {
    if (!selectedSolicitacao) return false;
    
    // Can edit if:
    // 1. Solicitacao is Rascunho
    // 2. Solicitacao is Enviada AND linha is Pendente or FaltaPrioridade
    if (selectedSolicitacao.status === 'Rascunho') return true;
    if (selectedSolicitacao.status === 'Enviada' && 
        (linha.status_linha === 'Pendente' || linha.status_linha === 'FaltaPrioridade')) {
      return true;
    }
    return false;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedSolicitacao) return;
    
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 });
      
      // Skip header row
      const linhasImport: LinhaImportacao[] = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 4) continue;
        
        linhasImport.push({
          pedido_cliente: String(row[0] || '').trim(),
          item_cliente: String(row[1] || '').trim(),
          qtd: Number(row[2]) || 0,
          codigo_item: String(row[3] || '').trim(),
          fornecedor: String(row[4] || '').trim(),
        });
      }
      
      if (linhasImport.length === 0) {
        showError('Nenhuma linha válida encontrada no arquivo');
        return;
      }
      
      setIsLoading(true);
      const result = await importarLinhas(selectedSolicitacao.id, linhasImport);
      if (result.success && result.data) {
        showSuccess(`${result.data.inserted} linhas importadas!`);
        if (result.data.errors.length > 0) {
          toast({
            title: 'Avisos',
            description: result.data.errors.join('; '),
            variant: 'default',
          });
        }
        loadDetail(selectedSolicitacao);
      } else if (result.error) {
        showError(result.error);
      }
      setIsLoading(false);
    } catch (err: any) {
      showError('Erro ao ler arquivo: ' + err.message);
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Número pedido de compra Cliente', 'Item cliente', 'QTD', 'Protheus Item code', 'Fornecedor'],
      ['PED-001', '1', '10', '000001', 'FORNECEDOR ABC'],
      ['PED-001', '2', '5', '000002', 'FORNECEDOR XYZ'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'template_solicitacao_imex.xlsx');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    
    setIsDeleting(true);
    if (deleteTarget.type === 'linha') {
      const result = await excluirLinha(deleteTarget.id);
      if (result.success) {
        showSuccess('Linha excluída!');
        if (selectedSolicitacao) loadDetail(selectedSolicitacao);
      } else if (result.error) {
        showError(result.error);
      }
    } else {
      const result = await excluirSolicitacao(deleteTarget.id);
      if (result.success) {
        showSuccess('Solicitação excluída!');
        setSelectedSolicitacao(null);
        setActiveTab('solicitacoes');
        loadSolicitacoes();
      } else if (result.error) {
        showError(result.error);
      }
    }
    setIsDeleting(false);
    setDeleteTarget(null);
  };

  const handleSavePriority = async () => {
    if (!priorityDialog) return;
    
    const priority = parseInt(newPriority);
    if (isNaN(priority) || priority < 1) {
      showError('Prioridade deve ser um número >= 1');
      return;
    }
    
    setIsSavingPriority(true);
    const result = await definirPrioridade(priorityDialog.linhaId, priority);
    if (result.success) {
      showSuccess('Prioridade definida!');
      if (selectedSolicitacao) loadDetail(selectedSolicitacao);
    } else if (result.error) {
      showError(result.error);
    }
    setIsSavingPriority(false);
    setPriorityDialog(null);
    setNewPriority('');
  };

  const handleSend = async () => {
    if (!sendConfirm) return;
    
    setIsSending(true);
    const result = await enviarSolicitacao(sendConfirm);
    if (result.success) {
      showSuccess('Solicitação enviada para o Estoque!');
      loadSolicitacoes();
      if (selectedSolicitacao?.id === sendConfirm) {
        const updated = await detalheSolicitacao(sendConfirm);
        if (updated.success && updated.data) {
          setSelectedSolicitacao(updated.data.solicitacao);
          setLinhas(updated.data.linhas || []);
        }
      }
    } else if (result.error) {
      // Check if it's a stock validation error with specific items
      if (result.itensZeroStock && result.itensZeroStock.length > 0) {
        toast({
          title: 'Saldo Insuficiente',
          description: `Os seguintes itens não possuem saldo disponível: ${result.itensZeroStock.join(', ')}. Verifique o estoque antes de enviar.`,
          variant: 'destructive',
          duration: 8000,
        });
      } else {
        showError(result.error);
      }
    }
    setIsSending(false);
    setSendConfirm(null);
  };

  const calcSLA = (dataAbertura: string | null, dataInicio: string | null, dataConclusao: string | null) => {
    if (!dataAbertura) return { inicio: '-', total: '-' };
    
    const abertura = new Date(dataAbertura);
    const inicio = dataInicio ? new Date(dataInicio) : null;
    const conclusao = dataConclusao ? new Date(dataConclusao) : null;
    
    const slaInicio = inicio ? Math.round((inicio.getTime() - abertura.getTime()) / 60000) : null;
    const slaTotal = conclusao ? Math.round((conclusao.getTime() - abertura.getTime()) / 60000) : null;
    
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
    };
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
          <h1 className="text-base font-bold">Separação - Comercial</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={loadSolicitacoes} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-3 mt-2 grid w-auto grid-cols-2">
          <TabsTrigger value="solicitacoes">Minhas Solicitações</TabsTrigger>
          <TabsTrigger value="detalhe" disabled={!selectedSolicitacao}>Detalhe</TabsTrigger>
        </TabsList>

        {/* Solicitações List */}
        <TabsContent value="solicitacoes" className="flex-1 overflow-auto p-3 space-y-3">
          <Button onClick={handleCreateNew} disabled={isLoading} className="w-full gap-2">
            <Plus className="h-4 w-4" />
            Nova Solicitação
          </Button>
          
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : solicitacoes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Package className="h-10 w-10 mb-2" />
              <p>Nenhuma solicitação encontrada</p>
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
                          <p className="text-xs text-muted-foreground">{new Date(sol.created_at).toLocaleDateString('pt-BR')}</p>
                        </div>
                        <Badge className={`${statusColors[sol.status]} text-white shrink-0`}>
                          {statusLabels[sol.status]}
                        </Badge>
                      </div>
                      {sol.data_abertura && (
                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            SLA Início: {sla.inicio}
                          </span>
                          {sol.data_conclusao && (
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Total: {sla.total}
                            </span>
                          )}
                        </div>
                      )}
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
                      <p className="text-xs text-muted-foreground mt-1">
                        Criado em {new Date(selectedSolicitacao.created_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <Badge className={`${statusColors[selectedSolicitacao.status]} text-white`}>
                      {statusLabels[selectedSolicitacao.status]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {selectedSolicitacao.status === 'Rascunho' && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Button size="sm" variant="outline" onClick={handleDownloadTemplate} className="gap-1">
                        <FileText className="h-4 w-4" />
                        Template
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-1">
                        <Upload className="h-4 w-4" />
                        Importar Excel
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <Button size="sm" variant="outline" onClick={() => setShowAddLine(true)} className="gap-1">
                        <Plus className="h-4 w-4" />
                        Adicionar Linha
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeleteTarget({ type: 'solicitacao', id: selectedSolicitacao.id })}
                        className="gap-1"
                      >
                        <Trash2 className="h-4 w-4" />
                        Excluir
                      </Button>
                    </div>
                  )}
                  
                  {selectedSolicitacao.status === 'Rascunho' && linhas.length > 0 && (
                    <Button
                      className="w-full mt-3 gap-2"
                      onClick={() => setSendConfirm(selectedSolicitacao.id)}
                    >
                      <Send className="h-4 w-4" />
                      Enviar para Estoque
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
                  <p>Nenhuma linha adicionada</p>
                  <p className="text-xs">Use o template ou adicione manualmente</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">Linhas ({linhas.length})</h3>
                  {linhas.map((linha) => (
                    <Card key={linha.id}>
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{linha.codigo_item}</p>
                            <p className="text-xs text-muted-foreground">Pedido: {linha.pedido_cliente}</p>
                            {linha.fornecedor && <p className="text-xs text-muted-foreground">Forn: {linha.fornecedor}</p>}
                          </div>
                          <div className="text-right shrink-0">
                            <Badge className={`${linhaStatusColors[linha.status_linha]} text-white text-xs`}>
                              {linhaStatusLabels[linha.status_linha]}
                            </Badge>
                            <p className="text-xs mt-1">
                              <span className="font-medium">{linha.qtd_separada}</span> / {linha.qtd_solicitada}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 mt-2">
                          {linha.status_linha === 'FaltaPrioridade' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setPriorityDialog({ linhaId: linha.id, currentPriority: linha.prioridade });
                                setNewPriority(linha.prioridade?.toString() || '');
                              }}
                              className="gap-1 text-purple-600"
                            >
                              <AlertTriangle className="h-3 w-3" />
                              Definir Prioridade
                            </Button>
                          )}
                          
                          {linha.prioridade && (
                            <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                              Prioridade: {linha.prioridade}
                            </span>
                          )}
                          
                          {canEditLinha(linha) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditLinha(linha)}
                              className="gap-1"
                            >
                              <Pencil className="h-3 w-3" />
                              Editar
                            </Button>
                          )}
                          
                          {selectedSolicitacao.status === 'Rascunho' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeleteTarget({ type: 'linha', id: linha.id })}
                              className="ml-auto text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Add/Edit Line Dialog */}
      <Dialog open={showAddLine} onOpenChange={(open) => { if (!open) resetLineForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLinha ? 'Editar Linha' : 'Adicionar Linha'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Pedido Cliente *</Label>
              <Input
                value={newLine.pedido_cliente}
                onChange={(e) => setNewLine({ ...newLine, pedido_cliente: e.target.value })}
                placeholder="PED-001"
              />
            </div>
            <div>
              <Label>Item Cliente</Label>
              <Input
                value={newLine.item_cliente}
                onChange={(e) => setNewLine({ ...newLine, item_cliente: e.target.value })}
                placeholder="1"
              />
            </div>
            <div>
              <Label>Código Item *</Label>
              <div className="relative">
                <Input
                  value={newLine.codigo_item}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setNewLine({ ...newLine, codigo_item: val });
                    setCodigoValidado(null);
                  }}
                  onBlur={() => handleBuscarCodigo(newLine.codigo_item)}
                  placeholder="000001"
                  className={codigoValidado === false ? 'border-red-500' : codigoValidado === true ? 'border-green-500' : ''}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  {isSearchingCodigo && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  {!isSearchingCodigo && codigoValidado === true && <Check className="h-4 w-4 text-green-500" />}
                  {!isSearchingCodigo && codigoValidado === false && <XCircle className="h-4 w-4 text-red-500" />}
                </div>
              </div>
              {codigoValidado === false && (
                <p className="text-xs text-red-500 mt-1">Código não encontrado no sistema</p>
              )}
              {newLine.descricao && codigoValidado === true && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{newLine.descricao}</p>
              )}
            </div>
            <div>
              <Label>Quantidade *</Label>
              <Input
                type="number"
                value={newLine.qtd || ''}
                onChange={(e) => setNewLine({ ...newLine, qtd: parseInt(e.target.value) || 0 })}
                placeholder="10"
                min={1}
              />
            </div>
            <div>
              <Label>Fornecedor</Label>
              <Input
                value={newLine.fornecedor}
                onChange={(e) => setNewLine({ ...newLine, fornecedor: e.target.value })}
                placeholder="FORNECEDOR ABC"
                disabled={codigoValidado === true && !!newLine.fornecedor}
              />
              {codigoValidado === true && newLine.fornecedor && (
                <p className="text-xs text-muted-foreground mt-1">Preenchido automaticamente</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetLineForm}>Cancelar</Button>
            <Button onClick={handleAddLine} disabled={isAddingLine || codigoValidado === false}>
              {isAddingLine && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingLinha ? 'Salvar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Priority Dialog */}
      <Dialog open={!!priorityDialog} onOpenChange={() => setPriorityDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Definir Prioridade</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Prioridade (1 = mais alta)</Label>
            <Input
              type="number"
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value)}
              placeholder="1"
              min={1}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPriorityDialog(null)}>Cancelar</Button>
            <Button onClick={handleSavePriority} disabled={isSavingPriority}>
              {isSavingPriority && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {deleteTarget?.type === 'linha' ? 'esta linha' : 'esta solicitação'}?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send Confirmation */}
      <AlertDialog open={!!sendConfirm} onOpenChange={() => setSendConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar para Estoque</AlertDialogTitle>
            <AlertDialogDescription>
              Após o envio, a solicitação não poderá mais ser editada. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSend} disabled={isSending}>
              {isSending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enviar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SeparacaoComercial;
