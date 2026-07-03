/**
 * ============================================================
 * ARCHIVO: frontend/src/pages/Alertas/AlertaList.tsx
 * CASO DE USO: CU13 - Gestionar Alertas
 * CICLO: 3
 * AUTOR: Mateo Hurtado
 * FECHA: 01/06/26
 *
 * DESCRIPCIÓN: Página de alertas generadas automáticamente.
 * Muestra estadísticas, filtros por tipo y estado, tabla
 * con badge y acción de marcar como leída.
 * Sigue el patrón exacto de PlatoList.tsx.
 * ============================================================
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Bell,
  BellOff,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Filter,
  X,
  BellRing,
  Mail,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AppHeader from "@/components/AppHeader";
import { useAuth } from "@/context/AuthContext";

import {
  type Alerta,
  getAlertas,
  marcarAlertaLeida,
  revisarYNotificar,
} from "@/services/alertaService";

// ── Helpers ──────────────────────────────────────────────────

/** Detecta el tipo de alerta según el mensaje */
function getTipoAlerta(mensaje: string): "stock_bajo" | "proximo_vencer" {
  const m = mensaje.toLowerCase();
  if (m.includes("venc") || m.includes("caducar") || m.includes("expirar")) {
    return "proximo_vencer";
  }
  return "stock_bajo";
}

function TipoIcon({ mensaje }: { mensaje: string }) {
  const tipo = getTipoAlerta(mensaje);
  if (tipo === "proximo_vencer") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border text-orange-700 bg-orange-50 border-orange-200">
        <Clock className="h-3.5 w-3.5" />
        Próximo a vencer
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border text-red-700 bg-red-50 border-red-200">
      <AlertTriangle className="h-3.5 w-3.5" />
      Stock bajo
    </span>
  );
}

function EstadoBadge({ leida }: { leida: boolean }) {
  if (leida) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border text-gray-500 bg-gray-50 border-gray-200">
        <CheckCircle2 className="h-3 w-3" />
        Leída
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border text-indigo-700 bg-indigo-50 border-indigo-200">
      <BellRing className="h-3 w-3" />
      Pendiente
    </span>
  );
}

// ── Componente principal ─────────────────────────────────────

