/**
 * ============================================================
 * ARCHIVO: frontend/src/components/AppHeader.tsx
 * MODIFICADO: 01/06/26 - CU13 Gestionar Alertas (Ciclo 3)
 *
 * CAMBIOS:
 * - Agregado badge de campana con conteo de alertas no leídas
 * - El conteo se refresca cada 60 segundos automáticamente
 * - Al hacer clic navega a /alertas
 * ============================================================
 */

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import Logo from "./Logo";
import Sidebar from "./Sidebar";
import { LogOut, User as UserIcon, Bell } from "lucide-react";
import { getAlertasConteo } from "@/services/alertaService";

/**
 * AppHeader - Barra de Navegación Principal.
 *
 * CU13: muestra un ícono de campana con badge numérico indicando
 * la cantidad de alertas no leídas. Se actualiza cada 60 segundos.
 *
 * Fecha original: 09/05/26
 * Última modificación: 01/06/26
 */
export default function AppHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // ── Estado del badge de alertas ─────────────────────────
  const [conteoAlertas, setConteoAlertas] = useState(0);

  // Cargar conteo al montar y cada 60 segundos
  useEffect(() => {
    if (!user) return;

    async function cargarConteo() {
      try {
        const conteo = await getAlertasConteo();
        setConteoAlertas(conteo);
      } catch {
        // silencioso — no interrumpir la UI si falla el conteo
      }
    }

    cargarConteo();
    const intervalo = setInterval(cargarConteo, 60_000);
    return () => clearInterval(intervalo);
  }, [user]);

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

          {/* ── Campana de alertas (CU13) ── */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/alertas")}
            title={
              conteoAlertas > 0
                ? `${conteoAlertas} alerta${conteoAlertas > 1 ? "s" : ""} pendiente${conteoAlertas > 1 ? "s" : ""}`
                : "Sin alertas pendientes"
            }
            className="relative"
          >
            <Bell className="h-5 w-5" />
            {conteoAlertas > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
                {conteoAlertas > 99 ? "99+" : conteoAlertas}
              </span>
            )}
          </Button>

          {/* ── Perfil ── */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/perfil")}
            title="Perfil"
          >
            <UserIcon className="h-5 w-5" />
          </Button>

          {/* ── Salir ── */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => { logout(); navigate("/login"); }}
          >
            <LogOut className="mr-1 h-4 w-4" /> Salir
          </Button>
        </nav>
      </div>
    </header>
  );
}