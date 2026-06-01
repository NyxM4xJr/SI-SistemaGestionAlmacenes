/**
 * ============================================================
 * ARCHIVO: frontend/src/services/alertaService.ts
 * CASO DE USO: CU13 - Gestionar Alertas
 * CICLO: 3
 * AUTOR: Mateo Hurtado
 * FECHA: 01/06/26
 *
 * DESCRIPCIÓN: Servicio de comunicación con la API REST
 * para consultar y gestionar alertas de stock.
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

export interface Alerta {
  id: number;
  stock_id: number;
  fecha: string;
  mensaje: string;
  leida: boolean;
  stock?: {
    id: number;
    cantidad: number;
    stock_min: number;
    insumo?: { nombre: string };
  };
}

export interface AlertaConteo {
  conteo: number;
}

export interface AlertaFiltros {
  leida?: boolean;
  stock_id?: number;
}

// ── Endpoints ────────────────────────────────────────────────

/** GET /api/alertas/ — Lista alertas con filtros opcionales */
export async function getAlertas(filtros?: AlertaFiltros): Promise<Alerta[]> {
  const params = new URLSearchParams();
  if (filtros?.leida !== undefined) params.append("leida", String(filtros.leida));
  if (filtros?.stock_id)            params.append("stock_id", String(filtros.stock_id));

  const qs  = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${API_URL}/alertas/${qs}`, { headers: headers() });
  if (!res.ok) throw new Error("Error al obtener las alertas.");
  return res.json();
}

/** GET /api/alertas/conteo/ — Conteo de alertas no leídas (para badge) */
export async function getAlertasConteo(): Promise<number> {
  const res = await fetch(`${API_URL}/alertas/conteo/`, { headers: headers() });
  if (!res.ok) return 0;
  const data: AlertaConteo = await res.json();
  return data.conteo ?? 0;
}

/** PATCH /api/alertas/:id/ — Marcar alerta como leída */
export async function marcarAlertaLeida(
  id: number
): Promise<{ id: number; leida: boolean; nuevo_conteo: number }> {
  const res = await fetch(`${API_URL}/alertas/${id}/`, {
    method: "PATCH",
    headers: headers(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al marcar la alerta.");
  return data;
}