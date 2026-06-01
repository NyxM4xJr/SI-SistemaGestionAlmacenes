/**
 * ============================================================
 * ARCHIVO: frontend/src/services/movimientoService.ts
 * CASO DE USO: CU14 - Registrar Movimiento de Inventario
 * CICLO: 3
 * AUTOR: Mateo Hurtado
 * FECHA: 01/06/26
 *
 * DESCRIPCIÓN: Servicio de comunicación con la API REST
 * para registrar y consultar movimientos de inventario.
 * Sigue el patrón exacto de platoService.ts.
 * ============================================================
 */

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

const getToken = () => localStorage.getItem("access_token");

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

// ── Tipos ────────────────────────────────────────────────────

export type TipoMovimiento = "ingreso" | "salida" | "merma" | "sobrerecuperada";

export interface Movimiento {
  id: number;
  tipo: TipoMovimiento;
  insumo_id: number;
  stock_id: number;
  cantidad: number;
  fecha_mov: string;
  usuario_id: string;
  observacion?: string;
  // ingreso
  origen?: string;
  costo_unitario?: number;
  fecha_vencimiento?: string;
  // salida
  destino?: string;
  // merma
  causa?: string;
  valor_perdido?: number;
  porcentaje_perdida?: number;
  // sobrerecuperada
  procedencia?: string;
  // campos calculados del JOIN
  created_at?: string;
  insumo?: { nombre: string; categoria?: string };
  stock?: { cantidad: number; stock_min: number };
}

export interface MovimientoFiltros {
  tipo?: TipoMovimiento | "";
  fecha_desde?: string;
  fecha_hasta?: string;
  insumo_id?: number | "";
}

export interface MovimientoPayload {
  tipo: TipoMovimiento;
  insumo_id: number;
  stock_id: number;
  cantidad: number;
  fecha_mov?: string;
  observacion?: string;
  // ingreso
  origen?: string;
  costo_unitario?: number;
  fecha_vencimiento?: string;
  // salida
  destino?: string;
  // merma
  causa?: string;
  valor_perdido?: number;
  porcentaje_perdida?: number;
  // sobrerecuperada
  procedencia?: string;
}

// ── Endpoints ────────────────────────────────────────────────

/** GET /api/movimientos/ — Lista movimientos con filtros opcionales */
export async function getMovimientos(
  filtros?: MovimientoFiltros
): Promise<Movimiento[]> {
  const params = new URLSearchParams();
  if (filtros?.tipo)        params.append("tipo", filtros.tipo);
  if (filtros?.fecha_desde) params.append("fecha_desde", filtros.fecha_desde);
  if (filtros?.fecha_hasta) params.append("fecha_hasta", filtros.fecha_hasta);
  if (filtros?.insumo_id)   params.append("insumo_id", String(filtros.insumo_id));

  const qs = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${API_URL}/movimientos/${qs}`, { headers: headers() });
  if (!res.ok) throw new Error("Error al obtener los movimientos.");
  return res.json();
}

/** GET /api/movimientos/:id/ — Detalle de un movimiento */
export async function getMovimientoById(id: number): Promise<Movimiento> {
  const res = await fetch(`${API_URL}/movimientos/${id}/`, { headers: headers() });
  if (!res.ok) throw new Error("Movimiento no encontrado.");
  return res.json();
}

/** POST /api/movimientos/ — Registrar un nuevo movimiento */
export async function createMovimiento(
  payload: MovimientoPayload
): Promise<Movimiento> {
  const res = await fetch(`${API_URL}/movimientos/`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al registrar el movimiento.");
  return data;
}