/**
 * ============================================================
 * ARCHIVO: frontend/src/services/cierreTurnoService.ts
 * CASO DE USO: CU15 - Validar Cierre de Turno
 * CICLO: 4
 * AUTOR: Karen
 * FECHA: 19/06/26
 *
 * DESCRIPCIÓN: Servicio de comunicación con la API REST
 * para el cierre de turno. No existe tabla TURNO ni tabla
 * de ventas: las unidades vendidas por plato se mandan en
 * el query string del GET y no se persisten en ninguna tabla.
 * Sigue el patrón exacto de platoService.ts / movimientoService.ts.
 * ============================================================
 */

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

const getToken = () => localStorage.getItem("access_token");

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

// ── Tipos ────────────────────────────────────────────────────

export interface VentaPlato {
  plato_id: number;
  plato_nombre: string;
  unidades: number;
}

export interface ItemComparativa {
  insumo_id: number;
  insumo_nombre: string;
  consumo_teorico: number;
  consumo_real: number;
  diferencia: number;
  porcentaje_diferencia: number;
}

export interface PlatoSinReceta {
  plato_id: number;
  plato_nombre: string;
}

export interface ComparativaResponse {
  hora_desde: string;
  hora_hasta: string;
  comparativa: ItemComparativa[];
  platos_sin_receta: PlatoSinReceta[];
}

export interface ValidarCierrePayload {
  hora_desde: string;
  hora_hasta: string;
  comparativa: ItemComparativa[];
  observacion?: string;
}

// ── Endpoints ────────────────────────────────────────────────

/** GET /api/cierre-turno/ — Calcula comparativa teórico vs real */
export async function calcularComparativa(
  horaDesde: string,
  horaHasta: string,
  ventas: VentaPlato[]
): Promise<ComparativaResponse> {
  const ventasFiltradas = ventas.filter((v) => v.unidades > 0);

  const params = new URLSearchParams({
    hora_desde: horaDesde,
    hora_hasta: horaHasta,
    ventas: JSON.stringify(
      ventasFiltradas.map((v) => ({ plato_id: v.plato_id, unidades: v.unidades }))
    ),
  });

  const res = await fetch(`${API_URL}/cierre-turno/?${params.toString()}`, {
    headers: headers(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al calcular la comparativa.");
  return data;
}

/** POST /api/cierre-turno/validar/ — Registra la validación en bitácora */
export async function validarCierreTurno(
  payload: ValidarCierrePayload
): Promise<{ message: string }> {
  const res = await fetch(`${API_URL}/cierre-turno/validar/`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al validar el cierre de turno.");
  return data;
}