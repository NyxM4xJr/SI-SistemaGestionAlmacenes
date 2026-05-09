import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index.tsx";
import Login from "./pages/Login.tsx";
import Register from "./pages/Register.tsx";
import ForgotPassword from "./pages/ForgotPassword.tsx";
import UpdatePassword from "./pages/UpdatePassword";
import Profile from "./pages/Profile.tsx";
import AdminUsers from "./pages/AdminUsers.tsx";
import NotFound from "./pages/NotFound.tsx";
/** cu7: */
import InsumoList from "./pages/Insumos/InsumoList";
import InsumoForm from "./pages/Insumos/InsumoForm";
import InsumoDetail from "./pages/Insumos/InsumoDetail";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/registro" element={<Register />} />
            <Route path="/recuperar" element={<ForgotPassword />} />
            <Route path="/actualizar-contrasena" element={<UpdatePassword />} />
            <Route path="/perfil" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute roles={["administrador"]}><AdminUsers /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
            
            <Route path="/insumos" element={<ProtectedRoute roles={["administrador", "chef"]}><InsumoList /></ProtectedRoute>} />
            <Route path="/insumos/crear" element={<ProtectedRoute roles={["administrador"]}><InsumoForm /></ProtectedRoute>} />
            <Route path="/insumos/editar/:id" element={<ProtectedRoute roles={["administrador"]}><InsumoForm /></ProtectedRoute>} />
            <Route path="/insumos/:id" element={<ProtectedRoute roles={["administrador", "chef"]}><InsumoDetail /></ProtectedRoute>} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
