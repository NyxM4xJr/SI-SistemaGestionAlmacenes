const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

const getToken = () => localStorage.getItem("access_token");

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

export interface ItemFactura {
  insumo: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export interface FacturaOCRResult {
  numero: string | null;
  fecha: string | null;
  proveedor: string | null;
  total: number | null;
  items: ItemFactura[];
}

export interface DetalleFactura {
  id?: number;
  factura_id?: number;
  insumo_nombre: string;
  insumo_id?: number | null;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export type EstadoConciliacion = "pendiente" | "conciliada" | "con_diferencias";

export interface Factura {
  id: number;
  numero_factura: string | null;
  fecha: string | null;
  proveedor_id: number | null;
  total: number;
  estado_conciliacion: EstadoConciliacion;
  es_anomala: boolean;
  motivo_anomalia: string | null;
  orden_id: number | null;
  imagen_url: string | null;
  created_at?: string;
  proveedor?: { nombre: string; email?: string };
  detalle_factura?: DetalleFactura[];
}

export interface DiferenciaConciliacion {
  insumo: string;
  tipo: "cantidad" | "precio" | "faltante_en_factura" | "sobrante_en_factura";
  esperado: string;
  facturado: string;
}

export interface ResultadoConciliacion {
  estado_conciliacion: EstadoConciliacion;
  coincide: boolean;
  diferencias: DiferenciaConciliacion[];
  resumen: string;
  orden_recibida: boolean;
}

export interface GuardarFacturaPayload {
  numero: string | null;
  fecha: string | null;
  proveedor_id: number | null;
  total: number;
  items: ItemFactura[];
  imagen?: string | null;
}

/** POST /api/facturas/ocr/ — Extrae datos de la imagen (sin guardar). */
export async function extraerFacturaOCR(imagen: string): Promise<FacturaOCRResult> {
  const res = await fetch(`${API_URL}/facturas/ocr/`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ imagen }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al analizar la factura.");
  return data;
}

/** GET /api/facturas/ — Lista de facturas guardadas. */
export async function listarFacturas(): Promise<Factura[]> {
  const res = await fetch(`${API_URL}/facturas/`, { headers: headers() });
  if (!res.ok) throw new Error("Error al obtener las facturas.");
  return res.json();
}

/** POST /api/facturas/ — Guarda una factura revisada. */
export async function registrarFactura(payload: GuardarFacturaPayload): Promise<Factura> {
  const res = await fetch(`${API_URL}/facturas/`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al guardar la factura.");
  return data;
}

/** GET /api/facturas/:id/ — Detalle de una factura. */
export async function getFactura(id: number): Promise<Factura> {
  const res = await fetch(`${API_URL}/facturas/${id}/`, { headers: headers() });
  if (!res.ok) throw new Error("Error al obtener la factura.");
  return res.json();
}

/** DELETE /api/facturas/:id/ — Elimina una factura. */
export async function eliminarFactura(id: number): Promise<{ mensaje: string }> {
  const res = await fetch(`${API_URL}/facturas/${id}/`, {
    method: "DELETE",
    headers: headers(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al eliminar la factura.");
  return data;
}

/** POST /api/facturas/:id/conciliar/ — Concilia contra una orden de compra. */
export async function conciliarFactura(
  facturaId: number,
  ordenId: number
): Promise<ResultadoConciliacion> {
  const res = await fetch(`${API_URL}/facturas/${facturaId}/conciliar/`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ orden_id: ordenId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al conciliar la factura.");
  return data;
}
