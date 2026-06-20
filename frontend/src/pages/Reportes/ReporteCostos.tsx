/**
 * ============================================================
 * ARCHIVO: frontend/src/pages/Reportes/ReporteCostos.tsx
 * CASO DE USO: CU27 - Generar Reporte de Costos por Plato
 * CICLO: 4
 * AUTOR: Karen Ortega
 * FECHA: 19/06/26
 *
 * DESCRIPCIÓN: Página de reporte de costos por plato. Muestra
 * el costo teórico (sin merma) y real (con merma técnica de
 * CU22) de cada plato con receta asociada, comparado contra su
 * precio de venta para obtener el margen. Permite filtrar por
 * un plato específico y descargar el reporte en PDF o Excel.
 * Sigue el patrón de PlatoForm.tsx / CierreTurno.tsx.
 * ============================================================
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  FileBarChart,
  Loader2,
  FileDown,
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Award,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

import { getPlatos, type Plato } from "@/services/platoService";
import {
  getReporteCostos,
  descargarReportePDF,
  descargarReporteExcel,
  type ItemReporteCostos,
} from "@/services/reporteCostosService";

export default function ReporteCostos() {
  const navigate = useNavigate();

  // ── Estado de filtro ───────────────────────────────────────
  const [platos, setPlatos] = useState<Plato[]>([]);
  const [platoIdFiltro, setPlatoIdFiltro] = useState<string>("todos");

  // ── Estado del reporte ─────────────────────────────────────
  const [reporte, setReporte] = useState<ItemReporteCostos[]>([]);
  const [masRentable, setMasRentable] = useState<ItemReporteCostos | null>(null);
  const [menosRentable, setMenosRentable] = useState<ItemReporteCostos | null>(null);

  // ── Estado de UI ────────────────────────────────────────────
  const [cargando, setCargando] = useState(true);
  const [descargandoPDF, setDescargandoPDF] = useState(false);
  const [descargandoExcel, setDescargandoExcel] = useState(false);

  // ── Cargar catálogo de platos y reporte inicial ─────────────
  useEffect(() => {
    async function cargarInicial() {
      try {
        setCargando(true);
        const listaPlatos = await getPlatos();
        setPlatos(listaPlatos);
        await cargarReporte(undefined);
      } catch {
        toast.error("No se pudo cargar el reporte de costos.");
      } finally {
        setCargando(false);
      }
    }

    cargarInicial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargarReporte(platoId: number | undefined) {
    const data = await getReporteCostos(platoId);
    setReporte(data.reporte);
    setMasRentable(data.plato_mas_rentable);
    setMenosRentable(data.plato_menos_rentable);
  }

  async function handleCambiarFiltro(valor: string) {
    setPlatoIdFiltro(valor);
    try {
      setCargando(true);
      const platoId = valor === "todos" ? undefined : Number(valor);
      await cargarReporte(platoId);
    } catch (err: unknown) {
      const mensaje =
        err instanceof Error ? err.message : "Error al filtrar el reporte.";
      toast.error(mensaje);
    } finally {
      setCargando(false);
    }
  }

  function platoIdActual(): number | undefined {
    return platoIdFiltro === "todos" ? undefined : Number(platoIdFiltro);
  }

  async function handleDescargarPDF() {
    try {
      setDescargandoPDF(true);
      await descargarReportePDF(platoIdActual());
      toast.success("PDF descargado correctamente.");
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : "Error al descargar el PDF.";
      toast.error(mensaje);
    } finally {
      setDescargandoPDF(false);
    }
  }

  async function handleDescargarExcel() {
    try {
      setDescargandoExcel(true);
      await descargarReporteExcel(platoIdActual());
      toast.success("Excel descargado correctamente.");
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : "Error al descargar el Excel.";
      toast.error(mensaje);
    } finally {
      setDescargandoExcel(false);
    }
  }

  function formatoBs(valor: number | null): string {
    return valor !== null ? `Bs. ${valor.toFixed(2)}` : "N/D";
  }

  function badgeMargen(margen: number | null) {
    if (margen === null) {
      return <Badge className="bg-gray-100 text-gray-500 border-0">N/D</Badge>;
    }
    if (margen >= 30) {
      return (
        <Badge className="bg-green-100 text-green-700 border-0 gap-1">
          <TrendingUp className="h-3 w-3" />
          {margen.toFixed(1)}%
        </Badge>
      );
    }
    if (margen >= 0) {
      return (
        <Badge className="bg-yellow-100 text-yellow-700 border-0 gap-1">
          {margen.toFixed(1)}%
        </Badge>
      );
    }
    return (
      <Badge className="bg-red-100 text-red-700 border-0 gap-1">
        <TrendingDown className="h-3 w-3" />
        {margen.toFixed(1)}%
      </Badge>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Botón volver ── */}
        <Button
          variant="ghost"
          className="mb-6 gap-2 text-gray-500 hover:text-gray-700 -ml-2"
          onClick={() => navigate("/platos")}
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al catálogo de Platos
        </Button>

        {/* ── Card de encabezado y filtro ── */}
        <Card className="rounded-3xl shadow-md border-0 bg-white mb-6">
          <CardHeader className="pb-2 px-8 pt-8">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-orange-50">
                <FileBarChart className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-gray-900">
                  Reporte de Costos por Plato
                </CardTitle>
                <p className="text-sm text-gray-400 mt-0.5">
                  Costo teórico (sin merma) vs costo real (con merma técnica) y
                  margen frente al precio de venta.
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="px-8 pb-8 pt-6">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
              <div className="flex-1 space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Filtrar por plato
                </label>
                <Select value={platoIdFiltro} onValueChange={handleCambiarFiltro}>
                  <SelectTrigger className="rounded-xl h-11 border-gray-200">
                    <SelectValue placeholder="Selecciona un plato" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los platos</SelectItem>
                    {platos.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="rounded-xl h-11 gap-2 border-gray-200"
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
                  className="rounded-xl h-11 gap-2 border-gray-200"
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

        {/* ── Tarjetas resumen: más / menos rentable ── */}
        {!cargando && (masRentable || menosRentable) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <Card className="rounded-3xl shadow-md border-0 bg-white">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-green-50">
                  <Award className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Plato más rentable</p>
                  <p className="text-lg font-bold text-gray-900">
                    {masRentable ? masRentable.plato_nombre : "N/D"}
                  </p>
                  {masRentable && (
                    <p className="text-sm text-green-600 font-medium">
                      Margen: {masRentable.margen?.toFixed(1)}%
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl shadow-md border-0 bg-white">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-red-50">
                  <TrendingDown className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Plato menos rentable</p>
                  <p className="text-lg font-bold text-gray-900">
                    {menosRentable ? menosRentable.plato_nombre : "N/D"}
                  </p>
                  {menosRentable && (
                    <p className="text-sm text-red-600 font-medium">
                      Margen: {menosRentable.margen?.toFixed(1)}%
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Tabla del reporte ── */}
        <Card className="rounded-3xl shadow-md border-0 bg-white">
          <CardContent className="p-8">
            {cargando ? (
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-3 text-gray-400">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-200 border-t-orange-500" />
                  <p className="text-sm">Calculando reporte de costos...</p>
                </div>
              </div>
            ) : reporte.length === 0 ? (
              <p className="text-sm text-gray-400 italic py-8 text-center bg-gray-50 rounded-xl">
                No hay platos con receta asociada para generar el reporte.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead>Plato</TableHead>
                      <TableHead className="text-right">Costo Teórico</TableHead>
                      <TableHead className="text-right">Costo Real</TableHead>
                      <TableHead className="text-right">Precio de Venta</TableHead>
                      <TableHead className="text-center">Margen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reporte.map((item) => (
                      <TableRow key={item.plato_id}>
                        <TableCell className="font-medium text-gray-700">
                          <div className="flex items-center gap-2">
                            {item.plato_nombre}
                            {item.costos_incompletos && (
                              <span title="Algún insumo no tiene lote registrado">
                                <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-gray-600">
                          {formatoBs(item.costo_teorico)}
                        </TableCell>
                        <TableCell className="text-right text-gray-600">
                          {formatoBs(item.costo_real)}
                        </TableCell>
                        <TableCell className="text-right text-gray-600">
                          {formatoBs(item.precio_venta)}
                        </TableCell>
                        <TableCell className="text-center">
                          {badgeMargen(item.margen)}
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