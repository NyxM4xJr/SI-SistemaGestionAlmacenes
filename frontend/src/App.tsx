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


// ── Ciclo 3 ──────────────────────────────────────────────────
// CU20 - Platos del Menú
import PlatoList from "./pages/Platos/PlatoList";
import PlatoForm from "./pages/Platos/PlatoForm";

// CU21 - Recetas
import RecetaList from "./pages/Recetas/RecetaList";
import RecetaForm from "./pages/Recetas/RecetaForm";

// CU22 - Configurar Merma Técnica -- Se desarrolla como extension de los CUS 07 y 08
  // por eso no se crean rutas nuevas, sino que se accede desde la ficha técnica del insumo

// CU14 - Movimientos de Inventario
import MovimientoList from "./pages/Movimientos/MovimientoList";
import MovimientoForm from "./pages/Movimientos/MovimientoForm";

// CU13 - Alertas de Stock
import AlertaList from "./pages/Alertas/AlertaList";

// CU17 - Proveedores
import ProveedorList from "./pages/Proveedores/ProveedorList";

// CU18 - Asociar Insumos a Proveedores
import AsociarInsumos from "./pages/Proveedores/AsociarInsumos";

// CU23 - Gestinar Menús
import MenuList from "./pages/Menus/MenuList";
import MenuDetalle from "./pages/Menus/MenuDetalle";

// CU9 - Historial de Precios
import HistorialPrecios from "./pages/HistorialPrecios/HistorialPrecios";

// CU10 - Estacionalidad de Insumos
import Estacionalidad from "./pages/Estacionalidad/Estacionalidad";



// ── Ciclo 4 ──────────────────────────────────────────────────
// CU15 - Validar Cierre de Turno
import CierreTurno from "./pages/CierreTurno/CierreTurno";

// CU27 - Generar Reporte de Costos por Plato
import ReporteCostos from "./pages/Reportes/ReporteCostos";

// CU24 - Consultar Sugerencia de Menú por Temporada
import SugerirMenu from "./pages/Menus/SugerirMenu";

// CU19 - Localizar Proveedores mediante Mapa
import MapaProveedores from "./pages/Proveedores/MapaProveedores";

// CU31 - Pasarela de Pagos (Stripe)
import PagoDeposito from "./pages/Pagos/PagoDeposito";
import HistorialPagos from "./pages/Pagos/HistorialPagos";

// CU26 - Generar Reporte de Rotacion de Inventario
import ReporteRotacion from "./pages/Reportes/ReporteRotacion";

// CU25 - Generar Reporte de Valor Perdido
import ReporteValorPerdido from "./pages/Reportes/ReporteValorPerdido";

// CU29 - Visualizar Dashboard de KPIs
import DashboardKPIs from "./pages/Dashboard/DashboardKPIs";
import ReporteComparativa from "@/pages/Reportes/ReporteComparativa";

// CU16 - Generar Propuesta de Descargo Automático
import DescargoAutomatico from "./pages/Descargo/DescargoAutomatico";

// ── Ciclo 5 ──────────────────────────────────────────────────
// CU34 - Gestión de Caducidad FEFO
import CaducidadList from "./pages/Caducidad/CaducidadList";

// CU36 - Órdenes de Compra Automáticas
import OrdenCompraList from "./pages/OrdenesCompra/OrdenCompraList";

// CU38 - Generación de Recetas con IA
import RecetasIA from "./pages/Menus/RecetasIA";

// CU39/CU40/CU41 - Facturas con IA (OCR, conciliación, anomalías)
import FacturaOCR from "./pages/Facturas/FacturaOCR";
import FacturaList from "./pages/Facturas/FacturaList";

