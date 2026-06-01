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
import InsumoDetail from "./pages/Insumos/InsumoDetail";
import FichaSearch from "./pages/Insumos/FichaSearch";

// Para páginas no creadas aún
import Placeholder from "./pages/Placeholder";

// Stock
import StockList from "./pages/Stock/StockList";
import StockForm from "@/pages/Stock/StockForm";

// CU12 - Lotes
import Lotes from "./pages/Lotes";

// Proveedores
import ProveedorList from "./pages/Proveedores/ProveedorList";
import AsociarInsumos from "./pages/Proveedores/AsociarInsumos";

// Menus
import MenuList from "./pages/Menus/MenuList";
import MenuDetalle from "./pages/Menus/MenuDetalle";

import HistorialPrecios from "./pages/HistorialPrecios/HistorialPrecios";
import Estacionalidad from "./pages/Estacionalidad/Estacionalidad";

// ── Ciclo 3 ──────────────────────────────────────────────────
// CU20 - Platos del Menú
import PlatoList from "./pages/Platos/PlatoList";
import PlatoForm from "./pages/Platos/PlatoForm";

// CU21 - Recetas
import RecetaList from "./pages/Recetas/RecetaList";
import RecetaForm from "./pages/Recetas/RecetaForm";

// CU14 - Movimientos de Inventario
import MovimientoList from "./pages/Movimientos/MovimientoList";
import MovimientoForm from "./pages/Movimientos/MovimientoForm";

// CU13 - Alertas de Stock
import AlertaList from "./pages/Alertas/AlertaList";

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
            <Route path="/insumos/crear" element={<ProtectedRoute roles={["administrador"]}><InsumoForm /></ProtectedRoute>} />
            <Route path="/insumos/:id/editar" element={<ProtectedRoute roles={["administrador", "chef"]}><InsumoForm /></ProtectedRoute>} />
            <Route path="/insumos/:id" element={<ProtectedRoute roles={["administrador", "chef"]}><InsumoDetail /></ProtectedRoute>} />
            <Route path="/insumos/ficha" element={<ProtectedRoute roles={["administrador", "chef", "gerente", "usuario"]}><FichaSearch /></ProtectedRoute>} />

            {/* PAQUETE 3: Inventario - Stock */}
            <Route path="/stock" element={<ProtectedRoute roles={["administrador", "chef"]}><StockList /></ProtectedRoute>} />
            <Route path="/stock/nuevo" element={<ProtectedRoute roles={["administrador", "chef"]}><StockForm /></ProtectedRoute>} />
            <Route path="/stock/editar/:id" element={<ProtectedRoute roles={["administrador", "chef"]}><StockForm /></ProtectedRoute>} />
            <Route path="/stock/ajuste" element={<ProtectedRoute roles={["administrador", "chef"]}><StockForm /></ProtectedRoute>} />

            {/* CU12 - Gestión de Lotes */}
            <Route path="/lotes" element={<ProtectedRoute roles={["administrador"]}><Lotes /></ProtectedRoute>} />

            {/* ══════════════════════════════════════════════
                            CICLO #3
                ══════════════════════════════════════════════ */}

            {/* PAQUETE 4: Menús y Recetas */}

            {/* CU20 - Gestionar Platos del Menú */}
            <Route path="/platos" element={<ProtectedRoute roles={["administrador", "chef"]}><PlatoList /></ProtectedRoute>} />
            <Route path="/platos/nuevo" element={<ProtectedRoute roles={["administrador", "chef"]}><PlatoForm /></ProtectedRoute>} />
            <Route path="/platos/:id/editar" element={<ProtectedRoute roles={["administrador", "chef"]}><PlatoForm /></ProtectedRoute>} />

            {/* CU21 - Gestionar Recetas */}
            <Route path="/recetas" element={<ProtectedRoute roles={["administrador", "chef"]}><RecetaList /></ProtectedRoute>} />
            <Route path="/recetas/nueva" element={<ProtectedRoute roles={["administrador", "chef"]}><RecetaForm /></ProtectedRoute>} />
            <Route path="/recetas/:id/editar" element={<ProtectedRoute roles={["administrador", "chef"]}><RecetaForm /></ProtectedRoute>} />

            {/* CU14 - Registrar Movimiento de Inventario */}
            <Route path="/movimientos" element={<ProtectedRoute roles={["administrador", "chef"]}><MovimientoList /></ProtectedRoute>} />
            <Route path="/movimientos/nuevo" element={<ProtectedRoute roles={["administrador", "chef"]}><MovimientoForm /></ProtectedRoute>} />
            
            {/* CU13 - Alertas de Stock */}
            <Route path="/alertas" element={<ProtectedRoute roles={["administrador", "chef"]}><AlertaList /></ProtectedRoute>} />


            {/* Placeholders — módulos pendientes de implementación */}
            <Route path="/estacionalidad" element={<ProtectedRoute roles={["administrador", "gerente", "chef"]}><Estacionalidad /></ProtectedRoute>} />
            <Route path="/historial-precios" element={<ProtectedRoute roles={["administrador", "gerente", "chef"]}><HistorialPrecios /></ProtectedRoute>} />
            <Route path="/cierre-turno" element={<ProtectedRoute><Placeholder /></ProtectedRoute>} />
            <Route path="/descargo" element={<ProtectedRoute><Placeholder /></ProtectedRoute>} />
            <Route path="/merma-tecnica" element={<ProtectedRoute><Placeholder /></ProtectedRoute>} />
            <Route path="/menus" element={<ProtectedRoute roles={["administrador", "gerente", "chef"]}><MenuList /></ProtectedRoute>} />
            <Route path="/menus/:id" element={<ProtectedRoute roles={["administrador", "gerente", "chef"]}><MenuDetalle /></ProtectedRoute>} />
            <Route path="/sugerir-menu" element={<ProtectedRoute><Placeholder /></ProtectedRoute>} />
            <Route path="/proveedores" element={<ProtectedRoute roles={["administrador", "gerente"]}><ProveedorList /></ProtectedRoute>} />
            <Route path="/proveedores/asociar" element={<ProtectedRoute roles={["administrador"]}><AsociarInsumos /></ProtectedRoute>} />
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