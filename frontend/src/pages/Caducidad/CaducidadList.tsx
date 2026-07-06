/**
 * ============================================================
 * ARCHIVO: frontend/src/pages/Caducidad/CaducidadList.tsx
 * CASO DE USO: CU34 - Gestión de Caducidad FEFO (informativo)
 * CICLO: 5
 * FECHA: 03/07/26
 *
 * DESCRIPCIÓN: Panel FEFO (First Expired, First Out). Lista los
 * lotes ordenados por fecha de vencimiento, resalta vencidos y
 * próximos a vencer, sugiere qué consumir primero y permite
 * registrar una merma por vencimiento (reutiliza CU14).
 * ============================================================
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CalendarClock,
  AlertTriangle,
  Clock,
  PackageX,
  ArrowRightCircle,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AppHeader from "@/components/AppHeader";

import {
  type ItemCaducidad,
  type CaducidadResponse,
  getCaducidad,
} from "@/services/caducidadService";
import { createMovimiento } from "@/services/movimientoService";

// ── Helpers ──────────────────────────────────────────────────

function EstadoBadge({ item }: { item: ItemCaducidad }) {
  if (item.estado === "vencido") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border text-red-700 bg-red-50 border-red-200">
        <AlertTriangle className="h-3.5 w-3.5" />
        Vencido
      </span>
    );
  }
  if (item.estado === "por_vencer") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border text-yellow-700 bg-yellow-50 border-yellow-200">
        <Clock className="h-3.5 w-3.5" />
        Por vencer{item.dias_restantes !== null ? ` (${item.dias_restantes}d)` : ""}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border text-green-700 bg-green-50 border-green-200">
      OK
    </span>
  );
}

// ── Componente principal ─────────────────────────────────────

export default function CaducidadList() {
  const [data, setData]       = useState<CaducidadResponse | null>(null);
  const [cargando, setCargando] = useState(true);
  const [dias, setDias]       = useState(7);
  const [mermandoId, setMermandoId] = useState<number | null>(null);

  useEffect(() => {
    cargar(dias);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargar(ventana: number) {
    try {
      setCargando(true);
      const res = await getCaducidad(ventana);
      setData(res);
    } catch {
      toast.error("Error al cargar la información de caducidad.");
    } finally {
      setCargando(false);
    }
  }

  // Registrar merma por vencimiento (reutiliza CU14)
  async function handleRegistrarMerma(item: ItemCaducidad) {
    if (!item.stock_id || !item.insumo_id) {
      toast.error("El lote no tiene stock/insumo asociado para registrar merma.");
      return;
    }
    const valorPerdido = Number(item.cantidad) * Number(item.costo_unitario || 0);
    try {
      setMermandoId(item.id);
      await createMovimiento({
        tipo: "merma",
        insumo_id: item.insumo_id,
        stock_id: item.stock_id,
        cantidad: Number(item.cantidad),
        causa: "Vencimiento",
        valor_perdido: valorPerdido,
        observacion: `Merma por vencimiento del lote #${item.lote_id} (vence ${item.fecha_vencimiento ?? "-"}).`,
      });
      toast.success("Merma por vencimiento registrada.");
      await cargar(dias);
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : "Error al registrar la merma.";
      toast.error(mensaje);
    } finally {
      setMermandoId(null);
    }
  }

  const items = data?.items ?? [];
  // Sugerencia: primer lote no vencido con fecha de vencimiento (el más próximo)
  const sugerido = items.find((i) => i.estado !== "vencido" && i.fecha_vencimiento);

  const spinner = (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3 text-gray-400">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-500" />
        <p className="text-sm">Cargando caducidad...</p>
      </div>
    </div>
  );

  const estadoVacio = (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
      <PackageX className="h-12 w-12 mb-3 text-gray-300" />
      <p className="text-base font-medium text-gray-500">
        No hay lotes registrados con fecha de vencimiento.
      </p>
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
              <CalendarClock className="h-8 w-8 text-emerald-500" />
              Caducidad de Lotes
            </h1>
            <p className="text-gray-500 mt-1 text-sm">
              Primero en vencer, primero en salir — consumí los lotes en orden
            </p>
          </div>

          <div className="flex items-end gap-2">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">
                Ventana "por vencer" (días)
              </label>
              <input
                type="number"
                min={1}
                value={dias}
                onChange={(e) => setDias(Number(e.target.value))}
                className="w-28 h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
            </div>
            <Button
              onClick={() => cargar(dias)}
              className="rounded-xl h-11 px-4 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Aplicar
            </Button>
          </div>
        </div>

        {/* ── Sugerencia FEFO ── */}
        {sugerido && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-6 flex items-center gap-3">
            <ArrowRightCircle className="h-5 w-5 text-emerald-600 shrink-0" />
            <p className="text-sm text-emerald-800">
              <span className="font-semibold">Consumir primero:</span>{" "}
              {sugerido.insumo_nombre ?? `Insumo #${sugerido.insumo_id}`}
              {" "}(lote #{sugerido.lote_id}, vence {sugerido.fecha_vencimiento}).
            </p>
          </div>
        )}

        {/* ── Estadísticas ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card className="rounded-2xl shadow-sm border-0 bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Vencidos</CardTitle>
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">{data?.vencidos ?? 0}</p>
              <p className="text-xs text-gray-400 mt-1">requieren merma</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm border-0 bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Por Vencer</CardTitle>
              <Clock className="h-5 w-5 text-yellow-400" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">{data?.por_vencer ?? 0}</p>
              <p className="text-xs text-gray-400 mt-1">dentro de {data?.dias_ventana ?? dias} días</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm border-0 bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Total lotes</CardTitle>
              <CalendarClock className="h-5 w-5 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">{data?.total ?? 0}</p>
              <p className="text-xs text-gray-400 mt-1">con fecha de vencimiento</p>
            </CardContent>
          </Card>
        </div>

        {/* ── Tabla ── */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
          {cargando ? (
            spinner
          ) : items.length === 0 ? (
            estadoVacio
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:bg-gray-50">
                    <TableHead className="font-semibold text-gray-600 w-[50px]">#</TableHead>
                    <TableHead className="font-semibold text-gray-600">Insumo</TableHead>
                    <TableHead className="font-semibold text-gray-600">Lote</TableHead>
                    <TableHead className="font-semibold text-gray-600">Vence</TableHead>
                    <TableHead className="font-semibold text-gray-600">Cantidad</TableHead>
                    <TableHead className="font-semibold text-gray-600">Estado</TableHead>
                    <TableHead className="font-semibold text-gray-600 text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow
                      key={item.id}
                      className={
                        item.estado === "vencido"
                          ? "bg-red-50/40 hover:bg-red-50/60"
                          : "hover:bg-emerald-50/30"
                      }
                    >
                      <TableCell className="text-gray-400 text-sm">{index + 1}</TableCell>
                      <TableCell className="font-medium text-gray-900">
                        {item.insumo_nombre ?? `Insumo #${item.insumo_id}`}
                      </TableCell>
                      <TableCell className="text-gray-500 text-sm">#{item.lote_id}</TableCell>
                      <TableCell className="text-gray-600 text-sm whitespace-nowrap">
                        {item.fecha_vencimiento ?? "—"}
                      </TableCell>
                      <TableCell className="text-gray-600 text-sm">{item.cantidad}</TableCell>
                      <TableCell><EstadoBadge item={item} /></TableCell>
                      <TableCell className="text-right">
                        {item.estado === "vencido" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-3 text-red-600 hover:text-red-800 hover:bg-red-50 text-xs gap-1.5 rounded-lg"
                            onClick={() => handleRegistrarMerma(item)}
                            disabled={mermandoId === item.id}
                          >
                            {mermandoId === item.id ? (
                              <div className="h-3 w-3 animate-spin rounded-full border-2 border-red-300 border-t-red-600" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                            Registrar merma
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