export default function AlertaList() {
  const { user } = useAuth();
  const puedeNotificar = user?.rol === "administrador" || user?.rol === "gerente";

  const [alertas, setAlertas]       = useState<Alerta[]>([]);
  const [filtradas, setFiltradas]   = useState<Alerta[]>([]);
  const [cargando, setCargando]     = useState(true);
  const [marcandoId, setMarcandoId] = useState<number | null>(null);
  const [notificando, setNotificando] = useState(false);

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState<"todas" | "pendiente" | "leida">("todas");
  const [filtroTipo, setFiltroTipo]     = useState<"todas" | "stock_bajo" | "proximo_vencer">("todas");

  // ── Carga inicial ────────────────────────────────────────
  useEffect(() => {
    cargarAlertas();
  }, []);

  async function cargarAlertas() {
    try {
      setCargando(true);
      const data = await getAlertas();
      setAlertas(data);
      setFiltradas(data);
    } catch {
      toast.error("Error al cargar las alertas.");
    } finally {
      setCargando(false);
    }
  }

  // ── Filtros en cliente ───────────────────────────────────
  useEffect(() => {
    let resultado = [...alertas];

    if (filtroEstado === "pendiente") resultado = resultado.filter((a) => !a.leida);
    if (filtroEstado === "leida")     resultado = resultado.filter((a) => a.leida);

    if (filtroTipo !== "todas") {
      resultado = resultado.filter(
        (a) => getTipoAlerta(a.mensaje) === filtroTipo
      );
    }

    setFiltradas(resultado);
  }, [filtroEstado, filtroTipo, alertas]);

  function limpiarFiltros() {
    setFiltroEstado("todas");
    setFiltroTipo("todas");
  }

  // ── Marcar como leída ────────────────────────────────────
  async function handleMarcar(alerta: Alerta) {
    try {
      setMarcandoId(alerta.id);
      await marcarAlertaLeida(alerta.id);

      // Actualizar localmente sin recargar toda la lista
      setAlertas((prev) =>
        prev.map((a) => (a.id === alerta.id ? { ...a, leida: true } : a))
      );

      toast.success("Alerta marcada como leída.");
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : "Error al marcar la alerta.";
      toast.error(mensaje);
    } finally {
      setMarcandoId(null);
    }
  }

  // ── Revisar y notificar por email (CU33) ─────────────────
  async function handleNotificar() {
    try {
      setNotificando(true);
      const res = await revisarYNotificar();
      if (res.enviado) {
        toast.success(
          `Correo enviado a ${res.destinatarios} destinatario(s): ` +
          `${res.alertas} alerta(s), ${res.lotes_por_vencer} lote(s) por vencer.`
        );
      } else {
        toast.info(res.motivo || "No había nada que notificar.");
      }
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : "Error al enviar la notificación.";
      toast.error(mensaje);
    } finally {
      setNotificando(false);
    }
  }

  // ── Estadísticas ─────────────────────────────────────────
  const totalPendientes   = alertas.filter((a) => !a.leida).length;
  const totalStockBajo    = alertas.filter((a) => getTipoAlerta(a.mensaje) === "stock_bajo").length;
  const totalProxVencer   = alertas.filter((a) => getTipoAlerta(a.mensaje) === "proximo_vencer").length;

  const hayFiltros = filtroEstado !== "todas" || filtroTipo !== "todas";

  // ── Spinner ───────────────────────────────────────────────
  const spinner = (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3 text-gray-400">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-500" />
        <p className="text-sm">Cargando alertas...</p>
      </div>
    </div>
  );

  // ── Estado vacío ──────────────────────────────────────────
  const estadoVacio = (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
      <BellOff className="h-12 w-12 mb-3 text-gray-300" />
      <p className="text-base font-medium text-gray-500">
        {hayFiltros
          ? "No hay alertas con esos criterios."
          : "No hay alertas registradas."}
      </p>
      {hayFiltros && (
        <Button
          variant="ghost"
          className="mt-3 text-indigo-500 hover:text-indigo-600"
          onClick={limpiarFiltros}
        >
          Limpiar filtros
        </Button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Encabezado ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Bell className="h-8 w-8 text-indigo-500" />
              Gestionar Alertas
            </h1>
            <p className="text-gray-500 mt-1 text-sm">
              Notificaciones generadas automáticamente por el sistema
            </p>
          </div>
          <div className="flex items-center gap-3">
            {totalPendientes > 0 && (
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
                <BellRing className="h-4 w-4" />
                {totalPendientes} pendiente{totalPendientes > 1 ? "s" : ""}
              </span>
            )}
            {puedeNotificar && (
              <Button
                onClick={handleNotificar}
                disabled={notificando}
                className="rounded-xl h-11 px-4 gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {notificando ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
                Revisar y notificar por email
              </Button>
            )}
          </div>
        </div>

        {/* ── Estadísticas ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card className="rounded-2xl shadow-sm border-0 bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Alertas Pendientes
              </CardTitle>
              <BellRing className="h-5 w-5 text-red-400" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">{totalPendientes}</p>
              <p className="text-xs text-gray-400 mt-1">sin revisar</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm border-0 bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Stock Bajo
              </CardTitle>
              <AlertTriangle className="h-5 w-5 text-orange-400" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">{totalStockBajo}</p>
              <p className="text-xs text-gray-400 mt-1">alertas de stock mínimo</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm border-0 bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Próximos a Vencer
              </CardTitle>
              <Clock className="h-5 w-5 text-yellow-400" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">{totalProxVencer}</p>
              <p className="text-xs text-gray-400 mt-1">alertas de caducidad</p>
            </CardContent>
          </Card>
        </div>

        {/* ── Filtros ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
          <div className="flex flex-wrap gap-3 items-end">

            {/* Estado */}
            <div className="min-w-[160px]">
              <label className="text-xs font-medium text-gray-500 mb-1 block">
                Estado
              </label>
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value as typeof filtroEstado)}
                className="w-full h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                <option value="todas">Todas</option>
                <option value="pendiente">Pendientes</option>
                <option value="leida">Leídas</option>
              </select>
            </div>

            {/* Tipo */}
            <div className="min-w-[200px]">
              <label className="text-xs font-medium text-gray-500 mb-1 block">
                Tipo de alerta
              </label>
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value as typeof filtroTipo)}
                className="w-full h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                <option value="todas">Todos los tipos</option>
                <option value="stock_bajo">⚠️ Stock bajo</option>
                <option value="proximo_vencer">⏰ Próximo a vencer</option>
              </select>
            </div>

            {/* Limpiar */}
            {hayFiltros && (
              <Button
                variant="ghost"
                onClick={limpiarFiltros}
                className="rounded-xl h-11 px-3 text-gray-500 hover:text-gray-700 gap-1 self-end"
              >
                <X className="h-4 w-4" />
                Limpiar
              </Button>
            )}

            {/* Contador de resultados */}
            {!cargando && (
              <span className="self-end text-xs text-gray-400 ml-auto pb-2">
                {filtradas.length} de {alertas.length} alertas
              </span>
            )}
          </div>
        </div>

        {/* ── Tabla ── */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
          {cargando ? (
            spinner
          ) : filtradas.length === 0 ? (
            estadoVacio
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:bg-gray-50">
                    <TableHead className="font-semibold text-gray-600 w-[50px]">#</TableHead>
                    <TableHead className="font-semibold text-gray-600">Fecha</TableHead>
                    <TableHead className="font-semibold text-gray-600">Tipo</TableHead>
                    <TableHead className="font-semibold text-gray-600">Insumo</TableHead>
                    <TableHead className="font-semibold text-gray-600 hidden md:table-cell">
                      Mensaje
                    </TableHead>
                    <TableHead className="font-semibold text-gray-600">Estado</TableHead>
                    <TableHead className="font-semibold text-gray-600 text-right">
                      Acción
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.map((alerta, index) => (
                    <TableRow
                      key={alerta.id}
                      className={`transition-colors ${
                        alerta.leida
                          ? "opacity-60 hover:bg-gray-50/50"
                          : "hover:bg-indigo-50/30"
                      }`}
                    >
                      <TableCell className="text-gray-400 text-sm">
                        {index + 1}
                      </TableCell>

                      <TableCell className="text-gray-600 text-sm whitespace-nowrap">
                        {new Date(alerta.fecha).toLocaleDateString("es-BO", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>

                      <TableCell>
                        <TipoIcon mensaje={alerta.mensaje} />
                      </TableCell>

                      <TableCell className="font-medium text-gray-900">
                        {alerta.stock?.insumo?.nombre ?? `Stock #${alerta.stock_id}`}
                      </TableCell>

                      <TableCell className="text-gray-500 text-sm hidden md:table-cell max-w-xs">
                        <p className="line-clamp-2">{alerta.mensaje}</p>
                      </TableCell>

                      <TableCell>
                        <EstadoBadge leida={alerta.leida} />
                      </TableCell>

                      <TableCell className="text-right">
                        {!alerta.leida ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-3 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 text-xs gap-1.5 rounded-lg"
                            onClick={() => handleMarcar(alerta)}
                            disabled={marcandoId === alerta.id}
                          >
                            {marcandoId === alerta.id ? (
                              <div className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-600" />
                            ) : (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            )}
                            Marcar leída
                          </Button>
                        ) : (
                          <span className="text-xs text-gray-300 pr-2">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}