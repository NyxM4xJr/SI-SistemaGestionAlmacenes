/**
 * ============================================================
 * ARCHIVO: frontend/src/pages/Ventas/VentaList.tsx
 * CASO DE USO: CU35 - Registrar Venta de Platos
 * CICLO: 5
 * FECHA: 03/07/26
 *
 * DESCRIPCIÓN: Lista de ventas registradas con su estado y total.
 * El botón "Cobrar" (Stripe/PayPal) se habilita para ventas
 * pendientes de pago (integración con CU31/CU36).
 * ============================================================
 */

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ShoppingCart,
  Plus,
  CheckCircle2,
  Ban,
  Receipt,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AppHeader from "@/components/AppHeader";
import CobrarVentaButton from "./CobrarVentaButton";

import {
  type Venta,
  type EstadoVenta,
  getVentas,
  updateVenta,
} from "@/services/ventaService";
import { capturarPayPal } from "@/services/pagoService";

function EstadoBadge({ estado }: { estado: EstadoVenta }) {
  const map: Record<EstadoVenta, string> = {
    registrada: "text-blue-700 bg-blue-50 border-blue-200",
    pagada: "text-green-700 bg-green-50 border-green-200",
    anulada: "text-gray-500 bg-gray-50 border-gray-200",
  };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${map[estado]}`}>
      {estado}
    </span>
  );
}

export default function VentaList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    cargar();
  }, []);

  // Retorno de PayPal: capturar la orden y marcar la venta como pagada
  useEffect(() => {
    const capturar = searchParams.get("paypal_capturar");
    const ventaId = searchParams.get("venta");
    const orderId = searchParams.get("token"); // PayPal añade ?token=<order_id>
    if (capturar !== "1" || !ventaId || !orderId) return;

    (async () => {
      try {
        const res = await capturarPayPal(orderId);
        if (res.status === "COMPLETED") {
          await updateVenta(Number(ventaId), { estado: "pagada", metodo_pago: "paypal" });
          toast.success(`Venta #${ventaId} cobrada con PayPal.`);
        } else {
          toast.warning(`El pago de PayPal quedó en estado: ${res.status}.`);
        }
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "No se pudo capturar el pago de PayPal.");
      } finally {
        // Limpiar los query params del retorno y refrescar la lista
        setSearchParams({}, { replace: true });
        cargar();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function cargar() {
    try {
      setCargando(true);
      const data = await getVentas();
      setVentas(data);
    } catch {
      toast.error("Error al cargar las ventas.");
    } finally {
      setCargando(false);
    }
  }

  async function handleAnular(venta: Venta) {
    try {
      await updateVenta(venta.id, { estado: "anulada" });
      setVentas((prev) => prev.map((v) => (v.id === venta.id ? { ...v, estado: "anulada" } : v)));
      toast.success("Venta anulada.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al anular la venta.");
    }
  }

  const totalVendido = ventas
    .filter((v) => v.estado !== "anulada")
    .reduce((acc, v) => acc + Number(v.total), 0);
  const totalPagadas = ventas.filter((v) => v.estado === "pagada").length;

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <ShoppingCart className="h-8 w-8 text-teal-500" />
              Ventas
            </h1>
            <p className="text-gray-500 mt-1 text-sm">
              Registro de ventas de platos y descuento de inventario
            </p>
          </div>
          <Button
            onClick={() => navigate("/ventas/nueva")}
            className="rounded-xl h-11 px-4 gap-2 bg-teal-600 hover:bg-teal-700 text-white"
          >
            <Plus className="h-4 w-4" /> Nueva venta
          </Button>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card className="rounded-2xl shadow-sm border-0 bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Total vendido</CardTitle>
              <Receipt className="h-5 w-5 text-teal-400" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">{totalVendido.toFixed(2)} Bs</p>
              <p className="text-xs text-gray-400 mt-1">excluye anuladas</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl shadow-sm border-0 bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Ventas pagadas</CardTitle>
              <CheckCircle2 className="h-5 w-5 text-green-400" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">{totalPagadas}</p>
              <p className="text-xs text-gray-400 mt-1">cobradas por pasarela/efectivo</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl shadow-sm border-0 bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Total ventas</CardTitle>
              <ShoppingCart className="h-5 w-5 text-blue-400" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">{ventas.length}</p>
              <p className="text-xs text-gray-400 mt-1">registradas</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
          {cargando ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-200 border-t-teal-500" />
            </div>
          ) : ventas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <ShoppingCart className="h-12 w-12 mb-3 text-gray-300" />
              <p className="text-base font-medium text-gray-500">No hay ventas registradas.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:bg-gray-50">
                    <TableHead className="font-semibold text-gray-600 w-[60px]">#</TableHead>
                    <TableHead className="font-semibold text-gray-600">Fecha</TableHead>
                    <TableHead className="font-semibold text-gray-600">Platos</TableHead>
                    <TableHead className="font-semibold text-gray-600">Total</TableHead>
                    <TableHead className="font-semibold text-gray-600">Método</TableHead>
                    <TableHead className="font-semibold text-gray-600">Estado</TableHead>
                    <TableHead className="font-semibold text-gray-600 text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ventas.map((venta) => (
                    <TableRow key={venta.id} className="hover:bg-teal-50/30">
                      <TableCell className="text-gray-400 text-sm">{venta.id}</TableCell>
                      <TableCell className="text-gray-600 text-sm whitespace-nowrap">
                        {venta.fecha}
                      </TableCell>
                      <TableCell className="text-gray-600 text-sm">
                        {(venta.detalle_venta ?? [])
                          .map((d) => `${d.plato?.nombre ?? `#${d.plato_id}`} x${d.cantidad}`)
                          .join(", ") || "—"}
                      </TableCell>
                      <TableCell className="font-medium text-gray-900">
                        {Number(venta.total).toFixed(2)} Bs
                      </TableCell>
                      <TableCell className="text-gray-600 text-sm">{venta.metodo_pago}</TableCell>
                      <TableCell><EstadoBadge estado={venta.estado} /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {venta.estado === "registrada" && (
                            <>
                              <CobrarVentaButton
                                venta={venta}
                                onPagada={() =>
                                  setVentas((prev) =>
                                    prev.map((v) =>
                                      v.id === venta.id ? { ...v, estado: "pagada" } : v
                                    )
                                  )
                                }
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-3 text-red-600 hover:text-red-800 hover:bg-red-50 text-xs gap-1.5 rounded-lg"
                                onClick={() => handleAnular(venta)}
                              >
                                <Ban className="h-3.5 w-3.5" /> Anular
                              </Button>
                            </>
                          )}
                        </div>
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
