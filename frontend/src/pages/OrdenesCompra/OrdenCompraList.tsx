/**
 * ============================================================
 * ARCHIVO: frontend/src/pages/OrdenesCompra/OrdenCompraList.tsx
 * CASO DE USO: CU37 - Órdenes de Compra Automáticas
 * CICLO: 5
 * FECHA: 03/07/26
 *
 * DESCRIPCIÓN: Lista de órdenes de compra. Botón para generar
 * automáticamente las órdenes de los insumos bajo mínimo,
 * eligiendo el proveedor más barato y notificándolo por email.
 * ============================================================
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Truck,
  Zap,
  Mail,
  CheckCircle2,
  PackageCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AppHeader from "@/components/AppHeader";

import {
  type OrdenCompra,
  type EstadoOrden,
  getOrdenesCompra,
  generarOrdenesAutomaticas,
  updateOrdenCompra,
} from "@/services/ordenCompraService";

function EstadoBadge({ estado }: { estado: EstadoOrden }) {
  const map: Record<EstadoOrden, string> = {
    generada: "text-blue-700 bg-blue-50 border-blue-200",
    enviada: "text-indigo-700 bg-indigo-50 border-indigo-200",
    recibida: "text-green-700 bg-green-50 border-green-200",
    cancelada: "text-gray-500 bg-gray-50 border-gray-200",
  };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${map[estado]}`}>
      {estado}
    </span>
  );
}

export default function OrdenCompraList() {
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  const [cargando, setCargando] = useState(true);
  const [generando, setGenerando] = useState(false);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    try {
      setCargando(true);
      const data = await getOrdenesCompra();
      setOrdenes(data);
    } catch {
      toast.error("Error al cargar las órdenes de compra.");
    } finally {
      setCargando(false);
    }
  }

  async function handleGenerar() {
    try {
      setGenerando(true);
      const res = await generarOrdenesAutomaticas();
      if (res.ordenes.length === 0) {
        toast.info("No hay insumos en o por debajo del stock mínimo.");
      } else {
        const enviadas = res.ordenes.filter((o) => o.email_enviado).length;
        toast.success(
          `${res.ordenes.length} orden(es) generada(s), ${enviadas} notificada(s) por email.`
        );
      }
      if (res.insumos_sin_proveedor.length > 0) {
        toast.warning(
          `Sin proveedor asociado: ${res.insumos_sin_proveedor.join(", ")}.`
        );
      }
      await cargar();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al generar las órdenes.");
    } finally {
      setGenerando(false);
    }
  }

  async function handleRecibir(orden: OrdenCompra) {
    try {
      await updateOrdenCompra(orden.id, "recibida");
      setOrdenes((prev) => prev.map((o) => (o.id === orden.id ? { ...o, estado: "recibida" } : o)));
      toast.success(`Orden #${orden.id} marcada como recibida.`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar la orden.");
    }
  }

  const totalGeneradas = ordenes.length;
  const totalPendientes = ordenes.filter((o) => o.estado === "generada" || o.estado === "enviada").length;

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Truck className="h-8 w-8 text-indigo-500" />
              Órdenes de Compra
            </h1>
            <p className="text-gray-500 mt-1 text-sm">
              Reabastecimiento automático de insumos bajo el stock mínimo
            </p>
          </div>
          <Button
            onClick={handleGenerar}
            disabled={generando}
            className="rounded-xl h-11 px-4 gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {generando ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            Generar automáticas
          </Button>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <Card className="rounded-2xl shadow-sm border-0 bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Órdenes totales</CardTitle>
              <Truck className="h-5 w-5 text-indigo-400" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">{totalGeneradas}</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl shadow-sm border-0 bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Pendientes de recibir</CardTitle>
              <PackageCheck className="h-5 w-5 text-blue-400" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">{totalPendientes}</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
          {cargando ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-500" />
            </div>
          ) : ordenes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Truck className="h-12 w-12 mb-3 text-gray-300" />
              <p className="text-base font-medium text-gray-500">No hay órdenes de compra.</p>
              <p className="text-sm text-gray-400 mt-1">
                Usá "Generar automáticas" para crear órdenes de los insumos bajo mínimo.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:bg-gray-50">
                    <TableHead className="font-semibold text-gray-600 w-[60px]">#</TableHead>
                    <TableHead className="font-semibold text-gray-600">Fecha</TableHead>
                    <TableHead className="font-semibold text-gray-600">Proveedor</TableHead>
                    <TableHead className="font-semibold text-gray-600">Insumos</TableHead>
                    <TableHead className="font-semibold text-gray-600">Total</TableHead>
                    <TableHead className="font-semibold text-gray-600">Origen</TableHead>
                    <TableHead className="font-semibold text-gray-600">Estado</TableHead>
                    <TableHead className="font-semibold text-gray-600 text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordenes.map((orden) => (
                    <TableRow key={orden.id} className="hover:bg-indigo-50/30">
                      <TableCell className="text-gray-400 text-sm">{orden.id}</TableCell>
                      <TableCell className="text-gray-600 text-sm whitespace-nowrap">{orden.fecha}</TableCell>
                      <TableCell className="font-medium text-gray-900">
                        {orden.proveedor?.nombre ?? `Proveedor #${orden.proveedor_id}`}
                        {orden.estado === "enviada" && (
                          <span className="inline-flex items-center gap-1 text-xs text-indigo-500 ml-2">
                            <Mail className="h-3 w-3" /> notificado
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-600 text-sm">
                        {(orden.detalle_orden_compra ?? [])
                          .map((d) => `${d.insumo?.nombre ?? `#${d.insumo_id}`} x${d.cantidad}`)
                          .join(", ") || "—"}
                      </TableCell>
                      <TableCell className="font-medium text-gray-900">
                        {Number(orden.total).toFixed(2)} Bs
                      </TableCell>
                      <TableCell className="text-gray-500 text-xs">
                        {orden.generada_auto ? "Automática" : "Manual"}
                      </TableCell>
                      <TableCell><EstadoBadge estado={orden.estado} /></TableCell>
                      <TableCell className="text-right">
                        {(orden.estado === "generada" || orden.estado === "enviada") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-3 text-green-600 hover:text-green-800 hover:bg-green-50 text-xs gap-1.5 rounded-lg"
                            onClick={() => handleRecibir(orden)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Marcar recibida
                          </Button>
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
