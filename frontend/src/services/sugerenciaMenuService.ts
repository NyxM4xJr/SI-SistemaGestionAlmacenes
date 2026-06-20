/**
 * ============================================================
 * ARCHIVO: frontend/src/services/sugerenciaMenuService.ts
 * CASO DE USO: CU24 - Consultar Sugerencia de Menú por Temporada
 * CICLO: 4
 * AUTOR: Karen Ortega
 * FECHA: 19/06/26
 *
 * DESCRIPCIÓN: Servicio de comunicación con la API REST para
 * la sugerencia de menú por temporada. "Agregar a Menú" NO
 * tiene endpoint propio: reutiliza MenuService.addPlato() ya
 * existente de CU23 (ver menuService.ts).
 * Sigue el patrón exacto de platoService.ts / cierreTurnoService.ts.
 * ============================================================
 */

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

const getToken = () => localStorage.getItem("access_token");

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

// ── Tipos ────────────────────────────────────────────────────

export type Temporada = "verano" | "otono" | "invierno" | "primavera";

export interface PlatoSugerido {
  plato_id: number;
  plato_nombre: string;
  en_temporada: boolean;
  proximo_vencer: boolean;
  costo_estimado: number;
  costo_normal: number;
  ahorro: number;
  insumos_en_temporada: string[];
  insumos_por_vencer: string[];
}

export interface SugerenciaMenuResponse {
  temporada: Temporada;
  sin_datos_temporada: boolean;
  platos_sugeridos: PlatoSugerido[];
}

// ── Endpoints ────────────────────────────────────────────────

/** GET /api/sugerir-menu/ — Platos sugeridos para la temporada indicada */
export async function getSugerenciaMenu(
  temporada?: Temporada
): Promise<SugerenciaMenuResponse> {
  const params = temporada ? `?temporada=${temporada}` : "";
  const res = await fetch(`${API_URL}/sugerir-menu/${params}`, {
    headers: headers(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al obtener la sugerencia de menú.");
  return data;
}