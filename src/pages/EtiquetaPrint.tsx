import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Printer, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logoImex from '@/assets/logo-imex.png';

interface EtiquetaData {
  codigo: string;
  descricao: string;
  fabricante: string;
  tipoMaterial: string;
  endereco: string;
  peso: number;
}

const EtiquetaPrint = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [etiquetas, setEtiquetas] = useState<EtiquetaData[]>([]);
  const [isReady, setIsReady] = useState(false);
  const printAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dataParam = searchParams.get('data');
    if (dataParam) {
      try {
        const parsed = JSON.parse(decodeURIComponent(dataParam));
        setEtiquetas(parsed);
        // Wait for QR codes to render
        setTimeout(() => setIsReady(true), 500);
      } catch (e) {
        console.error('Failed to parse etiquetas data:', e);
      }
    }
  }, [searchParams]);

  const handlePrint = () => {
    window.print();
  };

  if (etiquetas.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">Carregando etiquetas...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Print Controls - Hidden when printing */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between border-b border-border bg-card p-4 print:hidden">
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <div className="flex items-center gap-2">
          {!isReady && <Loader2 className="h-4 w-4 animate-spin" />}
          <Button onClick={handlePrint} disabled={!isReady}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* Print Area */}
      <div 
        ref={printAreaRef}
        className="min-h-screen bg-white pt-20 print:pt-0 print:bg-white"
        id="print-area"
      >
        <div className="mx-auto max-w-[210mm] p-4 print:p-0">
          <div className="grid grid-cols-2 gap-4 print:gap-2">
            {etiquetas.map((etiqueta, index) => (
              <EtiquetaCard key={index} data={etiqueta} />
            ))}
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }
          
          html, body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background: white !important;
          }
          
          body * {
            visibility: visible !important;
          }
          
          #print-area {
            padding: 0 !important;
            margin: 0 !important;
          }
          
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
};

interface EtiquetaCardProps {
  data: EtiquetaData;
}

const EtiquetaCard = ({ data }: EtiquetaCardProps) => {
  // QR contém código + endereço formatado para identificação única
  const qrData = JSON.stringify({
    cod: data.codigo,
    end: data.endereco,
    desc: data.descricao.substring(0, 50),
    fab: data.fabricante,
    tipo: data.tipoMaterial,
    peso: data.peso,
  });

  return (
    <div 
      className="flex flex-col rounded-lg border-2 border-gray-800 bg-white p-3 print:rounded-none print:border print:p-2"
      style={{ 
        width: '128mm',
        height: '80mm',
        pageBreakInside: 'avoid',
        breakInside: 'avoid',
      }}
    >
      {/* Header with Logo and Procedure */}
      <div className="mb-2 flex items-center justify-between border-b border-gray-300 pb-1">
        <img src={logoImex} alt="IMEX" className="h-6 print:h-5" />
        <div className="text-center">
          <span className="text-[8px] font-medium text-gray-600">F03/01 - 8.5.2-01</span>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold text-gray-900 print:text-lg">{data.endereco}</div>
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
          <div>
            <label className="text-[8px] font-medium uppercase text-gray-500">
              Código
            </label>
            <p className="text-base font-bold text-gray-900 print:text-sm">{data.codigo}</p>
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
                Peso
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

export default EtiquetaPrint;