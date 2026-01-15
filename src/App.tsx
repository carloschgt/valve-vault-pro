import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Home from "./pages/Home";
import Enderecamento from "./pages/Enderecamento";
import Inventario from "./pages/Inventario";
import Fabricantes from "./pages/Fabricantes";
import Dashboard from "./pages/Dashboard";
import Catalogo from "./pages/Catalogo";
import CatalogoProduto from "./pages/CatalogoProduto";
import Admin from "./pages/Admin";
import AdminUserDetail from "./pages/AdminUserDetail";
import GerenciarPerfis from "./pages/GerenciarPerfis";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import GerenciamentoDados from "./pages/GerenciamentoDados";
import Etiquetas from "./pages/Etiquetas";
import EtiquetaPrint from "./pages/EtiquetaPrint";
import EstoqueAtual from "./pages/EstoqueAtual";
import ControleInventario from "./pages/ControleInventario";
import RelatorioInventario from "./pages/RelatorioInventario";
import AjusteInventario from "./pages/AjusteInventario";
import EstoqueRua from "./pages/EstoqueRua";
import IdentificacaoRuaPrint from "./pages/IdentificacaoRuaPrint";
import NovaSolicitacao from "./pages/NovaSolicitacao";
import SolicitacoesCodigo from "./pages/SolicitacoesCodigo";
import AprovacaoCodigos from "./pages/AprovacaoCodigos";
import ResetPassword from "./pages/ResetPassword";
import AuditoriaItens from "./pages/AuditoriaItens";
import Configuracoes from "./pages/Configuracoes";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-center" richColors />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/etiquetas/print" element={<ProtectedRoute allowRoles={['admin', 'user', 'estoque']}><EtiquetaPrint /></ProtectedRoute>} />
            <Route path="/etiquetas/identificacao-rua" element={<ProtectedRoute allowRoles={['admin', 'estoque']}><IdentificacaoRuaPrint /></ProtectedRoute>} />
            <Route path="/" element={<ProtectedRoute requiredPermission="home"><Home /></ProtectedRoute>} />
            <Route path="/home" element={<ProtectedRoute requiredPermission="home"><Home /></ProtectedRoute>} />
            <Route path="/enderecamento" element={<ProtectedRoute requiredPermission="enderecamento"><Enderecamento /></ProtectedRoute>} />
            <Route path="/inventario" element={<ProtectedRoute requiredPermission="inventario"><Inventario /></ProtectedRoute>} />
            <Route path="/fabricantes" element={<ProtectedRoute requiredPermission="fabricantes"><Fabricantes /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute requiredPermission="dashboard"><Dashboard /></ProtectedRoute>} />
            <Route path="/catalogo" element={<ProtectedRoute requiredPermission="catalogo"><Catalogo /></ProtectedRoute>} />
            <Route path="/catalogo-produto" element={<ProtectedRoute requiredPermission="catalogo_produto"><CatalogoProduto /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute requiredPermission="admin_panel"><Admin /></ProtectedRoute>} />
            <Route path="/admin/usuarios/:id" element={<ProtectedRoute requiredPermission="admin_panel"><AdminUserDetail /></ProtectedRoute>} />
            <Route path="/admin/perfis" element={<ProtectedRoute requiredPermission="admin_panel"><GerenciarPerfis /></ProtectedRoute>} />
            <Route path="/gerenciamento-dados" element={<ProtectedRoute requiredPermission="gerenciamento_dados"><GerenciamentoDados /></ProtectedRoute>} />
            <Route path="/etiquetas" element={<ProtectedRoute requiredPermission="etiquetas"><Etiquetas /></ProtectedRoute>} />
            <Route path="/estoque-atual" element={<ProtectedRoute requiredPermission="estoque_atual"><EstoqueAtual /></ProtectedRoute>} />
            <Route path="/estoque-rua" element={<ProtectedRoute requiredPermission="estoque_rua"><EstoqueRua /></ProtectedRoute>} />
            <Route path="/controle-inventario" element={<ProtectedRoute requiredPermission="controle_inventario"><ControleInventario /></ProtectedRoute>} />
            <Route path="/relatorio-inventario" element={<ProtectedRoute requiredPermission="relatorio_inventario"><RelatorioInventario /></ProtectedRoute>} />
            <Route path="/ajuste-inventario" element={<ProtectedRoute requiredPermission="ajuste_inventario"><AjusteInventario /></ProtectedRoute>} />
            <Route path="/solicitacoes-codigo" element={<ProtectedRoute requiredPermission="solicitar_codigo"><NovaSolicitacao /></ProtectedRoute>} />
            <Route path="/processar-codigos" element={<ProtectedRoute requiredPermission="processar_codigos"><SolicitacoesCodigo /></ProtectedRoute>} />
            <Route path="/aprovacao-codigos" element={<ProtectedRoute requiredPermission="aprovacao_codigos"><AprovacaoCodigos /></ProtectedRoute>} />
            <Route path="/auditoria-itens" element={<ProtectedRoute requiredPermission="admin_panel"><AuditoriaItens /></ProtectedRoute>} />
            <Route path="/configuracoes" element={<ProtectedRoute requiredPermission="admin_panel"><Configuracoes /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
