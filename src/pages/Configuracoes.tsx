import { Smartphone, Info, Database, Trash2 } from 'lucide-react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import logo from '@/assets/logo-mrx.png';

const Configuracoes = () => {
  const handleClearData = () => {
    if (confirm('Tem certeza que deseja limpar todos os dados? Esta ação não pode ser desfeita.')) {
      localStorage.removeItem('mrx_materiais');
      localStorage.removeItem('mrx_movimentacoes');
      toast.success('Dados limpos com sucesso. Recarregue a página.');
      window.location.reload();
    }
  };

  return (
    <MobileLayout title="Configurações">
      <div className="animate-fade-in space-y-6 p-4">
        {/* App Info */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm text-center">
          <img src={logo} alt="MRX Solutions" className="h-16 w-auto mx-auto mb-4" />
          <h2 className="font-display text-xl font-bold text-foreground">
            MRX Estoque
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Sistema de Gestão de Armazenamento
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Versão 1.0.0
          </p>
        </div>

        {/* Install PWA */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-accent p-3">
              <Smartphone className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-display font-semibold text-foreground">
                Instalar no Celular
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Para instalar este app no seu celular:
              </p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                <li>• <strong>iPhone:</strong> Toque em "Compartilhar" e "Adicionar à Tela de Início"</li>
                <li>• <strong>Android:</strong> Toque no menu (⋮) e "Instalar aplicativo"</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Data Management */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-muted p-3">
              <Database className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="font-display font-semibold text-foreground">
                Armazenamento Local
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Os dados são salvos localmente no seu dispositivo. Para sincronizar entre dispositivos, use a função de exportar/importar.
              </p>
            </div>
          </div>
        </div>

        {/* Clear Data */}
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-destructive/10 p-3">
              <Trash2 className="h-6 w-6 text-destructive" />
            </div>
            <div className="flex-1">
              <h3 className="font-display font-semibold text-foreground">
                Limpar Dados
              </h3>
              <p className="text-sm text-muted-foreground mt-1 mb-3">
                Remover todos os materiais e movimentações cadastrados.
              </p>
              <Button variant="destructive" size="sm" onClick={handleClearData}>
                Limpar Tudo
              </Button>
            </div>
          </div>
        </div>

        {/* About */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-accent p-3">
              <Info className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-display font-semibold text-foreground">
                Sobre
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Sistema desenvolvido para padronização de armazenamento de materiais da MRX Solutions - fornecedora de válvulas, atuadores e equipamentos para o setor de petróleo e gás.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} MRX Solutions
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Great Place to Work Certified
          </p>
        </div>
      </div>
    </MobileLayout>
  );
};

export default Configuracoes;
