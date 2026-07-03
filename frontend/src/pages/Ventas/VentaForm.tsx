/**
 * ============================================================
 * ARCHIVO: frontend/src/pages/Ventas/VentaForm.tsx
 * CASO DE USO: CU35 - Registrar Venta de Platos
 * CICLO: 5
 * FECHA: 03/07/26
 *
 * DESCRIPCIÓN: Formulario para registrar una venta de platos.
 * Al confirmar, el backend descuenta el stock de los insumos
 * (reutiliza CU16) y muestra el resumen del descargo.
 * ============================================================
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ShoppingCart, Plus, Trash2, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import AppHeader from "@/components/AppHeader";

import { getPlatos, type Plato } from "@/services/platoService";
import {
  createVenta,
  type MetodoPago,
  type VentaItemPayload,
} from "@/services/ventaService";

interface Linea {
  plato_id: number | "";
  cantidad: number;
  precio_unitario: number | "";
}

export default function VentaForm() {
  const navigate = useNavigate();
  const [platos, setPlatos] = useState<Plato[]>([]);
  const [lineas, setLineas] = useState<Linea[]>([{ plato_id: "", cantidad: 1, precio_unitario: "" }]);
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("pendiente");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    getPlatos()
      .then(setPlatos)
      .catch(() => toast.error("Error al cargar los platos."));
  }, []);

  function actualizarLinea(idx: number, cambios: Partial<Linea>) {
    setLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...cambios } : l)));
  }

  function onSelectPlato(idx: number, platoId: number) {
    const plato = platos.find((p) => p.id === platoId);
    actualizarLinea(idx, {
      plato_id: platoId,
      // Autocompleta el precio con el costo del plato (editable)
      precio_unitario: plato ? plato.costo : "",
    });
  }

  function agregarLinea() {
    setLineas((prev) => [...prev, { plato_id: "", cantidad: 1, precio_unitario: "" }]);
  }

  function quitarLinea(idx: number) {
    setLineas((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

  const total = lineas.reduce((acc, l) => {
    const precio = typeof l.precio_unitario === "number" ? l.precio_unitario : 0;
    return acc + precio * (l.cantidad || 0);
  }, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const items: VentaItemPayload[] = [];
    for (const l of lineas) {
      if (l.plato_id === "" || !l.cantidad || l.cantidad <= 0) {
        toast.error("Cada línea requiere un plato y una cantidad mayor a 0.");
        return;
      }
      items.push({
        plato_id: Number(l.plato_id),
        cantidad: Number(l.cantidad),
        precio_unitario: l.precio_unitario === "" ? undefined : Number(l.precio_unitario),
      });
    }

    try {
      setGuardando(true);
      const res = await createVenta({ metodo_pago: metodoPago, items });
      const excluidos = res.descargo.insumos_excluidos.length;
      if (excluidos > 0) {
        toast.warning(
          `Venta registrada, pero ${excluidos} insumo(s) no se descontaron (stock insuficiente). Revisá el detalle.`
        );
      } else {
        toast.success("Venta registrada y stock descontado correctamente.");
      }
      navigate("/ventas");
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : "Error al registrar la venta.";
      toast.error(mensaje);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/ventas")}
          className="mb-4 text-gray-500 gap-1"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </Button>

        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2 mb-6">
          <ShoppingCart className="h-8 w-8 text-teal-500" />
          Registrar Venta
        </h1>

        <form onSubmit={handleSubmit}>
          <Card className="rounded-2xl shadow-sm border-0 bg-white mb-6">
            <CardContent className="p-6 space-y-4">
              {lineas.map((linea, idx) => (
                <div key={idx} className="flex flex-wrap gap-3 items-end border-b border-gray-100 pb-4">
                  <div className="flex-1 min-w-[200px]">
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Plato</label>
                    <select
                      value={linea.plato_id}
                      onChange={(e) => onSelectPlato(idx, Number(e.target.value))}
                      className="w-full h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-300"
                    >
                      <option value="">Seleccionar plato...</option>
                      {platos.map((p) => (
                        <option key={p.id} value={p.id}>{p.nombre}</option>
                      ))}
                    </select>
                  </div>

                  <div className="w-24">
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Cantidad</label>
                    <input
                      type="number"
                      min={1}
                      value={linea.cantidad}
                      onChange={(e) => actualizarLinea(idx, { cantidad: Number(e.target.value) })}
                      className="w-full h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                    />
                  </div>

                  <div className="w-32">
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Precio unit. (Bs)</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={linea.precio_unitario}
                      onChange={(e) =>
                        actualizarLinea(idx, {
                          precio_unitario: e.target.value === "" ? "" : Number(e.target.value),
                        })
                      }
                      className="w-full h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                    />
                  </div>

                  <div className="w-28">
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Subtotal</label>
                    <div className="h-11 flex items-center px-3 text-sm text-gray-700 font-medium">
                      {(
                        (typeof linea.precio_unitario === "number" ? linea.precio_unitario : 0) *
                        (linea.cantidad || 0)
                      ).toFixed(2)}
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => quitarLinea(idx)}
                    className="text-gray-400 hover:text-red-500 h-11 w-11"
                    disabled={lineas.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <Button
                type="button"
                variant="ghost"
                onClick={agregarLinea}
                className="text-teal-600 hover:text-teal-700 gap-1"
              >
                <Plus className="h-4 w-4" /> Agregar plato
              </Button>
            </CardContent>
          </Card>

          {/* Resumen y método de pago */}
          <Card className="rounded-2xl shadow-sm border-0 bg-white">
            <CardContent className="p-6 flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-[200px]">
                <label className="text-xs font-medium text-gray-500 mb-1 block">Método de pago</label>
                <select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value as MetodoPago)}
                  className="w-full h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-300"
                >
                  <option value="pendiente">Pendiente (cobrar luego)</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="stripe">Stripe</option>
                  <option value="paypal">PayPal</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  El cobro por pasarela se realiza aparte desde el detalle de la venta.
                </p>
              </div>

              <div className="text-right">
                <p className="text-sm text-gray-500">Total</p>
                <p className="text-3xl font-bold text-gray-900">{total.toFixed(2)} Bs</p>
              </div>

              <Button
                type="submit"
                disabled={guardando}
                className="rounded-xl h-12 px-6 bg-teal-600 hover:bg-teal-700 text-white gap-2"
              >
                {guardando ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                ) : (
                  <ShoppingCart className="h-4 w-4" />
                )}
                Registrar venta
              </Button>
            </CardContent>
          </Card>
        </form>
      </main>
    </div>
  );
}
