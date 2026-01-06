import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Printer, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logoImex from '@/assets/logo-imex.png';

const IdentificacaoRuaPrint = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [rua, setRua] = useState<string>('');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const ruaParam = searchParams.get('rua');
    if (ruaParam) {
      setRua(ruaParam);
      // Wait for QR codes to render
      setTimeout(() => setIsReady(true), 500);
    }
  }, [searchParams]);

  const handlePrint = () => {
    window.print();
  };

  // URL que o QR vai apontar - usa a rota existente /estoque-rua
  const baseUrl = window.location.origin;
  const qrUrl = `${baseUrl}/estoque-rua?rua=${rua}`;

  // Formata o número da rua para exibição
  const ruaFormatada = `R${rua.toString().padStart(2, '0')}`;

  // Data e hora atuais
  const dataGeracao = new Date().toLocaleString('pt-BR');

  if (!rua) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">Carregando...</p>
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

      {/* Print Area - A4 Portrait */}
      <div 
        className="min-h-screen bg-white pt-20 print:pt-0 print:bg-white"
        id="print-area-rua"
      >
        <div 
          className="mx-auto flex flex-col items-center justify-between bg-white p-8 print:p-12"
          style={{ 
            width: '210mm', 
            minHeight: '297mm',
            maxHeight: '297mm',
          }}
        >
          {/* Header com Logo */}
          <div className="w-full flex justify-center border-b-4 border-gray-800 pb-6">
            <img 
              src={logoImex} 
              alt="IMEX" 
              className="h-16 print:h-20" 
            />
          </div>

          {/* Título Principal + QR Code - Mais próximos */}
          <div className="flex-1 flex flex-col items-center justify-center">
            <h1 
              className="text-center font-black text-gray-900 tracking-tight"
              style={{ 
                fontSize: 'clamp(100px, 25vw, 200px)',
                lineHeight: '1',
              }}
            >
              RUA
            </h1>
            <h2 
              className="text-center font-black text-gray-900 tracking-tight mt-2"
              style={{ 
                fontSize: 'clamp(140px, 35vw, 280px)',
                lineHeight: '1',
              }}
            >
              {ruaFormatada}
            </h2>
            
            {/* QR Code - Mais próximo do título */}
            <div className="mt-8 flex flex-col items-center">
              <div className="rounded-lg border-4 border-gray-800 bg-white p-4">
                <QRCodeSVG
                  value={qrUrl}
                  size={220}
                  level="H"
                  bgColor="#ffffff"
                  fgColor="#000000"
                  includeMargin={false}
                />
              </div>
              <p className="mt-4 text-xl font-medium text-gray-700 text-center">
                Escaneie para consultar os materiais desta rua
              </p>
            </div>
          </div>

          {/* Footer - Simplificado */}
          <div className="w-full border-t-2 border-gray-300 pt-4">
            <p className="text-center text-sm text-gray-500">
              IMEX SOLUTIONS - Sistema de Gerenciamento de Materiais
            </p>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          
          html, body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background: white !important;
            margin: 0;
            padding: 0;
          }
          
          body * {
            visibility: visible !important;
          }
          
          #print-area-rua {
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

export default IdentificacaoRuaPrint;
