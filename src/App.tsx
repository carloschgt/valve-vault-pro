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
import Admin from "./pages/Admin";
import AdminUserDetail from "./pages/AdminUserDetail";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import GerenciamentoDados from "./pages/GerenciamentoDados";
import Etiquetas from "./pages/Etiquetas";
import EtiquetaPrint from "./pages/EtiquetaPrint";
import EstoqueAtual from "./pages/EstoqueAtual";

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
            <Route path="/etiquetas/print" element={<ProtectedRoute allowRoles={['admin', 'user', 'estoque']}><EtiquetaPrint /></ProtectedRoute>} />
            <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/enderecamento" element={<ProtectedRoute><Enderecamento /></ProtectedRoute>} />
            <Route path="/inventario" element={<ProtectedRoute><Inventario /></ProtectedRoute>} />
            <Route path="/fabricantes" element={<ProtectedRoute adminOnly><Fabricantes /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/catalogo" element={<ProtectedRoute adminOnly><Catalogo /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute adminOnly><Admin /></ProtectedRoute>} />
            <Route path="/admin/usuarios/:id" element={<ProtectedRoute adminOnly><AdminUserDetail /></ProtectedRoute>} />
            <Route path="/gerenciamento-dados" element={<ProtectedRoute adminOnly><GerenciamentoDados /></ProtectedRoute>} />
            <Route path="/etiquetas" element={<ProtectedRoute allowRoles={['admin', 'user', 'estoque']}><Etiquetas /></ProtectedRoute>} />
            <Route path="/estoque-atual" element={<ProtectedRoute><EstoqueAtual /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
