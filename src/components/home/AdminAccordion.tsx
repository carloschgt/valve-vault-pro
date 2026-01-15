import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  CheckSquare,
  SlidersHorizontal,
  FileBarChart,
  Wrench,
  BookOpen,
  Database,
  History,
  Download,
  Loader2,
  ChevronDown,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { MENU_KEYS } from '@/hooks/useUserPermissions';

interface AdminAccordionProps {
  hasPermission: (key: string) => boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isExporting: 'enderecamentos' | 'inventario' | null;
  onExportEnderecamentos: () => void;
  onExportInventario: () => void;
}

export const AdminAccordion: React.FC<AdminAccordionProps> = ({
  hasPermission,
  isAdmin,
  isSuperAdmin,
  isExporting,
  onExportEnderecamentos,
  onExportInventario,
}) => {
  const navigate = useNavigate();

  const hasAnyAdminPermission =
    hasPermission(MENU_KEYS.admin_panel) ||
    hasPermission(MENU_KEYS.aprovacao_codigos) ||
    hasPermission(MENU_KEYS.controle_inventario) ||
    hasPermission(MENU_KEYS.relatorio_inventario) ||
    hasPermission(MENU_KEYS.ajuste_inventario) ||
    hasPermission(MENU_KEYS.catalogo_produto) ||
    hasPermission(MENU_KEYS.catalogo) ||
    hasPermission(MENU_KEYS.fabricantes) ||
    hasPermission(MENU_KEYS.gerenciamento_dados) ||
    isSuperAdmin;

  if (!hasAnyAdminPermission) return null;

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="admin" className="border rounded-xl bg-card">
        <AccordionTrigger className="px-4 py-3 hover:no-underline [&[data-state=open]>div>svg]:rotate-180">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
              <Lock className="h-4 w-4 text-amber-600" />
            </div>
            <div className="text-left">
              <span className="text-sm font-semibold text-foreground">
                Ações Administrativas
              </span>
              <p className="text-xs text-muted-foreground">
                Visível apenas para perfil Admin
              </p>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">
          <div className="flex flex-col gap-2">
            {hasPermission(MENU_KEYS.admin_panel) && (
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate('/admin')}
              >
                <Shield className="mr-2 h-4 w-4" />
                Painel Administrativo
              </Button>
            )}

            {hasPermission(MENU_KEYS.aprovacao_codigos) && (
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate('/aprovacao-codigos')}
              >
                <CheckSquare className="mr-2 h-4 w-4" />
                Aprovação de Códigos
              </Button>
            )}

            {hasPermission(MENU_KEYS.controle_inventario) && (
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate('/controle-inventario')}
              >
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Controle de Inventário
              </Button>
            )}

            {hasPermission(MENU_KEYS.relatorio_inventario) && (
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate('/relatorio-inventario')}
              >
                <FileBarChart className="mr-2 h-4 w-4" />
                Relatório de Divergências
              </Button>
            )}

            {hasPermission(MENU_KEYS.ajuste_inventario) && (
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate('/ajuste-inventario')}
              >
                <Wrench className="mr-2 h-4 w-4" />
                Ajustes de Inventário
              </Button>
            )}

            {hasPermission(MENU_KEYS.catalogo_produto) && (
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate('/catalogo-produto')}
              >
                <BookOpen className="mr-2 h-4 w-4" />
                Cadastro de Produto
              </Button>
            )}

            {hasPermission(MENU_KEYS.catalogo) && (
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate('/catalogo')}
              >
                <BookOpen className="mr-2 h-4 w-4" />
                Importar Catálogo
              </Button>
            )}

            {hasPermission(MENU_KEYS.gerenciamento_dados) && (
              <Button
                variant="outline"
                className="w-full justify-start border-destructive text-destructive hover:bg-destructive/10"
                onClick={() => navigate('/gerenciamento-dados')}
              >
                <Database className="mr-2 h-4 w-4" />
                Gerenciamento de Dados
              </Button>
            )}

            {isSuperAdmin && (
              <Button
                variant="outline"
                className="w-full justify-start border-amber-500 text-amber-600 hover:bg-amber-50"
                onClick={() => navigate('/auditoria-itens')}
              >
                <History className="mr-2 h-4 w-4" />
                Auditoria de Itens
              </Button>
            )}

            {isAdmin && (
              <>
                <div className="my-2 border-t border-border" />
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={onExportEnderecamentos}
                  disabled={isExporting !== null}
                >
                  {isExporting === 'enderecamentos' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Exportar Endereçamentos
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={onExportInventario}
                  disabled={isExporting !== null}
                >
                  {isExporting === 'inventario' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Exportar Inventário
                </Button>
              </>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};
