/**
 * ============================================================
 * ARCHIVO: frontend/src/services/pronosticoService.ts
 * CASO DE USO: CU44 - Pronóstico de Demanda
 * CICLO: 6
 * ============================================================
 */

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

const getToken = () => localStorage.getItem("access_token");

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

export interface ItemPronostico {
  insumo_id: number;
  insumo: string;
  consumo_total_periodo: number;
  consumo_diario_promedio: number;
  stock_actual: number;
  dias_cobertura: number | null;
  cantidad_sugerida: number;
  urgente: boolean;
}

export interface PronosticoResponse {
  pronostico: ItemPronostico[];
  resumen: string;
  detalle: string;
  dias_analizados: number;
  generado_en: string;
}

/** GET /api/reportes/pronostico/?dias=N — Pronóstico de demanda con IA. */
export async function getPronosticoDemanda(dias = 30): Promise<PronosticoResponse> {
  const res = await fetch(`${API_URL}/reportes/pronostico/?dias=${dias}`, {
    headers: headers(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al generar el pronóstico.");
  return data;
}
