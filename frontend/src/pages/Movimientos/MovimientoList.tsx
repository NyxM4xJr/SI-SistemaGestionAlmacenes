/**
 * ============================================================
 * ARCHIVO: frontend/src/pages/Movimientos/MovimientoList.tsx
 * CASO DE USO: CU14 - Registrar Movimiento de Inventario
 * CICLO: 3
 * AUTOR: Mateo Hurtado
 * FECHA: 01/06/26
 *
 * DESCRIPCIÓN: Página principal de movimientos de inventario.
 * Muestra estadísticas del mes, filtros por tipo y fecha,
 * búsqueda por insumo y tabla responsiva con badges de color.
 * Sigue el patrón exacto de PlatoList.tsx.
 * ============================================================
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Plus,
  Search,
  ArrowDownCircle,
  ArrowUpCircle,
  AlertTriangle,
  RefreshCw,
  PackageOpen,
  TrendingDown,
  DollarSign,
  Filter,
  X,
  Eye,
} from "lucide-react";

import { Button }   from "@/components/ui/button";
import { Input }    from "@/components/ui/input";
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AppHeader from "@/components/AppHeader";

import {
  type Movimiento,
  type TipoMovimiento,
  getMovimientos,
} from "@/services/movimientoService";

// ── Helpers de badge por tipo ────────────────────────────────

const TIPO_CONFIG: Record<
  TipoMovimiento,
  { label: string; color: string; icon: React.ReactNode; barra: string }
> = {
  ingreso: {
    label: "Ingreso",
    color: "text-green-700 bg-green-50 border-green-200",
    barra: "bg-green-400",
    icon: <ArrowDownCircle className="h-3.5 w-3.5" />,
  },
  salida: {
    label: "Salida",
    color: "text-blue-700 bg-blue-50 border-blue-200",
    barra: "bg-blue-400",
    icon: <ArrowUpCircle className="h-3.5 w-3.5" />,
  },
  merma: {
    label: "Merma",
    color: "text-red-700 bg-red-50 border-red-200",
    barra: "bg-red-400",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  sobrerecuperada: {
    label: "Sobrerecuperada",
    color: "text-yellow-700 bg-yellow-50 border-yellow-200",
    barra: "bg-yellow-400",
    icon: <RefreshCw className="h-3.5 w-3.5" />,
  },
};

function TipoBadge({ tipo }: { tipo: TipoMovimiento }) {
  const cfg = TIPO_CONFIG[tipo] ?? TIPO_CONFIG.ingreso;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${cfg.color}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ── Helpers de estadísticas ──────────────────────────────────

function statsDelMes(movimientos: Movimiento[]) {
  const ahora = new Date();
  const año   = ahora.getFullYear();
  const mes   = ahora.getMonth() + 1; // 1-12

  const delMes = movimientos.filter((m) => {
    // fecha_mov viene como "YYYY-MM-DD" — parsear sin convertir a UTC
    const fecha  = (m.fecha_mov ?? m.created_at ?? "").slice(0, 10);
    const partes = fecha.split("-");
    if (partes.length < 3) return false;
    const fAño = parseInt(partes[0], 10);
    const fMes = parseInt(partes[1], 10); // ya es 1-12
    return fAño === año && fMes === mes;
  });

  return {
    ingresos:     delMes.filter((m) => m.tipo === "ingreso").length,
    salidas:      delMes.filter((m) => m.tipo === "salida").length,
    valorPerdido: delMes
      .filter((m) => m.tipo === "merma")
      .reduce((acc, m) => acc + Number(m.valor_perdido || 0), 0),
  };
}

// ── Componente principal ─────────────────────────────────────

export default function MovimientoList() {
  const navigate = useNavigate();

  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [filtrados, setFiltrados]     = useState<Movimiento[]>([]);
  const [busqueda, setBusqueda]       = useState("");
  const [filtroTipo, setFiltroTipo]   = useState<TipoMovimiento | "">("");
  const [fechaDesde, setFechaDesde]   = useState("");
  const [fechaHasta, setFechaHasta]   = useState("");
  const [cargando, setCargando]       = useState(true);

  // ── Carga inicial ────────────────────────────────────────
  useEffect(() => {
    cargarMovimientos();
  }, []);

  async function cargarMovimientos() {
    try {
      setCargando(true);
      const data = await getMovimientos({
        tipo:        filtroTipo || undefined,
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
      });
      setMovimientos(data);
      setFiltrados(data);
    } catch {
      toast.error("Error al cargar los movimientos.");
    } finally {
      setCargando(false);
    }
  }

  // ── Filtro por búsqueda (nombre insumo) en cliente ───────
  useEffect(() => {
    const termino = busqueda.toLowerCase();
    setFiltrados(
      movimientos.filter((m) =>
        m.insumo?.nombre?.toLowerCase().includes(termino) ||
        m.tipo.toLowerCase().includes(termino)
      )
    );
  }, [busqueda, movimientos]);

  // ── Aplicar filtros de fecha/tipo hacia la API ────────────
  async function aplicarFiltros() {
    try {
      setCargando(true);
      const data = await getMovimientos({
        tipo:        filtroTipo || undefined,
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
      });
      setMovimientos(data);
      setFiltrados(data);
    } catch {
      toast.error("Error al aplicar los filtros.");
    } finally {
      setCargando(false);
    }
  }

  function limpiarFiltros() {
    setFiltroTipo("");
    setFechaDesde("");
    setFechaHasta("");
    setBusqueda("");
    cargarMovimientos();
  }

  const hayFiltros = filtroTipo || fechaDesde || fechaHasta;
  const stats      = statsDelMes(movimientos);

  // ── Spinner ───────────────────────────────────────────────
  const spinner = (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3 text-gray-400">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-500" />
        <p className="text-sm">Cargando movimientos...</p>
      </div>
    </div>
  );

  // ── Estado vacío ──────────────────────────────────────────
  const estadoVacio = (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
      <PackageOpen className="h-12 w-12 mb-3 text-gray-300" />
      <p className="text-base font-medium text-gray-500">
        {busqueda || hayFiltros
          ? "No se encontraron movimientos con esos criterios."
          : "No hay movimientos registrados."}
      </p>
      {!busqueda && !hayFiltros && (
        <Button
          variant="ghost"
          className="mt-3 text-indigo-500 hover:text-indigo-600"
          onClick={() => navigate("/movimientos/nuevo")}
        >
          Registrar el primer movimiento
        </Button>
      )}
    </div>
  );

  // ── Campo detalle extra según tipo ───────────────────────
  function detalleExtra(m: Movimiento): string {
    if (m.tipo === "ingreso")        return m.origen      ? `Origen: ${m.origen}` : "—";
    if (m.tipo === "salida")         return m.destino     ? `Destino: ${m.destino}` : "—";
    if (m.tipo === "merma")          return m.causa       ? `Causa: ${m.causa}` : "—";
    if (m.tipo === "sobrerecuperada") return m.procedencia ? `Procedencia: ${m.procedencia}` : "—";
    return "—";
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Encabezado ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <PackageOpen className="h-8 w-8 text-indigo-500" />
              Movimientos de Inventario
            </h1>
            <p className="text-gray-500 mt-1 text-sm">
              Registro de ingresos, salidas, mermas y sobrerecuperaciones
            </p>
          </div>
          <Button
            onClick={() => navigate("/movimientos/nuevo")}
            className="bg-indigo-500 hover:bg-indigo-600 text-white gap-2 rounded-xl px-5"
          >
            <Plus className="h-4 w-4" />
            Nuevo Movimiento
          </Button>
        </div>

        {/* ── Estadísticas del mes ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card className="rounded-2xl shadow-sm border-0 bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Ingresos del Mes
              </CardTitle>
              <ArrowDownCircle className="h-5 w-5 text-green-400" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">{stats.ingresos}</p>
              <p className="text-xs text-gray-400 mt-1">movimientos de ingreso</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm border-0 bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Salidas del Mes
              </CardTitle>
              <TrendingDown className="h-5 w-5 text-blue-400" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">{stats.salidas}</p>
              <p className="text-xs text-gray-400 mt-1">movimientos de salida</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm border-0 bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Valor Perdido (Mermas)
              </CardTitle>
              <DollarSign className="h-5 w-5 text-red-400" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">
                Bs. {stats.valorPerdido.toFixed(2)}
              </p>
              <p className="text-xs text-gray-400 mt-1">pérdida acumulada del mes</p>
            </CardContent>
          </Card>
        </div>

        {/* ── Filtros ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
          <div className="flex flex-wrap gap-3 items-end">

            {/* Búsqueda */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por insumo o tipo..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-10 rounded-xl border-gray-200 h-11"
              />
            </div>

            {/* Tipo */}
            <div className="min-w-[160px]">
              <label className="text-xs font-medium text-gray-500 mb-1 block">
                Tipo
              </label>
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value as TipoMovimiento | "")}
                className="w-full h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                <option value="">Todos los tipos</option>
                <option value="ingreso">Ingreso</option>
                <option value="salida">Salida</option>
                <option value="merma">Merma</option>
                <option value="sobrerecuperada">Sobrerecuperada</option>
              </select>
            </div>

            {/* Fecha desde */}
            <div className="min-w-[150px]">
              <label className="text-xs font-medium text-gray-500 mb-1 block">
                Desde
              </label>
              <Input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="rounded-xl border-gray-200 h-11 text-sm"
              />
            </div>

            {/* Fecha hasta */}
            <div className="min-w-[150px]">
              <label className="text-xs font-medium text-gray-500 mb-1 block">
                Hasta
              </label>
              <Input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="rounded-xl border-gray-200 h-11 text-sm"
              />
            </div>

            {/* Botones */}
            <div className="flex gap-2">
              <Button
                onClick={aplicarFiltros}
                className="bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl h-11 px-4 gap-2"
              >
                <Filter className="h-4 w-4" />
                Filtrar
              </Button>
              {hayFiltros && (
                <Button
                  variant="ghost"
                  onClick={limpiarFiltros}
                  className="rounded-xl h-11 px-3 text-gray-500 hover:text-gray-700 gap-1"
                >
                  <X className="h-4 w-4" />
                  Limpiar
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ── Tabla ── */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
          {cargando ? (
            spinner
          ) : filtrados.length === 0 ? (
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
                    <TableHead className="font-semibold text-gray-600 text-center">
                      Cantidad
                    </TableHead>
                    <TableHead className="font-semibold text-gray-600 hidden md:table-cell">
                      Detalle
                    </TableHead>
                    <TableHead className="font-semibold text-gray-600 hidden lg:table-cell text-right">
                      Valor (Bs.)
                    </TableHead>
                    <TableHead className="font-semibold text-gray-600 text-right">
                      Acciones
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((m, index) => (
                    <TableRow
                      key={m.id}
                      className="hover:bg-indigo-50/30 transition-colors"
                    >
                      <TableCell className="text-gray-400 text-sm">{index + 1}</TableCell>

                      <TableCell className="text-gray-600 text-sm whitespace-nowrap">
                        {new Date(m.fecha_mov).toLocaleDateString("es-BO", {
                          day: "2-digit", month: "short", year: "numeric",
                        })}
                      </TableCell>

                      <TableCell>
                        <TipoBadge tipo={m.tipo} />
                      </TableCell>

                      <TableCell className="font-medium text-gray-900">
                        {m.insumo?.nombre ?? `Insumo #${m.insumo_id}`}
                      </TableCell>

                      <TableCell className="text-center font-semibold text-gray-800">
                        {m.cantidad}
                      </TableCell>

                      <TableCell className="text-gray-500 text-sm hidden md:table-cell max-w-xs truncate">
                        {detalleExtra(m)}
                      </TableCell>

                      <TableCell className="text-right hidden lg:table-cell">
                        {m.tipo === "merma" && m.valor_perdido ? (
                          <span className="text-red-600 font-semibold">
                            -{Number(m.valor_perdido).toFixed(2)}
                          </span>
                        ) : m.tipo === "ingreso" && m.costo_unitario ? (
                          <span className="text-green-600 font-semibold">
                            +{(Number(m.costo_unitario) * m.cantidad).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50"
                          onClick={() => navigate(`/movimientos/${m.id}`)}
                          title="Ver detalle"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Contador */}
        {!cargando && filtrados.length > 0 && (
          <p className="text-xs text-gray-400 mt-3 text-right">
            Mostrando {filtrados.length} de {movimientos.length} movimientos
          </p>
        )}
      </main>
    </div>
  );
}