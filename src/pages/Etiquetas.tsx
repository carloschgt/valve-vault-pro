import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Printer, QrCode, Loader2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InputUppercase } from '@/components/ui/input-uppercase';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { QRCodeSVG } from 'qrcode.react';
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

const Etiquetas = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);

  const [searchCode, setSearchCode] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [enderecos, setEnderecos] = useState<EnderecoMaterial[]>([]);
  const [selectedEnderecos, setSelectedEnderecos] = useState<Set<string>>(new Set());
  const [showPreview, setShowPreview] = useState(false);

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
    setEnderecos([]);
    setSelectedEnderecos(new Set());

    try {
      const { data, error } = await supabase
        .from('enderecos_materiais')
        .select(`
          id,
          codigo,
          descricao,
          tipo_material,
          peso,
          rua,
          coluna,
          nivel,
          posicao,
          ativo,
          fabricantes (nome)
        `)
        .ilike('codigo', `%${searchCode.trim()}%`)
        .order('rua', { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        toast({
          title: 'Não encontrado',
          description: 'Nenhum endereço encontrado com esse código',
          variant: 'destructive',
        });
        return;
      }

      const formatted: EnderecoMaterial[] = data.map((d: any) => ({
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
      toast({
        title: 'Sucesso',
        description: `${formatted.length} endereço(s) encontrado(s)`,
      });
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
    const activeIds = enderecos.filter(e => e.ativo).map(e => e.id);
    setSelectedEnderecos(new Set(activeIds));
  };

  const deselectAll = () => {
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

  const executePrint = () => {
    window.print();
  };

  const etiquetas = getEtiquetasData();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-border bg-card p-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-lg font-bold text-foreground">Gerar Etiquetas</h1>
          <p className="text-sm text-muted-foreground">Imprimir etiquetas com QR Code</p>
        </div>
      </div>

      {!showPreview ? (
        <div className="flex flex-1 flex-col gap-4 p-4">
          {/* Search */}
          <Card>
            <CardContent className="p-4">
              <div className="flex gap-2">
                <InputUppercase
                  placeholder="Digite o código do material"
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="flex-1"
                />
                <Button onClick={handleSearch} disabled={isSearching}>
                  {isSearching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          {enderecos.length > 0 && (
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
                    Limpar
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
        </div>
      ) : (
        <div className="flex flex-1 flex-col">
          {/* Print Preview Controls */}
          <div className="flex items-center justify-between border-b border-border bg-card p-4 print:hidden">
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <Button onClick={executePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimir
            </Button>
          </div>

          {/* Print Preview */}
          <div ref={printRef} className="flex-1 bg-white p-4 print:p-0">
            <div className="mx-auto grid max-w-[210mm] grid-cols-2 gap-4 print:gap-2">
              {etiquetas.map((etiqueta, index) => (
                <EtiquetaCard key={index} data={etiqueta} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }
          
          body * {
            visibility: hidden;
          }
          
          .print-area, .print-area * {
            visibility: visible;
          }
          
          .print\\:hidden {
            display: none !important;
          }
          
          .print\\:p-0 {
            padding: 0 !important;
          }
          
          .print\\:gap-2 {
            gap: 0.5rem !important;
          }
        }
      `}</style>
    </div>
  );
};

interface EtiquetaCardProps {
  data: EtiquetaData;
}

const EtiquetaCard = ({ data }: EtiquetaCardProps) => {
  const qrData = JSON.stringify({
    cod: data.codigo,
    desc: data.descricao,
    fab: data.fabricante,
    tipo: data.tipoMaterial,
    end: data.endereco,
    peso: data.peso,
  });

  return (
    <div className="flex h-[120mm] w-full flex-col rounded-lg border-2 border-border bg-white p-4 print:h-[95mm] print:rounded-none print:border print:p-3">
      {/* Header with Logo */}
      <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
        <img src={logoImex} alt="IMEX" className="h-8 print:h-6" />
        <div className="text-right">
          <div className="text-2xl font-bold text-primary print:text-xl">{data.endereco}</div>
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
            className="print:h-[80px] print:w-[80px]"
          />
          <span className="mt-1 text-[10px] text-muted-foreground">Escaneie para info</span>
        </div>

        {/* Info */}
        <div className="flex flex-1 flex-col justify-center space-y-2">
          <div>
            <label className="text-[10px] font-medium uppercase text-muted-foreground">
              Código
            </label>
            <p className="text-xl font-bold text-foreground print:text-lg">{data.codigo}</p>
          </div>
          
          <div>
            <label className="text-[10px] font-medium uppercase text-muted-foreground">
              Descrição
            </label>
            <p className="text-sm font-medium text-foreground line-clamp-2 print:text-xs">
              {data.descricao}
            </p>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-[10px] font-medium uppercase text-muted-foreground">
                Fabricante
              </label>
              <p className="text-sm font-semibold text-foreground print:text-xs">
                {data.fabricante}
              </p>
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-medium uppercase text-muted-foreground">
                Tipo
              </label>
              <p className="text-sm font-semibold text-foreground print:text-xs">
                {data.tipoMaterial}
              </p>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-medium uppercase text-muted-foreground">
              Peso
            </label>
            <p className="text-sm font-semibold text-foreground print:text-xs">
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
