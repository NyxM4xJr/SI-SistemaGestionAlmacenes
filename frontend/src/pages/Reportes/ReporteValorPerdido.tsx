/**
 * ============================================================
 * ARCHIVO: frontend/src/pages/Reportes/ReporteValorPerdido.tsx
 * CASO DE USO: CU25 - Generar Reporte de Valor Perdido
 * CICLO: 4
 * AUTOR: Mateo Hurtado
 * FECHA: 21/06/26
 *
 * DESCRIPCIÓN: Página de reporte de valor perdido. Muestra las
 * pérdidas de inventario (movimientos tipo merma de CU14) agrupadas
 * por causa, por período y por insumo (top 5), con filtros de rango
 * de fechas, insumo y agrupación temporal. Permite descargar el
 * reporte en PDF o Excel. Sigue el patrón de ReporteCostos.tsx (CU27).
 *
 * Sin gráfico en esta versión (decisión de diseño — solo tablas,
 * igual que CU27) y sin botón "Volver" (se accede desde el menú
 * lateral, igual que CU27 se accede desde su nodo del sidebar).
 * ============================================================
 */

import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import {
  TrendingDown,
  Loader2,
  FileDown,
  FileSpreadsheet,
  AlertTriangle,
  DollarSign,
  Calendar,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import AppHeader from "@/components/AppHeader";

import { insumoService, type Insumo } from "@/services/insumoServices";
import {
  getReporteValorPerdido,
  descargarReporteValorPerdidoPDF,
  descargarReporteValorPerdidoExcel,
  type AgruparPor,
  type ReporteValorPerdidoResponse,
} from "@/services/reporteValorPerdidoService";

const REPORTE_VACIO: ReporteValorPerdidoResponse = {
  movimientos: [],
  por_causa: [],
  por_periodo: [],
  por_insumo: [],
  valor_perdido_total: 0,
  total_eventos: 0,
};

export default function ReporteValorPerdido() {
  // ── CU32: si se llegó vía comando de voz con intención de
  // descarga, se resalta el botón correspondiente (no se descarga
  // automáticamente, solo se sugiere visualmente). ───────────────
  const location = useLocation();
  const formatoSugerido = (location.state as { formatoSugerido?: "pdf" | "excel" | null } | null)
    ?.formatoSugerido;

  // ── Estado de filtros ───────────────────────────────────────
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [insumoIdFiltro, setInsumoIdFiltro] = useState<string>("todos");
  const [fechaDesde, setFechaDesde] = useState<string>("");
  const [fechaHasta, setFechaHasta] = useState<string>("");
  const [agruparPor, setAgruparPor] = useState<AgruparPor>("mes");

  // ── Estado del reporte ──────────────────────────────────────
  const [reporte, setReporte] = useState<ReporteValorPerdidoResponse>(REPORTE_VACIO);

  // ── Estado de UI ────────────────────────────────────────────
  const [cargando, setCargando] = useState(true);
  const [descargandoPDF, setDescargandoPDF] = useState(false);
  const [descargandoExcel, setDescargandoExcel] = useState(false);
  const [errorFiltro, setErrorFiltro] = useState<string>("");

  // ── Cargar catálogo de insumos y reporte inicial ────────────
  useEffect(() => {
    async function cargarInicial() {
      try {
        setCargando(true);
        const listaInsumos = await insumoService.getAll();
        setInsumos(listaInsumos);
        await cargarReporte();
      } catch {
        toast.error("No se pudo cargar el reporte de valor perdido.");
      } finally {
        setCargando(false);
      }
    }

    cargarInicial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function filtrosActuales() {
    return {
      fecha_desde: fechaDesde || undefined,
      fecha_hasta: fechaHasta || undefined,
      insumo_id: insumoIdFiltro === "todos" ? undefined : Number(insumoIdFiltro),
      agrupar_por: agruparPor,
    };
  }

  async function cargarReporte() {
    const data = await getReporteValorPerdido(filtrosActuales());
    setReporte(data);
  }

  async function handleAplicarFiltros() {
    if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) {
      setErrorFiltro("La fecha 'desde' no puede ser posterior a la fecha 'hasta'.");
      return;
    }
    setErrorFiltro("");
    try {
      setCargando(true);
      await cargarReporte();
    } catch (err: unknown) {
      const mensaje =
        err instanceof Error ? err.message : "Error al filtrar el reporte.";
      toast.error(mensaje);
    } finally {
      setCargando(false);
    }
  }

  function limpiarFiltros() {
    setInsumoIdFiltro("todos");
    setFechaDesde("");
    setFechaHasta("");
    setAgruparPor("mes");
    setErrorFiltro("");
  }

  async function handleDescargarPDF() {
    if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) {
      setErrorFiltro("La fecha 'desde' no puede ser posterior a la fecha 'hasta'.");
      return;
    }
    try {
      setDescargandoPDF(true);
      await descargarReporteValorPerdidoPDF(filtrosActuales());
      toast.success("PDF descargado correctamente.");
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : "Error al descargar el PDF.";
      toast.error(mensaje);
    } finally {
      setDescargandoPDF(false);
    }
  }

  async function handleDescargarExcel() {
    if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) {
      setErrorFiltro("La fecha 'desde' no puede ser posterior a la fecha 'hasta'.");
      return;
    }
    try {
      setDescargandoExcel(true);
      await descargarReporteValorPerdidoExcel(filtrosActuales());
      toast.success("Excel descargado correctamente.");
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : "Error al descargar el Excel.";
      toast.error(mensaje);
    } finally {
      setDescargandoExcel(false);
    }
  }

  function formatoBs(valor: number): string {
    return `Bs. ${valor.toFixed(2)}`;
  }

  function badgeCausa(causa: string) {
    const estilos: Record<string, string> = {
      Vencimiento: "bg-orange-100 text-orange-700",
      "Mala manipulación": "bg-red-100 text-red-700",
      "Producto dañado": "bg-yellow-100 text-yellow-700",
      Otro: "bg-gray-100 text-gray-600",
    };
    return (
      <Badge className={`border-0 ${estilos[causa] || estilos["Otro"]}`}>
        {causa}
      </Badge>
    );
  }

  function etiquetaAgrupacion(): string {
    if (agruparPor === "dia") return "Día";
    if (agruparPor === "semana") return "Semana";
    return "Mes";
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Card de encabezado y filtros ── */}
        <Card className="rounded-3xl shadow-md border-0 bg-white mb-6">
          <CardHeader className="pb-2 px-8 pt-8">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-orange-50">
                <TrendingDown className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-gray-900">
                  Reporte de Valor Perdido
                </CardTitle>
                <p className="text-sm text-gray-400 mt-0.5">
                  Pérdidas de inventario por merma, agrupadas por causa,
                  período e insumo.
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="px-8 pb-8 pt-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Desde</Label>
                <Input
                  type="date"
                  className="rounded-xl h-11 border-gray-200"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Hasta</Label>
                <Input
                  type="date"
                  className="rounded-xl h-11 border-gray-200"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Insumo</Label>
                <Select value={insumoIdFiltro} onValueChange={setInsumoIdFiltro}>
                  <SelectTrigger className="rounded-xl h-11 border-gray-200">
                    <SelectValue placeholder="Selecciona un insumo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los insumos</SelectItem>
                    {insumos.map((i) => (
                      <SelectItem key={i.id} value={String(i.id)}>
                        {i.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Agrupar por</Label>
                <Select
                  value={agruparPor}
                  onValueChange={(v) => setAgruparPor(v as AgruparPor)}
                >
                  <SelectTrigger className="rounded-xl h-11 border-gray-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dia">Día</SelectItem>
                    <SelectItem value="semana">Semana</SelectItem>
                    <SelectItem value="mes">Mes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {errorFiltro && (
              <p className="text-sm text-red-600 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" />
                {errorFiltro}
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <Button
                className="rounded-xl h-11"
                onClick={handleAplicarFiltros}
                disabled={cargando}
              >
                {cargando ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Aplicar filtros
              </Button>
              <Button
                variant="ghost"
                className="rounded-xl h-11 text-gray-500"
                onClick={limpiarFiltros}
                disabled={cargando}
              >
                Limpiar
              </Button>

              <div className="flex-1" />

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className={`rounded-xl h-11 gap-2 ${
                    formatoSugerido === "pdf"
                      ? "border-orange-400 ring-2 ring-orange-200 text-orange-600"
                      : "border-gray-200"
                  }`}
                  onClick={handleDescargarPDF}
                  disabled={descargandoPDF || cargando}
                >
                  {descargandoPDF ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileDown className="h-4 w-4" />
                  )}
                  Descargar PDF
                </Button>
                <Button
                  variant="outline"
                  className={`rounded-xl h-11 gap-2 ${
                    formatoSugerido === "excel"
                      ? "border-orange-400 ring-2 ring-orange-200 text-orange-600"
                      : "border-gray-200"
                  }`}
                  onClick={handleDescargarExcel}
                  disabled={descargandoExcel || cargando}
                >
                  {descargandoExcel ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4" />
                  )}
                  Descargar Excel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Tarjetas resumen: total perdido y eventos ── */}
        {!cargando && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <Card className="rounded-3xl shadow-md border-0 bg-white">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-red-50">
                  <DollarSign className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Valor perdido total</p>
                  <p className="text-lg font-bold text-gray-900">
                    {formatoBs(reporte.valor_perdido_total)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl shadow-md border-0 bg-white">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-orange-50">
                  <AlertTriangle className="h-6 w-6 text-orange-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Eventos de merma</p>
                  <p className="text-lg font-bold text-gray-900">
                    {reporte.total_eventos}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Tabla: Por causa ── */}
        <Card className="rounded-3xl shadow-md border-0 bg-white mb-6">
          <CardHeader className="pb-2 px-8 pt-8">
            <CardTitle className="text-base font-bold text-gray-900">
              Pérdidas por Causa
            </CardTitle>
          </CardHeader>
          <CardContent className="px-8 pb-8 pt-4">
            {cargando ? (
              <LoaderTabla mensaje="Calculando pérdidas por causa..." />
            ) : reporte.por_causa.length === 0 ? (
              <EstadoVacio mensaje="No hay mermas registradas en el rango seleccionado." />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead>Causa</TableHead>
                      <TableHead className="text-right">Valor Perdido</TableHead>
                      <TableHead className="text-right">N° Eventos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reporte.por_causa.map((item) => (
                      <TableRow key={item.causa}>
                        <TableCell>{badgeCausa(item.causa)}</TableCell>
                        <TableCell className="text-right text-gray-600">
                          {formatoBs(item.valor_perdido)}
                        </TableCell>
                        <TableCell className="text-right text-gray-600">
                          {item.cantidad_eventos}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Tabla: Por período ── */}
        <Card className="rounded-3xl shadow-md border-0 bg-white mb-6">
          <CardHeader className="pb-2 px-8 pt-8">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <CardTitle className="text-base font-bold text-gray-900">
                Tendencia por {etiquetaAgrupacion()}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-8 pb-8 pt-4">
            {cargando ? (
              <LoaderTabla mensaje="Calculando tendencia..." />
            ) : reporte.por_periodo.length === 0 ? (
              <EstadoVacio mensaje="No hay datos suficientes para esta agrupación." />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead>{etiquetaAgrupacion()}</TableHead>
                      <TableHead className="text-right">Valor Perdido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reporte.por_periodo.map((item) => (
                      <TableRow key={item.periodo}>
                        <TableCell className="font-medium text-gray-700">
                          {item.periodo}
                        </TableCell>
                        <TableCell className="text-right text-gray-600">
                          {formatoBs(item.valor_perdido)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Tabla: Top 5 insumos ── */}
        <Card className="rounded-3xl shadow-md border-0 bg-white">
          <CardHeader className="pb-2 px-8 pt-8">
            <CardTitle className="text-base font-bold text-gray-900">
              Top 5 Insumos con Mayor Pérdida
            </CardTitle>
          </CardHeader>
          <CardContent className="px-8 pb-8 pt-4">
            {cargando ? (
              <LoaderTabla mensaje="Calculando ranking de insumos..." />
            ) : reporte.por_insumo.length === 0 ? (
              <EstadoVacio mensaje="No hay insumos con pérdidas en el rango seleccionado." />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead>Insumo</TableHead>
                      <TableHead className="text-right">Valor Perdido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reporte.por_insumo.map((item) => (
                      <TableRow key={item.insumo_id}>
                        <TableCell className="font-medium text-gray-700">
                          {item.insumo_nombre}
                        </TableCell>
                        <TableCell className="text-right text-gray-600">
                          {formatoBs(item.valor_perdido)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

// ── Subcomponentes de estado (loader / vacío) ─────────────────

function LoaderTabla({ mensaje }: { mensaje: string }) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="flex flex-col items-center gap-3 text-gray-400">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-200 border-t-orange-500" />
        <p className="text-sm">{mensaje}</p>
      </div>
    </div>
  );
}

function EstadoVacio({ mensaje }: { mensaje: string }) {
  return (
    <p className="text-sm text-gray-400 italic py-8 text-center bg-gray-50 rounded-xl">
      {mensaje}
    </p>
  );
}