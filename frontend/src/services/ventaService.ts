/**
 * ============================================================
 * ARCHIVO: frontend/src/services/ventaService.ts
 * CASO DE USO: CU35 - Registrar Venta de Platos
 * CICLO: 5
 * FECHA: 03/07/26
 *
 * DESCRIPCIÓN: Servicio para registrar y consultar ventas.
 * El registro de venta descuenta stock en el backend (reutiliza
 * la lógica de descargo CU16). El cobro por pasarela es aparte.
 * ============================================================
 */

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

const getToken = () => localStorage.getItem("access_token");

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

// ── Tipos ────────────────────────────────────────────────────

export type EstadoVenta = "registrada" | "pagada" | "anulada";
export type MetodoPago = "pendiente" | "efectivo" | "stripe" | "paypal";

export interface DetalleVenta {
  id?: number;
  venta_id?: number;
  plato_id: number;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  plato?: { nombre: string };
}

export interface Venta {
  id: number;
  fecha: string;
  usuario_id: string;
  total: number;
  metodo_pago: MetodoPago;
  estado: EstadoVenta;
  pago_id?: number | null;
  created_at?: string;
  detalle_venta?: DetalleVenta[];
}

export interface VentaItemPayload {
  plato_id: number;
  cantidad: number;
  precio_unitario?: number;
}

export interface VentaPayload {
  metodo_pago?: MetodoPago;
  items: VentaItemPayload[];
}

export interface DescargoResumen {
  insumos_descargados: { insumo_id: number; insumo_nombre: string; cantidad: number; valor: number }[];
  insumos_excluidos: { insumo_id: number; insumo_nombre: string; motivo: string }[];
  valor_total_descargado: number;
}

export interface VentaCreada {
  venta: Venta;
  descargo: DescargoResumen;
}

// ── Endpoints ────────────────────────────────────────────────

/** GET /api/ventas/ — Lista de ventas */
export async function getVentas(): Promise<Venta[]> {
  const res = await fetch(`${API_URL}/ventas/`, { headers: headers() });
  if (!res.ok) throw new Error("Error al obtener las ventas.");
  return res.json();
}

/** GET /api/ventas/:id/ — Detalle de una venta */
export async function getVentaById(id: number): Promise<Venta> {
  const res = await fetch(`${API_URL}/ventas/${id}/`, { headers: headers() });
  if (!res.ok) throw new Error("Venta no encontrada.");
  return res.json();
}

/** POST /api/ventas/ — Registrar una venta (descuenta stock) */
export async function createVenta(payload: VentaPayload): Promise<VentaCreada> {
  const res = await fetch(`${API_URL}/ventas/`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al registrar la venta.");
  return data;
}

/** PATCH /api/ventas/:id/ — Actualizar estado / método / pago_id */
export async function updateVenta(
  id: number,
  payload: Partial<Pick<Venta, "estado" | "metodo_pago" | "pago_id">>
): Promise<Venta> {
  const res = await fetch(`${API_URL}/ventas/${id}/`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al actualizar la venta.");
  return data;
}

/** DELETE /api/ventas/:id/ — Eliminar una venta */
export async function deleteVenta(id: number): Promise<{ mensaje: string }> {
  const res = await fetch(`${API_URL}/ventas/${id}/`, {
    method: "DELETE",
    headers: headers(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al eliminar la venta.");
  return data;
}
