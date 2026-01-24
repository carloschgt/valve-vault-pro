import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Package, Loader2, MapPin, Warehouse, ArrowRightLeft, FileText, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import logoImex from '@/assets/logo-imex.png';
import { supabase } from '@/integrations/supabase/client';

const AUTH_KEY = 'imex_auth_user';

function getSessionToken(): string | null {
  try {
    const stored = localStorage.getItem(AUTH_KEY);
    if (stored) {
      const user = JSON.parse(stored);
      return user.sessionToken || null;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

interface EnderecoItem {
  endereco_id: string;
  rua: number;
  coluna: number;
  nivel: number;
  posicao: number;
  quantidade: number;
  qtd_reservada: number;
  disponivel: number;
}

interface ResumoEstoque {
  codigo: string;
  estoque_enderecado: EnderecoItem[];
  totais: {
    total_estoque_enderecado: number;
    total_reservado: number;
    total_disponivel: number;
  };
  alocacoes: {
    WIP: number;
    QUALIDADE: number;
    QUALIDADE_REPROVADO: number;
    EXPEDICAO: number;
  };
  total_geral: number;
}

const LOCAIS_ALOCACAO = ['WIP', 'QUALIDADE', 'QUALIDADE_REPROVADO', 'EXPEDICAO'] as const;
const LOCAIS_ORIGEM = ['ESTOQUE', ...LOCAIS_ALOCACAO] as const;
const LOCAIS_DESTINO = [...LOCAIS_ORIGEM, 'SAIDA_CLIENTE'] as const;

const InventarioAlocacoes = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [codigoBusca, setCodigoBusca] = useState('');
  const [resumo, setResumo] = useState<ResumoEstoque | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Contagem fora do estoque
  const [localContagem, setLocalContagem] = useState<string>('');
  const [qtdContagem, setQtdContagem] = useState('');
  const [motivoContagem, setMotivoContagem] = useState('');
  const [isSavingContagem, setIsSavingContagem] = useState(false);
  
  // Transferência
  const [origemLocal, setOrigemLocal] = useState<string>('');
  const [origemEnderecoId, setOrigemEnderecoId] = useState<string>('');
  const [destinoLocal, setDestinoLocal] = useState<string>('');
  const [destinoEnderecoId, setDestinoEnderecoId] = useState<string>('');
  const [qtdTransfer, setQtdTransfer] = useState('');
  const [motivoTransfer, setMotivoTransfer] = useState('');
  const [referenciaTransfer, setReferenciaTransfer] = useState('');
  const [nfNumero, setNfNumero] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  
  // Endereços disponíveis para seleção
  const [enderecosDisponiveis, setEnderecosDisponiveis] = useState<EnderecoItem[]>([]);

  const buscarResumo = useCallback(async () => {
    if (!codigoBusca.trim()) return;
    
    setIsLoading(true);
    try {
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        toast({ title: 'Erro', description: 'Sessão expirada', variant: 'destructive' });
        return;
      }

      const { data, error } = await supabase.functions.invoke('data-operations', {
        body: { action: 'estoque_resumo_codigo', sessionToken, codigo: codigoBusca.trim() },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setResumo(data.data);
      setEnderecosDisponiveis(data.data.estoque_enderecado || []);
    } catch (error: any) {
      console.error('Erro ao buscar resumo:', error);
      toast({ title: 'Erro', description: error.message || 'Erro ao buscar', variant: 'destructive' });
      setResumo(null);
    } finally {
      setIsLoading(false);
    }
  }, [codigoBusca, toast]);

  const handleDefinirAlocacao = async () => {
    if (!localContagem || qtdContagem === '') {
      toast({ title: 'Erro', description: 'Selecione o local e informe a quantidade', variant: 'destructive' });
      return;
    }

    setIsSavingContagem(true);
    try {
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        toast({ title: 'Erro', description: 'Sessão expirada', variant: 'destructive' });
        return;
      }

      const { data, error } = await supabase.functions.invoke('data-operations', {
        body: { 
          action: 'estoque_alocacao_set', 
          sessionToken, 
          codigo: codigoBusca.trim(),
          local: localContagem,
          quantidade: parseInt(qtdContagem),
          motivo: motivoContagem || undefined
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast({ title: 'Sucesso', description: data.message || 'Alocação definida' });
      
      // Limpar e recarregar
      setLocalContagem('');
      setQtdContagem('');
      setMotivoContagem('');
      buscarResumo();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Erro ao salvar', variant: 'destructive' });
    } finally {
      setIsSavingContagem(false);
    }
  };

  const handleTransferir = async () => {
    if (!origemLocal || !destinoLocal || !qtdTransfer) {
      toast({ title: 'Erro', description: 'Preencha origem, destino e quantidade', variant: 'destructive' });
      return;
    }

    if (origemLocal === 'ESTOQUE' && !origemEnderecoId) {
      toast({ title: 'Erro', description: 'Selecione o endereço de origem', variant: 'destructive' });
      return;
    }

    if (destinoLocal === 'ESTOQUE' && !destinoEnderecoId) {
      toast({ title: 'Erro', description: 'Selecione o endereço de destino', variant: 'destructive' });
      return;
    }

    if (destinoLocal === 'SAIDA_CLIENTE' && !nfNumero.trim()) {
      toast({ title: 'Erro', description: 'Número da NF é obrigatório para saída', variant: 'destructive' });
      return;
    }

    setIsTransferring(true);
    try {
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        toast({ title: 'Erro', description: 'Sessão expirada', variant: 'destructive' });
        return;
      }

      const { data, error } = await supabase.functions.invoke('data-operations', {
        body: { 
          action: 'estoque_transferir', 
          sessionToken, 
          codigo: codigoBusca.trim(),
          quantidade: parseInt(qtdTransfer),
          origem_local: origemLocal,
          origem_endereco_id: origemLocal === 'ESTOQUE' ? origemEnderecoId : undefined,
          destino_local: destinoLocal,
          destino_endereco_id: destinoLocal === 'ESTOQUE' ? destinoEnderecoId : undefined,
          motivo: motivoTransfer || undefined,
          nf_numero: destinoLocal === 'SAIDA_CLIENTE' ? nfNumero.trim() : undefined,
          referencia: referenciaTransfer || undefined
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast({ title: 'Sucesso', description: data.message || 'Transferência realizada' });
      
      // Limpar e recarregar
      setOrigemLocal('');
      setOrigemEnderecoId('');
      setDestinoLocal('');
      setDestinoEnderecoId('');
      setQtdTransfer('');
      setMotivoTransfer('');
      setReferenciaTransfer('');
      setNfNumero('');
      buscarResumo();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Erro na transferência', variant: 'destructive' });
    } finally {
      setIsTransferring(false);
    }
  };

  const formatEndereco = (e: EnderecoItem) => {
    return `R${String(e.rua).padStart(2, '0')}.C${String(e.coluna).padStart(2, '0')}.N${String(e.nivel).padStart(2, '0')}.P${String(e.posicao).padStart(2, '0')} (Disp: ${e.disponivel})`;
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-2 shrink-0">
        <button onClick={() => navigate('/')} className="rounded-lg p-1.5 hover:bg-accent">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <img src={logoImex} alt="IMEX Solutions" className="h-6" />
        <h1 className="text-base font-bold">Alocação Fora do Estoque</h1>
      </div>

      {/* Busca */}
      <div className="border-b border-border bg-card px-3 py-3 shrink-0">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Digite o código do material"
              value={codigoBusca}
              onChange={(e) => setCodigoBusca(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && buscarResumo()}
              className="pl-9 h-10"
            />
          </div>
          <Button onClick={buscarResumo} disabled={isLoading || !codigoBusca.trim()}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buscar'}
          </Button>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-auto p-3 space-y-4">
        {!resumo && !isLoading && (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <Package className="h-12 w-12 mb-2" />
            <p>Digite um código para ver o resumo de estoque</p>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {resumo && (
          <>
            {/* Cards de Resumo */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <Card className="bg-blue-500/10 border-blue-500/20">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Warehouse className="h-4 w-4 text-blue-600" />
                    <span className="text-xs text-muted-foreground">Endereçado</span>
                  </div>
                  <p className="text-xl font-bold text-blue-600">{resumo.totais.total_estoque_enderecado}</p>
                </CardContent>
              </Card>

              <Card className="bg-amber-500/10 border-amber-500/20">
                <CardContent className="p-3">
                  <span className="text-xs text-muted-foreground">WIP</span>
                  <p className="text-xl font-bold text-amber-600">{resumo.alocacoes.WIP}</p>
                </CardContent>
              </Card>

              <Card className="bg-purple-500/10 border-purple-500/20">
                <CardContent className="p-3">
                  <span className="text-xs text-muted-foreground">Qualidade</span>
                  <p className="text-xl font-bold text-purple-600">{resumo.alocacoes.QUALIDADE}</p>
                </CardContent>
              </Card>

              <Card className="bg-red-500/10 border-red-500/20">
                <CardContent className="p-3">
                  <span className="text-xs text-muted-foreground">Reprovado</span>
                  <p className="text-xl font-bold text-red-600">{resumo.alocacoes.QUALIDADE_REPROVADO}</p>
                </CardContent>
              </Card>

              <Card className="bg-green-500/10 border-green-500/20">
                <CardContent className="p-3">
                  <span className="text-xs text-muted-foreground">Expedição</span>
                  <p className="text-xl font-bold text-green-600">{resumo.alocacoes.EXPEDICAO}</p>
                </CardContent>
              </Card>

              <Card className="bg-primary/10 border-primary/20">
                <CardContent className="p-3">
                  <span className="text-xs text-muted-foreground font-semibold">TOTAL GERAL</span>
                  <p className="text-2xl font-bold text-primary">{resumo.total_geral}</p>
                </CardContent>
              </Card>
            </div>

            {/* Lista de Endereços */}
            {resumo.estoque_enderecado.length > 0 && (
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Endereços ({resumo.estoque_enderecado.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {resumo.estoque_enderecado.map((end) => (
                      <div key={end.endereco_id} className="px-4 py-2 flex items-center justify-between text-sm">
                        <span className="font-mono">
                          R{String(end.rua).padStart(2, '0')}.C{String(end.coluna).padStart(2, '0')}.N{String(end.nivel).padStart(2, '0')}.P{String(end.posicao).padStart(2, '0')}
                        </span>
                        <div className="flex gap-4 text-right">
                          <span>Qtd: <strong>{end.quantidade}</strong></span>
                          <span className="text-amber-600">Res: {end.qtd_reservada}</span>
                          <span className="text-green-600">Disp: <strong>{end.disponivel}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Formulário de Contagem Fora do Estoque */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Definir Quantidade (Inventário Fora do Estoque)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Local</Label>
                    <Select value={localContagem} onValueChange={setLocalContagem}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {LOCAIS_ALOCACAO.map((l) => (
                          <SelectItem key={l} value={l}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Quantidade</Label>
                    <Input 
                      type="number" 
                      min="0"
                      value={qtdContagem}
                      onChange={(e) => setQtdContagem(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Motivo (opcional)</Label>
                  <Input 
                    value={motivoContagem}
                    onChange={(e) => setMotivoContagem(e.target.value)}
                    placeholder="Ex: Contagem física"
                  />
                </div>
                <Button 
                  onClick={handleDefinirAlocacao} 
                  disabled={isSavingContagem || !localContagem || qtdContagem === ''}
                  className="w-full"
                >
                  {isSavingContagem ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Definir Quantidade
                </Button>
              </CardContent>
            </Card>

            {/* Formulário de Transferência */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4" />
                  Transferir / Baixar
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {/* Origem */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">ORIGEM</Label>
                    <Select value={origemLocal} onValueChange={(v) => { setOrigemLocal(v); setOrigemEnderecoId(''); }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Local de origem" />
                      </SelectTrigger>
                      <SelectContent>
                        {LOCAIS_ORIGEM.map((l) => (
                          <SelectItem key={l} value={l}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {origemLocal === 'ESTOQUE' && (
                      <Select value={origemEnderecoId} onValueChange={setOrigemEnderecoId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Endereço origem" />
                        </SelectTrigger>
                        <SelectContent>
                          {enderecosDisponiveis.map((e) => (
                            <SelectItem key={e.endereco_id} value={e.endereco_id}>
                              {formatEndereco(e)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Destino */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">DESTINO</Label>
                    <Select value={destinoLocal} onValueChange={(v) => { setDestinoLocal(v); setDestinoEnderecoId(''); }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Local de destino" />
                      </SelectTrigger>
                      <SelectContent>
                        {LOCAIS_DESTINO.map((l) => (
                          <SelectItem key={l} value={l}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {destinoLocal === 'ESTOQUE' && (
                      <Select value={destinoEnderecoId} onValueChange={setDestinoEnderecoId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Endereço destino" />
                        </SelectTrigger>
                        <SelectContent>
                          {enderecosDisponiveis.map((e) => (
                            <SelectItem key={e.endereco_id} value={e.endereco_id}>
                              {formatEndereco(e)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Quantidade</Label>
                    <Input 
                      type="number" 
                      min="1"
                      value={qtdTransfer}
                      onChange={(e) => setQtdTransfer(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Referência (opcional)</Label>
                    <Input 
                      value={referenciaTransfer}
                      onChange={(e) => setReferenciaTransfer(e.target.value)}
                      placeholder="Ex: Pedido 12345"
                    />
                  </div>
                </div>

                {destinoLocal === 'SAIDA_CLIENTE' && (
                  <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                    <Label className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      Número da NF (obrigatório)
                    </Label>
                    <Input 
                      value={nfNumero}
                      onChange={(e) => setNfNumero(e.target.value)}
                      placeholder="Ex: 123456"
                      className="mt-1"
                    />
                  </div>
                )}

                <div>
                  <Label className="text-xs">Motivo (opcional)</Label>
                  <Input 
                    value={motivoTransfer}
                    onChange={(e) => setMotivoTransfer(e.target.value)}
                    placeholder="Ex: Envio para qualidade"
                  />
                </div>

                <Button 
                  onClick={handleTransferir} 
                  disabled={isTransferring || !origemLocal || !destinoLocal || !qtdTransfer}
                  className="w-full"
                  variant={destinoLocal === 'SAIDA_CLIENTE' ? 'destructive' : 'default'}
                >
                  {isTransferring ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRightLeft className="h-4 w-4 mr-2" />}
                  {destinoLocal === 'SAIDA_CLIENTE' ? 'Baixar para Cliente' : 'Transferir'}
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default InventarioAlocacoes;