// CU42 - Recepción de Lote Asistida por IA
import RecepcionMercancia from "./pages/Recepcion/RecepcionMercancia";
// CU43 - Auditoría Inteligente de Bitácora
import AuditoriaIA from "./pages/Seguridad/AuditoriaIA";
// CU44 - Pronóstico de Demanda
import PronosticoDemanda from "./pages/Reportes/PronosticoDemanda";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>

          {/* PAQUETE 1: Administración de Usuarios */}
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/registro" element={<Register />} />
            <Route path="/recuperar" element={<ForgotPassword />} />
            <Route path="/actualizar-contrasena" element={<UpdatePassword />} />
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
            
              {/* CU9 - Historial de Precios */}
            <Route path="/estacionalidad" element={<ProtectedRoute roles={["administrador", "gerente", "chef"]}><Estacionalidad /></ProtectedRoute>} />
            
              {/* CU10 - Estacionalidad de Insumos */}
            <Route path="/historial-precios" element={<ProtectedRoute roles={["administrador", "gerente", "chef"]}><HistorialPrecios /></ProtectedRoute>} />


          {/* PAQUETE 3: Inventario - Stock */}
            <Route path="/stock" element={<ProtectedRoute roles={["administrador", "chef"]}><StockList /></ProtectedRoute>} />
            <Route path="/stock/nuevo" element={<ProtectedRoute roles={["administrador", "chef"]}><StockForm /></ProtectedRoute>} />
            <Route path="/stock/editar/:id" element={<ProtectedRoute roles={["administrador", "chef"]}><StockForm /></ProtectedRoute>} />
            <Route path="/stock/ajuste" element={<ProtectedRoute roles={["administrador", "chef"]}><StockForm /></ProtectedRoute>} />

            {/* CU12 - Gestión de Lotes */}
            <Route path="/lotes" element={<ProtectedRoute roles={["administrador"]}><Lotes /></ProtectedRoute>} />

            {/* CU14 - Registrar Movimiento de Inventario */}
            <Route path="/movimientos" element={<ProtectedRoute roles={["administrador", "chef"]}><MovimientoList /></ProtectedRoute>} />
            <Route path="/movimientos/nuevo" element={<ProtectedRoute roles={["administrador", "chef"]}><MovimientoForm /></ProtectedRoute>} />
            
            {/* CU13 - Alertas de Stock */}
            <Route path="/alertas" element={<ProtectedRoute roles={["administrador", "chef"]}><AlertaList /></ProtectedRoute>} />

            {/* CU15 - Validar Cierre de Turno */}
            <Route path="/cierre-turno" element={<ProtectedRoute roles={["chef"]}><CierreTurno /></ProtectedRoute>} />

            {/* CU16 - Generar Propuesta de Descargo automático */}
            <Route path="/descargo" element={<ProtectedRoute roles={["administrador", "chef"]}><DescargoAutomatico /></ProtectedRoute>} />

            
          {/* PAQUETE 4: Menús y Recetas */}

            {/* CU20 - Gestionar Platos del Menú */}
            <Route path="/platos" element={<ProtectedRoute roles={["administrador", "chef"]}><PlatoList /></ProtectedRoute>} />
            <Route path="/platos/nuevo" element={<ProtectedRoute roles={["administrador", "chef"]}><PlatoForm /></ProtectedRoute>} />
            <Route path="/platos/:id/editar" element={<ProtectedRoute roles={["administrador", "chef"]}><PlatoForm /></ProtectedRoute>} />

            {/* CU21 - Gestionar Recetas */}
            <Route path="/recetas" element={<ProtectedRoute roles={["administrador", "chef"]}><RecetaList /></ProtectedRoute>} />
            <Route path="/recetas/nueva" element={<ProtectedRoute roles={["administrador", "chef"]}><RecetaForm /></ProtectedRoute>} />
            <Route path="/recetas/:id/editar" element={<ProtectedRoute roles={["administrador", "chef"]}><RecetaForm /></ProtectedRoute>} />

            {/* CU23 - Gestionar Menús */}
            <Route path="/menus" element={<ProtectedRoute roles={["administrador", "gerente", "chef"]}><MenuList /></ProtectedRoute>} />
            <Route path="/menus/:id" element={<ProtectedRoute roles={["administrador", "gerente", "chef"]}><MenuDetalle /></ProtectedRoute>} />

            {/* CU24 - Consultar Sugerencia de Menú por Temporada */}
            <Route path="/sugerir-menu" element={<ProtectedRoute roles={["administrador", "gerente", "chef"]}><SugerirMenu /></ProtectedRoute>} />
            <Route path="/recetas-ia" element={<ProtectedRoute roles={["administrador", "gerente", "chef"]}><RecetasIA /></ProtectedRoute>} />


          {/* PAQUETE 5: Proveedores */}
            {/* CU17 - Gestionar Proveedores */}
            <Route path="/proveedores" element={<ProtectedRoute roles={["administrador", "gerente"]}><ProveedorList /></ProtectedRoute>} />
            
            {/* CU18 - Asociar Insumos a Proveedores */}
            <Route path="/proveedores/asociar" element={<ProtectedRoute roles={["administrador"]}><AsociarInsumos /></ProtectedRoute>} />

            {/* CU19 - Localizar Proveedores mediante Mapa */}
            <Route path="/proveedores/mapa" element={<ProtectedRoute roles={["administrador", "gerente"]}><MapaProveedores /></ProtectedRoute>} />

            {/* CU31 - Pasarela de Pagos (Stripe) */}
            <Route path="/pagos/depositar" element={<ProtectedRoute roles={["administrador"]}><PagoDeposito /></ProtectedRoute>} />
            <Route path="/pagos/historial" element={<ProtectedRoute roles={["administrador", "gerente"]}><HistorialPagos /></ProtectedRoute>} />


          {/* PAQUETE 6: Reportes y Análisis */}
            {/* CU27 - Generar Reporte de Costos por Plato */}
            <Route path="/reportes/costos" element={<ProtectedRoute roles={["administrador", "gerente", "chef"]}><ReporteCostos /></ProtectedRoute>} />

            {/* CU25 - Generar Reporte de Valor Perdido */}
            <Route path="/reportes/valor-perdido" element={<ProtectedRoute roles={["administrador", "gerente"]}><ReporteValorPerdido /></ProtectedRoute>} />
            
            {/* CU26 - Generar Reporte de Rotacion de Inventario */}
            <Route path="/reportes/rotacion" element={<ProtectedRoute roles={["administrador", "gerente"]}><ReporteRotacion /></ProtectedRoute>} />

            {/* CU29 - Visualizar Dashboard de KPIs */}
            <Route path="/dashboard" element={<ProtectedRoute roles={["administrador", "gerente"]}><DashboardKPIs /></ProtectedRoute>} />


          {/* PAQUETE 7: Ciclo 5 — Caducidad y Compras */}
            {/* CU34 - Gestión de Caducidad FEFO */}
            <Route path="/caducidad" element={<ProtectedRoute roles={["administrador", "chef"]}><CaducidadList /></ProtectedRoute>} />

            {/* CU36 - Órdenes de Compra Automáticas (bajo Proveedores) */}
            <Route path="/ordenes-compra" element={<ProtectedRoute roles={["administrador", "gerente"]}><OrdenCompraList /></ProtectedRoute>} />

            {/* CU39/CU40/CU41 - Facturas con IA (OCR, conciliación, anomalías) */}
            <Route path="/facturas" element={<ProtectedRoute roles={["administrador", "gerente"]}><FacturaList /></ProtectedRoute>} />
            <Route path="/facturas/escanear" element={<ProtectedRoute roles={["administrador", "gerente"]}><FacturaOCR /></ProtectedRoute>} />

            {/* CU42 - Recepción de Lote Asistida por IA */}
            <Route path="/recepcion" element={<ProtectedRoute roles={["administrador", "chef"]}><RecepcionMercancia /></ProtectedRoute>} />

            {/* CU43 - Auditoría Inteligente de Bitácora */}
            <Route path="/auditoria-ia" element={<ProtectedRoute roles={["administrador", "gerente"]}><AuditoriaIA /></ProtectedRoute>} />

            {/* CU44 - Pronóstico de Demanda */}
            <Route path="/reportes/pronostico" element={<ProtectedRoute roles={["administrador", "gerente"]}><PronosticoDemanda /></ProtectedRoute>} />


          {/* Placeholders — módulos pendientes de implementación */}
            <Route path="/merma-tecnica" element={<ProtectedRoute><Placeholder /></ProtectedRoute>} />
            <Route path="/reportes/comparativa-precios" element={<ProtectedRoute roles={["administrador", "gerente"]}><ReporteComparativa /></ProtectedRoute>} />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;