/**
 * ============================================================
 * ARCHIVO: frontend/src/components/AppHeader.tsx
 * MODIFICADO: 10/05/26 - Reestructuración para Sidebar (Ciclo 2)
 * 
 * CAMBIOS:
 * - Eliminados botones de navegación antiguos (Insumos, Usuarios)
 * - Agregado componente Sidebar con ícono hamburguesa
 * - Mantenidos solo: Logo, Sidebar, Perfil, Salir
 * ============================================================
 */

import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import Logo from "./Logo";
import Sidebar from "./Sidebar";
import { LogOut, User as UserIcon, Users} from "lucide-react"; //Agregamos package para el cu7...


/**
 * AppHeader - Barra de Navegación Principal.
 * 
 * Este componente muestra la barra de navegación superior que aparece
 * en todas las páginas cuando el usuario está autenticado.
 * 
 * Estado:
 * - Si NO hay usuario autenticado, el header NO se renderiza (return null).
 * 
 * Fecha: 09/05/26
 */

export default function AppHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <header className="bg-card border-b border-border shadow-card sticky top-0 z-40">
      <div className="container flex items-center justify-between py-3 px-0 sm:px-4">
        <div className="flex items-center gap-3">
          <Sidebar />
          <Link to="/perfil">
            <Logo size="sm" />
          </Link>
        </div>
        <nav className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/perfil")} title="Perfil">
            <UserIcon className="h-5 w-5" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => { logout(); navigate("/login"); }}>
            <LogOut className="mr-1 h-4 w-4" /> Salir
          </Button>
        </nav>
      </div>
    </header>
  );
}