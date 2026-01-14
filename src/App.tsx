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
            <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/enderecamento" element={<ProtectedRoute><Enderecamento /></ProtectedRoute>} />
            <Route path="/inventario" element={<ProtectedRoute><Inventario /></ProtectedRoute>} />
            <Route path="/fabricantes" element={<ProtectedRoute adminOnly><Fabricantes /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/catalogo" element={<ProtectedRoute adminOnly><Catalogo /></ProtectedRoute>} />
            <Route path="/catalogo-produto" element={<ProtectedRoute><CatalogoProduto /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute adminOnly><Admin /></ProtectedRoute>} />
            <Route path="/admin/usuarios/:id" element={<ProtectedRoute adminOnly><AdminUserDetail /></ProtectedRoute>} />
            <Route path="/admin/perfis" element={<ProtectedRoute adminOnly><GerenciarPerfis /></ProtectedRoute>} />
            <Route path="/gerenciamento-dados" element={<ProtectedRoute adminOnly><GerenciamentoDados /></ProtectedRoute>} />
            <Route path="/etiquetas" element={<ProtectedRoute allowRoles={['admin', 'user', 'estoque']}><Etiquetas /></ProtectedRoute>} />
            <Route path="/estoque-atual" element={<ProtectedRoute><EstoqueAtual /></ProtectedRoute>} />
            <Route path="/estoque-rua" element={<ProtectedRoute><EstoqueRua /></ProtectedRoute>} />
            <Route path="/controle-inventario" element={<ProtectedRoute adminOnly><ControleInventario /></ProtectedRoute>} />
            <Route path="/relatorio-inventario" element={<ProtectedRoute adminOnly><RelatorioInventario /></ProtectedRoute>} />
            <Route path="/ajuste-inventario" element={<ProtectedRoute adminOnly><AjusteInventario /></ProtectedRoute>} />
            <Route path="/solicitacoes-codigo" element={<ProtectedRoute allowRoles={['admin', 'user']}><NovaSolicitacao /></ProtectedRoute>} />
            <Route path="/processar-codigos" element={<ProtectedRoute allowRoles={['comercial', 'admin']}><SolicitacoesCodigo /></ProtectedRoute>} />
            <Route path="/aprovacao-codigos" element={<ProtectedRoute adminOnly><AprovacaoCodigos /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
