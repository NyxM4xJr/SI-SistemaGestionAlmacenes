/**
 * ============================================================
 * ARCHIVO: frontend/src/pages/Recepcion/RecepcionMercancia.tsx
 * CASO DE USO: CU42 - Recepción de Lote Asistida por IA
 * CICLO: 6
 *
 * DESCRIPCIÓN: El encargado de almacén escanea el remito/factura de la
 * entrega; la IA extrae TODOS los ítems y precarga la tabla del lote.
 * El usuario asigna la ubicación de stock por ítem y confirma; el lote
 * se crea reutilizando el endpoint existente POST /api/lotes/.
 * ============================================================
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, ScanLine, Save, Trash2, PackageCheck } from "lucide-react";

import AppHeader from "@/components/AppHeader";
import CapturaImagen from "@/components/CapturaImagen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { importarRemito } from "@/services/recepcionService";
import { insumoService, type Insumo } from "@/services/insumoServices";
import { StockService, type Stock } from "@/services/StockServices";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";
const getToken = () => localStorage.getItem("access_token");

interface FilaRecepcion {
  insumo_nombre: string;
  insumo_id: number | "";
  stock_id: number | "";
  cantidad: number | "";
  costo_unitario: number | "";
  fecha_vencimiento: string;
}

export default function RecepcionMercancia() {
  const navigate = useNavigate();

  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [extraido, setExtraido] = useState(false);
  const [fechaIng, setFechaIng] = useState(new Date().toISOString().split("T")[0]);
  const [filas, setFilas] = useState<FilaRecepcion[]>([]);

  useEffect(() => {
    Promise.all([insumoService.getAll(), StockService.getAll()])
      .then(([ins, stk]) => {
        setInsumos(ins);
        setStocks(stk);
      })
      .catch(() => toast.error("Error cargando insumos/stock."));
  }, []);

  const analizar = async (dataUrl: string) => {
    try {
      setProcesando(true);
      const data = await importarRemito(dataUrl);
      if (!data.items || data.items.length === 0) {
        toast.warning("La IA no detectó ítems en el remito. Probá con otra foto.");
        return;
      }
      setFilas(
        data.items.map((it) => ({
          insumo_nombre: it.insumo || "",
          insumo_id: it.insumo_id ?? "",
          stock_id: "",
          cantidad: it.cantidad ?? "",
          costo_unitario: it.costo_unitario ?? "",
          fecha_vencimiento: it.fecha_vencimiento || "",
        }))
      );
      setExtraido(true);
      const sinMatch = data.items.filter((i) => !i.insumo_id).length;
      toast.success(
        `Remito leído: ${data.items.length} ítem(s).` +
          (sinMatch ? ` ${sinMatch} sin insumo emparejado — elegilo a mano.` : "")
      );
    } catch (e) {
      toast.error((e as Error).message || "Error al leer el remito.");
    } finally {
      setProcesando(false);
    }
  };

  const actualizar = (idx: number, campo: keyof FilaRecepcion, valor: string) => {
    setFilas((prev) =>
      prev.map((f, i) => {
        if (i !== idx) return f;
        if (campo === "insumo_id") {
          return { ...f, insumo_id: valor ? Number(valor) : "", stock_id: "" };
        }
        if (campo === "insumo_nombre" || campo === "fecha_vencimiento") {
          return { ...f, [campo]: valor };
        }
        return { ...f, [campo]: valor ? Number(valor) : "" };
      })
    );
  };

  const quitarFila = (idx: number) => setFilas((prev) => prev.filter((_, i) => i !== idx));

  const registrar = async () => {
    const detalles = [];
    for (let i = 0; i < filas.length; i++) {
      const f = filas[i];
      if (!f.insumo_id || !f.stock_id || !f.cantidad || !f.costo_unitario) {
        toast.error(`La fila ${i + 1} está incompleta (insumo, ubicación, cantidad y costo).`);
        return;
      }
      detalles.push({
        insumo_id: Number(f.insumo_id),
        stock_id: Number(f.stock_id),
        cantidad: Number(f.cantidad),
        costo_unitario: Number(f.costo_unitario),
        ...(f.fecha_vencimiento ? { fecha_vencimiento: f.fecha_vencimiento } : {}),
      });
    }

    try {
      setGuardando(true);
      const res = await fetch(`${API_URL}/lotes/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ fecha_ing: fechaIng, proveedor_id: null, detalles }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al registrar el lote.");
      }
      toast.success("Lote registrado desde el remito.");
      navigate("/lotes");
    } catch (e) {
      toast.error((e as Error).message || "Error al registrar el lote.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <AppHeader />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/lotes")}
          className="mb-6 -ml-4 text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Volver a Lotes
        </Button>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
          <div className="flex items-center gap-3 mb-1">
            <PackageCheck className="h-6 w-6 text-indigo-600" />
            <h1 className="text-2xl font-bold text-gray-900">Recepción de Mercadería (IA)</h1>
          </div>
          <p className="text-gray-500">
            Escaneá el remito de la entrega y la IA precarga todo el lote. Solo
            asignás la ubicación de cada insumo y confirmás.
          </p>
        </div>

        {!extraido ? (
          <div className="max-w-xl">
            <CapturaImagen
              onCaptura={analizar}
              etiquetaAccion="Leer remito"
              procesando={procesando}
            />
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Fecha de ingreso</label>
                <Input
                  type="date"
                  value={fechaIng}
                  onChange={(e) => setFechaIng(e.target.value)}
                  className="w-44"
                />
              </div>
              <Button variant="ghost" onClick={() => setExtraido(false)}>
                <ScanLine className="w-4 h-4 mr-2" /> Escanear otro
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="py-2 pr-3">Insumo</th>
                    <th className="py-2 pr-3">Ubicación (stock)</th>
                    <th className="py-2 pr-3 w-20">Cant.</th>
                    <th className="py-2 pr-3 w-24">Costo</th>
                    <th className="py-2 pr-3 w-40">Vencimiento</th>
                    <th className="py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f, idx) => {
                    const stocksValidos = f.insumo_id
                      ? stocks.filter((s) => s.insumo_id === Number(f.insumo_id))
                      : [];
                    return (
                      <tr key={idx} className="border-b border-gray-50">
                        <td className="py-2 pr-3">
                          <select
                            value={f.insumo_id}
                            onChange={(e) => actualizar(idx, "insumo_id", e.target.value)}
                            className={`w-full h-9 rounded-md border px-2 ${f.insumo_id ? "border-gray-200" : "border-amber-300 bg-amber-50"}`}
                          >
                            <option value="">
                              {f.insumo_nombre ? `¿? ${f.insumo_nombre}` : "Elegí insumo"}
                            </option>
                            {insumos.map((i) => (
                              <option key={i.id} value={i.id}>{i.nombre}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 pr-3">
                          <select
                            value={f.stock_id}
                            onChange={(e) => actualizar(idx, "stock_id", e.target.value)}
                            disabled={!f.insumo_id}
                            className="w-full h-9 rounded-md border border-gray-200 px-2 disabled:opacity-50"
                          >
                            <option value="">
                              {!f.insumo_id ? "Elegí insumo" : stocksValidos.length ? "Ubicación" : "Sin stock"}
                            </option>
                            {stocksValidos.map((s) => (
                              <option key={s.id} value={s.id}>Stock #{s.id} (Disp: {s.cantidad})</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 pr-3">
                          <Input
                            type="number"
                            value={f.cantidad}
                            onChange={(e) => actualizar(idx, "cantidad", e.target.value)}
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <Input
                            type="number"
                            value={f.costo_unitario}
                            onChange={(e) => actualizar(idx, "costo_unitario", e.target.value)}
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <Input
                            type="date"
                            value={f.fecha_vencimiento}
                            onChange={(e) => actualizar(idx, "fecha_vencimiento", e.target.value)}
                          />
                        </td>
                        <td className="py-2">
                          <Button variant="ghost" size="icon" onClick={() => quitarFila(idx)}>
                            <Trash2 className="w-4 h-4 text-gray-400" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end mt-5">
              <Button onClick={registrar} disabled={guardando} className="rounded-xl h-11">
                <Save className="w-4 h-4 mr-2" />
                {guardando ? "Registrando..." : "Registrar lote"}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
