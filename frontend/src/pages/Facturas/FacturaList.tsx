/**
 * ============================================================
 * ARCHIVO: frontend/src/pages/Facturas/FacturaList.tsx
 * CASOS DE USO: CU39 (listar), CU40 (conciliar), CU41 (auditoría)
 * CICLO: 6
 *
 * DESCRIPCIÓN: Repositorio de facturas guardadas. Desde acá:
 *   - Se abre el escaneo de una nueva factura (CU39).
 *   - Se concilia una factura contra su orden de compra (CU40): se
 *     elige la orden y la IA lista las diferencias.
 *   - Se corre la auditoría de anomalías (CU41): duplicados y
 *     sobreprecios, con informe redactado por la IA.
 * ============================================================
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ScanText,
  ShieldAlert,
  Trash2,
  ChevronDown,
  ChevronUp,
  FileText,
} from "lucide-react";

import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import {
  listarFacturas,
  eliminarFactura,
  conciliarFactura,
  type Factura,
  type ResultadoConciliacion,
} from "@/services/facturaService";
import {
  detectarFacturasAnomalas,
  type AuditoriaFacturas,
} from "@/services/facturaAnomaliaService";
import { getOrdenesCompra, type OrdenCompra } from "@/services/ordenCompraService";

const estadoBadge: Record<string, string> = {
  pendiente: "bg-gray-100 text-gray-600",
  conciliada: "bg-green-100 text-green-700",
  con_diferencias: "bg-amber-100 text-amber-700",
};

export default function FacturaList() {
  const navigate = useNavigate();

  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  const [cargando, setCargando] = useState(true);
  const [expandida, setExpandida] = useState<number | null>(null);

  const [ordenSel, setOrdenSel] = useState<Record<number, string>>({});
  const [conciliando, setConciliando] = useState<number | null>(null);
  const [resultado, setResultado] = useState<Record<number, ResultadoConciliacion>>({});

  const [auditando, setAuditando] = useState(false);
  const [auditoria, setAuditoria] = useState<AuditoriaFacturas | null>(null);

  const cargar = async () => {
    try {
      setCargando(true);
      const [f, o] = await Promise.all([listarFacturas(), getOrdenesCompra().catch(() => [])]);
      setFacturas(f);
      setOrdenes(o);
    } catch (e) {
      toast.error((e as Error).message || "Error al cargar las facturas.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const conciliar = async (facturaId: number) => {
    const ordenId = ordenSel[facturaId];
    if (!ordenId) {
      toast.error("Elegí la orden de compra a conciliar.");
      return;
    }
    try {
      setConciliando(facturaId);
      const res = await conciliarFactura(facturaId, Number(ordenId));
      setResultado((prev) => ({ ...prev, [facturaId]: res }));
      toast.success(
        res.coincide && res.diferencias.length === 0
          ? "La factura coincide con la orden."
          : `Se detectaron ${res.diferencias.length} diferencia(s).`
      );
      cargar();
    } catch (e) {
      toast.error((e as Error).message || "Error al conciliar.");
    } finally {
      setConciliando(null);
    }
  };

  const auditar = async () => {
    try {
      setAuditando(true);
      const res = await detectarFacturasAnomalas();
      setAuditoria(res);
      toast.success(
        res.facturas_anomalas.length > 0
          ? `${res.facturas_anomalas.length} factura(s) con anomalías.`
          : "Sin anomalías detectadas."
      );
      cargar();
    } catch (e) {
      toast.error((e as Error).message || "Error al auditar.");
    } finally {
      setAuditando(false);
    }
  };

  const borrar = async (id: number) => {
    if (!confirm("¿Eliminar esta factura?")) return;
    try {
      await eliminarFactura(id);
      toast.success("Factura eliminada.");
      cargar();
    } catch (e) {
      toast.error((e as Error).message || "Error al eliminar.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <AppHeader />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Facturas</h1>
              <p className="text-gray-500 mt-1">
                Facturas de proveedores escaneadas con IA. Conciliá contra
                órdenes de compra y auditá anomalías.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" onClick={auditar} disabled={auditando} className="rounded-xl h-11">
                <ShieldAlert className="w-4 h-4 mr-2" />
                {auditando ? "Auditando..." : "Auditar facturas"}
              </Button>
              <Button onClick={() => navigate("/facturas/escanear")} className="rounded-xl h-11">
                <ScanText className="w-4 h-4 mr-2" /> Escanear factura
              </Button>
            </div>
          </div>
        </div>

        {/* Informe de auditoría (CU41) */}
        {auditoria && (
          <div className="bg-white rounded-xl shadow-sm border border-amber-200 p-5 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              <h2 className="font-semibold text-gray-800">Informe de auditoría (IA)</h2>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-line">{auditoria.informe}</p>
            {(auditoria.duplicados.length > 0 || auditoria.sobreprecios.length > 0) && (
              <div className="mt-3 grid sm:grid-cols-2 gap-3 text-xs">
                {auditoria.duplicados.length > 0 && (
                  <div className="bg-amber-50 rounded-lg p-3">
                    <p className="font-medium text-amber-800 mb-1">Duplicados</p>
                    {auditoria.duplicados.map((d, i) => (
                      <p key={i} className="text-amber-700">
                        {d.numero_factura} · {d.proveedor || "s/prov"} ({d.veces_cargada}×)
                      </p>
                    ))}
                  </div>
                )}
                {auditoria.sobreprecios.length > 0 && (
                  <div className="bg-red-50 rounded-lg p-3">
                    <p className="font-medium text-red-800 mb-1">Sobreprecios</p>
                    {auditoria.sobreprecios.map((s, i) => (
                      <p key={i} className="text-red-700">
                        {s.insumo}: {s.precio_facturado} vs {s.precio_pactado} Bs (+{s.sobreprecio_pct}%)
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tabla */}
        {cargando ? (
          <div className="flex justify-center py-20 text-gray-400">Cargando...</div>
        ) : facturas.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 flex flex-col items-center text-center">
            <FileText className="h-16 w-16 text-gray-300 mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Sin facturas cargadas</h2>
            <p className="text-gray-500">Escaneá tu primera factura para empezar.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {facturas.map((f) => (
              <div key={f.id} className="border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-4 px-5 py-4">
                  <button
                    onClick={() => setExpandida(expandida === f.id ? null : f.id)}
                    className="text-gray-400 hover:text-gray-700"
                  >
                    {expandida === f.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {f.numero_factura || "(sin número)"} · {f.proveedor?.nombre || "Sin proveedor"}
                    </p>
                    <p className="text-xs text-gray-400">{f.fecha} · {f.total} Bs</p>
                  </div>
                  <Badge className={`border-0 ${estadoBadge[f.estado_conciliacion] || ""}`}>
                    {f.estado_conciliacion.replace("_", " ")}
                  </Badge>
                  {f.es_anomala && (
                    <Badge className="border-0 bg-red-100 text-red-700">
                      ⚠ {f.motivo_anomalia}
                    </Badge>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => borrar(f.id)}>
                    <Trash2 className="w-4 h-4 text-gray-400" />
                  </Button>
                </div>

                {expandida === f.id && (
                  <div className="px-5 pb-5 bg-gray-50/50">
                    {/* Ítems */}
                    <div className="mb-4">
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Ítems</p>
                      <div className="space-y-1">
                        {(f.detalle_factura || []).map((d, i) => (
                          <div key={i} className="text-sm text-gray-700 flex justify-between">
                            <span>{d.insumo_nombre}</span>
                            <span className="text-gray-400">
                              {d.cantidad} × {d.precio_unitario} = {d.subtotal} Bs
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Conciliación (CU40) */}
                    <div className="border-t border-gray-100 pt-4">
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                        Conciliar contra orden de compra
                      </p>
                      <div className="flex flex-wrap gap-2 items-center">
                        <select
                          value={ordenSel[f.id] || ""}
                          onChange={(e) => setOrdenSel((p) => ({ ...p, [f.id]: e.target.value }))}
                          className="h-10 rounded-md border border-gray-200 px-3 text-sm min-w-[220px]"
                        >
                          <option value="">Elegí una orden...</option>
                          {ordenes.map((o) => (
                            <option key={o.id} value={o.id}>
                              Orden #{o.id} · {o.proveedor?.nombre || ""} · {o.total} Bs
                            </option>
                          ))}
                        </select>
                        <Button
                          onClick={() => conciliar(f.id)}
                          disabled={conciliando === f.id}
                          className="rounded-xl"
                        >
                          {conciliando === f.id ? "Conciliando..." : "Conciliar"}
                        </Button>
                      </div>

                      {resultado[f.id] && (
                        <div className="mt-3 bg-white rounded-lg border border-gray-200 p-3">
                          <p className="text-sm text-gray-700 mb-2">{resultado[f.id].resumen}</p>
                          {resultado[f.id].diferencias.length === 0 ? (
                            <p className="text-sm text-green-600">✓ Sin diferencias.</p>
                          ) : (
                            <div className="space-y-1">
                              {resultado[f.id].diferencias.map((d, i) => (
                                <div key={i} className="text-xs flex gap-2">
                                  <Badge className="border-0 bg-amber-100 text-amber-700">{d.tipo}</Badge>
                                  <span className="text-gray-700">{d.insumo}:</span>
                                  <span className="text-gray-500">
                                    esperado {d.esperado} / facturado {d.facturado}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
