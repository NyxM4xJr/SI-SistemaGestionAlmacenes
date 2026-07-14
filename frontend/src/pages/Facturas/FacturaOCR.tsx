/**
 * ============================================================
 * ARCHIVO: frontend/src/pages/Facturas/FacturaOCR.tsx
 * CASO DE USO: CU39 - OCR de Facturas con IA
 * CICLO: 6
 *
 * DESCRIPCIÓN: El usuario captura/sube la foto de una factura de
 * proveedor; la IA de visión extrae número, fecha, proveedor, ítems
 * y total. Los datos se muestran en un formulario EDITABLE (paso de
 * revisión, porque el OCR puede equivocarse) y recién al confirmar se
 * guardan. Reutiliza el componente CapturaImagen (compartido con CU42).
 * ============================================================
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

import AppHeader from "@/components/AppHeader";
import CapturaImagen from "@/components/CapturaImagen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  extraerFacturaOCR,
  registrarFactura,
  type ItemFactura,
} from "@/services/facturaService";
import { ProveedorService, type Proveedor } from "@/services/proveedorService";

export default function FacturaOCR() {
  const navigate = useNavigate();

  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [imagen, setImagen] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [extraida, setExtraida] = useState(false);

  // Datos editables tras el OCR
  const [numero, setNumero] = useState("");
  const [fecha, setFecha] = useState("");
  const [proveedorId, setProveedorId] = useState<string>("");
  const [items, setItems] = useState<ItemFactura[]>([]);

  useEffect(() => {
    ProveedorService.getAll()
      .then(setProveedores)
      .catch(() => toast.error("No se pudieron cargar los proveedores."));
  }, []);

  const total = items.reduce((acc, it) => acc + (Number(it.subtotal) || 0), 0);

  const analizar = async (dataUrl: string) => {
    try {
      setProcesando(true);
      setImagen(dataUrl);
      const data = await extraerFacturaOCR(dataUrl);
      setNumero(data.numero || "");
      setFecha(data.fecha || "");
      setItems(
        (data.items || []).map((it) => ({
          insumo: it.insumo || "",
          cantidad: Number(it.cantidad) || 0,
          precio_unitario: Number(it.precio_unitario) || 0,
          subtotal:
            Number(it.subtotal) ||
            Number(it.cantidad) * Number(it.precio_unitario) ||
            0,
        }))
      );
      // Prefijar proveedor si el nombre extraído coincide con alguno.
      if (data.proveedor) {
        const match = proveedores.find(
          (p) => p.nombre.toLowerCase() === data.proveedor!.toLowerCase()
        );
        if (match) setProveedorId(String(match.id));
      }
      setExtraida(true);
      toast.success("Factura analizada. Revisá los datos antes de guardar.");
    } catch (e) {
      toast.error((e as Error).message || "Error al analizar la factura.");
    } finally {
      setProcesando(false);
    }
  };

  const actualizarItem = (idx: number, campo: keyof ItemFactura, valor: string) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const actualizado = {
          ...it,
          [campo]: campo === "insumo" ? valor : Number(valor) || 0,
        };
        if (campo === "cantidad" || campo === "precio_unitario") {
          actualizado.subtotal = Number(
            (actualizado.cantidad * actualizado.precio_unitario).toFixed(2)
          );
        }
        return actualizado;
      })
    );
  };

  const agregarItem = () =>
    setItems((prev) => [...prev, { insumo: "", cantidad: 0, precio_unitario: 0, subtotal: 0 }]);

  const quitarItem = (idx: number) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));

  const guardar = async () => {
    if (items.length === 0) {
      toast.error("La factura debe tener al menos un ítem.");
      return;
    }
    try {
      setGuardando(true);
      await registrarFactura({
        numero: numero || null,
        fecha: fecha || null,
        proveedor_id: proveedorId ? Number(proveedorId) : null,
        total: Number(total.toFixed(2)),
        items,
        imagen,
      });
      toast.success("Factura guardada correctamente.");
      navigate("/facturas");
    } catch (e) {
      toast.error((e as Error).message || "Error al guardar la factura.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <AppHeader />

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/facturas")}
          className="mb-6 -ml-4 text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Volver a Facturas
        </Button>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Escanear Factura</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Captura */}
          <div>
            <CapturaImagen
              onCaptura={analizar}
              etiquetaAccion="Analizar factura"
              procesando={procesando}
            />
          </div>

          {/* Revisión */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            {!extraida ? (
              <div className="h-full flex items-center justify-center text-center text-gray-400 text-sm py-12">
                {procesando
                  ? "La IA está leyendo la factura..."
                  : "Los datos extraídos aparecerán acá para que los revises."}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500">N.º de factura</label>
                    <Input value={numero} onChange={(e) => setNumero(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">Fecha</label>
                    <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500">Proveedor</label>
                  <select
                    value={proveedorId}
                    onChange={(e) => setProveedorId(e.target.value)}
                    className="w-full h-10 rounded-md border border-gray-200 px-3 text-sm"
                  >
                    <option value="">— Sin asociar —</option>
                    {proveedores.map((p) => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Ítems
                    </label>
                    <Button variant="ghost" size="sm" onClick={agregarItem}>
                      <Plus className="w-4 h-4 mr-1" /> Agregar
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {items.map((it, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <Input
                          className="flex-1"
                          placeholder="Insumo"
                          value={it.insumo}
                          onChange={(e) => actualizarItem(idx, "insumo", e.target.value)}
                        />
                        <Input
                          className="w-16"
                          type="number"
                          placeholder="Cant."
                          value={it.cantidad || ""}
                          onChange={(e) => actualizarItem(idx, "cantidad", e.target.value)}
                        />
                        <Input
                          className="w-20"
                          type="number"
                          placeholder="Precio"
                          value={it.precio_unitario || ""}
                          onChange={(e) => actualizarItem(idx, "precio_unitario", e.target.value)}
                        />
                        <span className="w-20 text-right text-sm text-gray-600">
                          {it.subtotal.toFixed(2)}
                        </span>
                        <Button variant="ghost" size="icon" onClick={() => quitarItem(idx)}>
                          <Trash2 className="w-4 h-4 text-gray-400" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <span className="text-sm text-gray-500">Total</span>
                  <span className="text-lg font-bold text-gray-900">{total.toFixed(2)} Bs</span>
                </div>

                <Button onClick={guardar} disabled={guardando} className="w-full rounded-xl h-11">
                  {guardando ? "Guardando..." : "Guardar factura"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
