/**
 * ============================================================
 * ARCHIVO: frontend/src/services/caducidadService.ts
 * CASO DE USO: CU34 - Gestión de Caducidad FEFO (informativo)
 * CICLO: 5
 * FECHA: 03/07/26
 *
 * DESCRIPCIÓN: Servicio para consultar los detalles de lote
 * ordenados por fecha de vencimiento (FEFO). El registro de
 * merma por vencimiento reutiliza movimientoService (CU14).
 * ============================================================
 */

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

const getToken = () => localStorage.getItem("access_token");

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

// ── Tipos ────────────────────────────────────────────────────

export type EstadoCaducidad = "vencido" | "por_vencer" | "ok";

export interface ItemCaducidad {
  id: number;
  lote_id: number;
  insumo_id: number;
  stock_id: number;
  cantidad: number;
  costo_unitario: number;
  fecha_vencimiento: string | null;
  fecha_ing: string | null;
  insumo_nombre: string | null;
  estado: EstadoCaducidad;
  dias_restantes: number | null;
}

export interface CaducidadResponse {
  dias_ventana: number;
  total: number;
  vencidos: number;
  por_vencer: number;
  items: ItemCaducidad[];
}

// ── Endpoints ────────────────────────────────────────────────

/** GET /api/caducidad/ — Detalles de lote ordenados FEFO */
export async function getCaducidad(dias?: number): Promise<CaducidadResponse> {
  const qs = dias !== undefined ? `?dias=${dias}` : "";
  const res = await fetch(`${API_URL}/caducidad/${qs}`, { headers: headers() });
  if (!res.ok) throw new Error("Error al obtener la información de caducidad.");
  return res.json();
}
