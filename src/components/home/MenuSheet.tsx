import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  BookOpen,
  Factory,
  FileSpreadsheet,
  Settings,
  Users,
  Shield,
  Download,
  FileText,
  ClipboardCheck,
  Loader2,
  UserCog,
  BarChart3,
  ShieldCheck,
  FilePlus,
  PackageSearch,
  Warehouse,
  Undo2,
  Boxes,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { MENU_KEYS } from '@/hooks/useUserPermissions';

interface MenuSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasPermission: (key: string) => boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isExporting: 'enderecamentos' | 'inventario' | null;
  onExportEnderecamentos: () => void;
  onExportInventario: () => void;
}

interface MenuItem {
  key: string;
  label: string;
  icon: React.ElementType;
  path: string;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
}

const menuItems: MenuItem[] = [
  { key: MENU_KEYS.separacao_comercial, label: 'Separação (Comercial)', icon: PackageSearch, path: '/separacao-comercial' },
  { key: MENU_KEYS.separacao_estoque, label: 'Separação (Estoque)', icon: Warehouse, path: '/separacao-estoque' },
  { key: MENU_KEYS.cancelamentos, label: 'Cancelamentos', icon: Undo2, path: '/cancelamentos' },
  { key: MENU_KEYS.solicitar_codigo, label: 'Solicitar Código', icon: FilePlus, path: '/solicitacoes-codigo' },
  { key: MENU_KEYS.catalogo, label: 'Catálogo de Produtos', icon: BookOpen, path: '/catalogo', adminOnly: true },
  { key: MENU_KEYS.fabricantes, label: 'Fabricantes', icon: Factory, path: '/fabricantes', adminOnly: true },
  { key: MENU_KEYS.processar_codigos, label: 'Processar Códigos', icon: FileSpreadsheet, path: '/processar-codigos', adminOnly: true },
  { key: MENU_KEYS.aprovacao_codigos, label: 'Aprovação de Códigos', icon: ShieldCheck, path: '/aprovacao-codigos', adminOnly: true },
  { key: MENU_KEYS.relatorio_inventario, label: 'Relatório de Inventário', icon: BarChart3, path: '/relatorio-inventario', adminOnly: true },
  { key: MENU_KEYS.inventario_alocacoes, label: 'Alocações Fora do Estoque', icon: Boxes, path: '/inventario-alocacoes', adminOnly: true },
  { key: MENU_KEYS.controle_inventario, label: 'Controle de Inventário', icon: ClipboardCheck, path: '/controle-inventario', adminOnly: true },
  { key: MENU_KEYS.gerenciamento_dados, label: 'Gerenciamento de Dados', icon: FileText, path: '/gerenciamento-dados', adminOnly: true },
  { key: MENU_KEYS.admin_panel, label: 'Configurações', icon: Settings, path: '/configuracoes', adminOnly: true },
  { key: MENU_KEYS.admin_panel, label: 'Administrar Usuários', icon: Users, path: '/admin', adminOnly: true },
  { key: MENU_KEYS.admin_panel, label: 'Gerenciar Perfis', icon: UserCog, path: '/gerenciar-perfis', adminOnly: true },
];

export const MenuSheet: React.FC<MenuSheetProps> = ({
  open,
  onOpenChange,
  hasPermission,
  isAdmin,
  isSuperAdmin,
  isExporting,
  onExportEnderecamentos,
  onExportInventario,
}) => {
  const navigate = useNavigate();

  const handleNavigate = (path: string) => {
    navigate(path);
    onOpenChange(false);
  };

  const visibleItems = menuItems.filter((item) => {
    if (item.superAdminOnly && !isSuperAdmin) return false;
    if (item.adminOnly && !isAdmin) return false;
    return hasPermission(item.key);
  });

  const showExports = isAdmin;
  const showAuditoria = isSuperAdmin;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[320px] p-0">
        <SheetHeader className="border-b border-border px-4 py-4">
          <SheetTitle className="text-left text-lg font-semibold">Menu</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-80px)]">
          <div className="space-y-1 p-3">
            {/* Regular menu items */}
            {visibleItems.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.key}
                  variant="ghost"
                  className="w-full justify-start gap-3 px-3 py-2.5 text-left"
                  onClick={() => handleNavigate(item.path)}
                >
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <span>{item.label}</span>
                </Button>
              );
            })}

            {/* Admin Actions Section */}
            {showExports && (
              <>
                <Separator className="my-3" />
                <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Ações Administrativas
                </p>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 px-3 py-2.5 text-left"
                  onClick={() => {
                    onExportEnderecamentos();
                    onOpenChange(false);
                  }}
                  disabled={isExporting === 'enderecamentos'}
                >
                  {isExporting === 'enderecamentos' ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : (
                    <Download className="h-5 w-5 text-muted-foreground" />
                  )}
                  <span>Exportar Endereçamentos</span>
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 px-3 py-2.5 text-left"
                  onClick={() => {
                    onExportInventario();
                    onOpenChange(false);
                  }}
                  disabled={isExporting === 'inventario'}
                >
                  {isExporting === 'inventario' ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : (
                    <Download className="h-5 w-5 text-muted-foreground" />
                  )}
                  <span>Exportar Inventário</span>
                </Button>
              </>
            )}

            {/* Super Admin Only */}
            {showAuditoria && (
              <>
                <Separator className="my-3" />
                <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Super Admin
                </p>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 px-3 py-2.5 text-left"
                  onClick={() => handleNavigate('/auditoria-itens')}
                >
                  <Shield className="h-5 w-5 text-amber-500" />
                  <span>Auditoria de Itens</span>
                </Button>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
