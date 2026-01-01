import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X, Camera, FlipHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QRScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

export function QRScanner({ onScan, onClose }: QRScannerProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Small delay to ensure DOM is ready
    const timeout = setTimeout(() => {
      scannerRef.current = new Html5QrcodeScanner(
        'qr-reader',
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
          showTorchButtonIfSupported: true,
          rememberLastUsedCamera: true,
        },
        false
      );

      scannerRef.current.render(
        (decodedText) => {
          // Stop scanning after successful read
          if (scannerRef.current) {
            scannerRef.current.clear().catch(console.error);
          }
          onScan(decodedText);
        },
        (error) => {
          // Ignore scan errors (camera still trying)
          console.debug('QR scan error:', error);
        }
      );

      setIsReady(true);
    }, 100);

    return () => {
      clearTimeout(timeout);
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <Camera className="h-5 w-5 text-primary" />
          <h2 className="font-bold">Ler QR Code</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Scanner area */}
      <div className="flex flex-1 flex-col items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div id="qr-reader" className="rounded-xl overflow-hidden" />
          
          {!isReady && (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Camera className="h-12 w-12 animate-pulse" />
                <p>Iniciando câmera...</p>
              </div>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Posicione o QR Code da etiqueta dentro da área de leitura
        </p>
      </div>

      {/* Cancel button */}
      <div className="border-t border-border bg-card p-4">
        <Button variant="outline" className="w-full" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
