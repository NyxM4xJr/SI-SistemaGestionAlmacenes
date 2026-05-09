import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import Logo from "./Logo";
import { LogOut, User as UserIcon, Users, Package } from "lucide-react"; //Agregamos package para el cu7...


/**
 * AppHeader - Barra de Navegación Principal.
 * 
 * Este componente muestra la barra de navegación superior que aparece
 * en todas las páginas cuando el usuario está autenticado.
 * 
 * Características:
 * - Logo de la aplicación (enlace a /perfil).
 * - Botón "Perfil" (siempre visible).
 * - Botón "Insumos" (visible para Admin y Chef).
 * - Botón "Usuarios" (SOLO visible para administradores).
 * - Botón "Salir" para cerrar sesión.
 * - Resalta el botón de la página actual.
 * - Diseño responsivo con Tailwind CSS.
 * 
 * Estado:
 * - Si NO hay usuario autenticado, el header NO se renderiza (return null).
 * 
 * Fecha: 09/05/26
 */

export default function AppHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (!user) return null;

  const isChef = user.rol === "chef";

  return (
    <header className="bg-card border-b border-border shadow-card sticky top-0 z-40">
      <div className="container flex items-center justify-between py-4">
        <Link to="/perfil"><Logo size={isChef ? "md" : "sm"} /></Link>
        <nav className="flex items-center gap-2">
          <Button
            variant={pathname === "/perfil" ? "default" : "ghost"}
            size={isChef ? "lg" : "default"}
            className={isChef ? "chef-touch px-6" : ""}
            onClick={() => navigate("/perfil")}
          >
            <UserIcon className="mr-2 h-5 w-5" /> Perfil
          </Button>
          {/* NUEVO: Botón Insumos - CU07 Ciclo 2 */}
          <Button
            variant={pathname.startsWith("/insumos") ? "default" : "ghost"}
            size={isChef ? "lg" : "default"}
            className={isChef ? "chef-touch px-6" : ""}
            onClick={() => navigate("/insumos")}
          >
            <Package className="mr-2 h-5 w-5" /> Insumos
          </Button>
          {user.rol === "administrador" && (
            <Button
              variant={pathname === "/admin" ? "default" : "ghost"}
              onClick={() => navigate("/admin")}
            >
              <Users className="mr-2 h-5 w-5" /> Usuarios
            </Button>
          )}
          <Button
            variant="outline"
            size={isChef ? "lg" : "default"}
            className={isChef ? "chef-touch px-6" : ""}
            onClick={() => { logout(); navigate("/login"); }}
          >
            <LogOut className="mr-2 h-5 w-5" /> Salir
          </Button>
        </nav>
      </div>
    </header>
  );
}
