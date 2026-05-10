/**
 * ============================================================
 * ARCHIVO: frontend/src/App.tsx
 * MODIFICADO: 10/05/26 - Reestructuración de rutas (Ciclo 2)
 * 
 * CAMBIOS:
 * - Agregadas rutas para CU02, CU05, CU06, CU08, CU30
 * - Reorganizadas rutas existentes según nueva estructura de paquetes
 * - Rutas de CU futuros agregadas como placeholders comentados
 * ============================================================
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";

// Páginas existentes
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import UpdatePassword from "./pages/UpdatePassword";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";


// Páginas del Ciclo 2
import AdminUsers from "./pages/AdminUsers";
import UserForm from "./pages/UserForm";
import AdminPermisos from "./pages/AdminPermisos";
import AdminRoles from "./pages/AdminRoles";
import BitacoraList from "./pages/BitacoraList";
import InsumoList from "./pages/Insumos/InsumoList";
import InsumoForm from "./pages/Insumos/InsumoForm";
import FichaSearch from "./pages/Insumos/FichaSearch";

// TEMPORAL PARA LAS PAGINAS NO CREADAS AUN
import Placeholder from "./pages/Placeholder";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Públicas */}
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/registro" element={<Register />} />
            <Route path="/recuperar" element={<ForgotPassword />} />
            <Route path="/actualizar-contrasena" element={<UpdatePassword />} />

            {/* PAQUETE 1: Administración de Usuarios */}
            <Route path="/perfil" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/admin/usuarios" element={<ProtectedRoute roles={["administrador"]}><AdminUsers /></ProtectedRoute>} />
            <Route path="/admin/usuarios/crear" element={<ProtectedRoute roles={["administrador"]}><UserForm /></ProtectedRoute>} />
            <Route path="/admin/usuarios/:id/editar" element={<ProtectedRoute roles={["administrador"]}><UserForm /></ProtectedRoute>} />
            <Route path="/admin/permisos" element={<ProtectedRoute roles={["administrador"]}><AdminPermisos /></ProtectedRoute>} />
            <Route path="/admin/roles" element={<ProtectedRoute roles={["administrador"]}><AdminRoles /></ProtectedRoute>} />
            <Route path="/bitacora" element={<ProtectedRoute roles={["administrador", "gerente"]}><BitacoraList /></ProtectedRoute>} />

            {/* PAQUETE 2: Gestión de Insumos */}
            <Route path="/insumos" element={<ProtectedRoute roles={["administrador", "chef"]}><InsumoList /></ProtectedRoute>} />
            <Route path="/insumos/crear" element={<ProtectedRoute roles={["administrador", "chef"]}><InsumoForm /></ProtectedRoute>} />
            <Route path="/insumos/:id/editar" element={<ProtectedRoute roles={["administrador", "chef"]}><InsumoForm /></ProtectedRoute>} />
            <Route path="/insumos/ficha" element={<ProtectedRoute roles={["administrador", "chef", "gerente", "usuario"]}><FichaSearch /></ProtectedRoute>} />

            <Route path="/estacionalidad" element={<ProtectedRoute><Placeholder /></ProtectedRoute>} />
            <Route path="/historial-precios" element={<ProtectedRoute><Placeholder /></ProtectedRoute>} />
            <Route path="/stock" element={<ProtectedRoute><Placeholder /></ProtectedRoute>} />
            <Route path="/stock/ajuste" element={<ProtectedRoute><Placeholder /></ProtectedRoute>} />
            <Route path="/lotes" element={<ProtectedRoute><Placeholder /></ProtectedRoute>} />
            <Route path="/movimientos" element={<ProtectedRoute><Placeholder /></ProtectedRoute>} />
            <Route path="/alertas" element={<ProtectedRoute><Placeholder /></ProtectedRoute>} />
            <Route path="/cierre-turno" element={<ProtectedRoute><Placeholder /></ProtectedRoute>} />
            <Route path="/descargo" element={<ProtectedRoute><Placeholder /></ProtectedRoute>} />
            <Route path="/platos" element={<ProtectedRoute><Placeholder /></ProtectedRoute>} />
            <Route path="/recetas" element={<ProtectedRoute><Placeholder /></ProtectedRoute>} />
            <Route path="/merma-tecnica" element={<ProtectedRoute><Placeholder /></ProtectedRoute>} />
            <Route path="/menus" element={<ProtectedRoute><Placeholder /></ProtectedRoute>} />
            <Route path="/sugerir-menu" element={<ProtectedRoute><Placeholder /></ProtectedRoute>} />
            <Route path="/proveedores" element={<ProtectedRoute><Placeholder /></ProtectedRoute>} />
            <Route path="/proveedores/asociar" element={<ProtectedRoute><Placeholder /></ProtectedRoute>} />
            <Route path="/proveedores/mapa" element={<ProtectedRoute><Placeholder /></ProtectedRoute>} />
            <Route path="/reportes/valor-perdido" element={<ProtectedRoute><Placeholder /></ProtectedRoute>} />
            <Route path="/reportes/rotacion" element={<ProtectedRoute><Placeholder /></ProtectedRoute>} />
            <Route path="/reportes/costos" element={<ProtectedRoute><Placeholder /></ProtectedRoute>} />
            <Route path="/reportes/comparativa" element={<ProtectedRoute><Placeholder /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Placeholder /></ProtectedRoute>} />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;