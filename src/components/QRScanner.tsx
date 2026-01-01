import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QRScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

export function QRScanner({ onScan, onClose }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const startScanner = async () => {
      try {
        // Create scanner instance
        scannerRef.current = new Html5Qrcode('qr-reader');

        // Get available cameras
        const cameras = await Html5Qrcode.getCameras();
        
        if (!cameras || cameras.length === 0) {
          setError('Nenhuma câmera encontrada');
          return;
        }

        // Find back camera (prefer environment facing camera)
        const backCamera = cameras.find(
          (camera) => 
            camera.label.toLowerCase().includes('back') ||
            camera.label.toLowerCase().includes('rear') ||
            camera.label.toLowerCase().includes('traseira') ||
            camera.label.toLowerCase().includes('environment')
        ) || cameras[cameras.length - 1]; // Usually last camera is back camera

        if (!mounted) return;

        // Start scanning with back camera directly
        await scannerRef.current.start(
          backCamera.id,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1,
          },
          (decodedText) => {
            // Stop scanning after successful read
            if (scannerRef.current) {
              scannerRef.current.stop().catch(console.error);
            }
            onScan(decodedText);
          },
          () => {
            // Ignore scan errors (camera still trying)
          }
        );

        if (mounted) {
          setIsReady(true);
        }
      } catch (err) {
        console.error('Error starting scanner:', err);
        if (mounted) {
          setError('Erro ao acessar a câmera. Verifique as permissões.');
        }
      }
    };

    startScanner();

    return () => {
      mounted = false;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(console.error);
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
          
          {!isReady && !error && (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Camera className="h-12 w-12 animate-pulse" />
                <p>Iniciando câmera...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-2 text-destructive">
                <Camera className="h-12 w-12" />
                <p className="text-center">{error}</p>
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
