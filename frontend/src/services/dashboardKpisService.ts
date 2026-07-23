const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

const getToken = () => localStorage.getItem("access_token");

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

export interface KpiNumerico {
  valor: number | null;
  total_eventos?: number;
  total_platos?: number;
  total_insumos_considerados?: number;
  valor_mes_anterior?: number;
  error?: string;
}

export interface ItemTendencia {
  periodo: string;
  valor_perdido: number;
}

export interface DashboardKpisResponse {
  valor_perdido_acumulado: KpiNumerico;
  margen_promedio: KpiNumerico;
  rotacion_inventario: KpiNumerico;
  proximos_a_vencer: KpiNumerico;
  stock_bajo: KpiNumerico;
  tendencia_valor_perdido: ItemTendencia[];
}

/** GET /api/dashboard/kpis/ — KPIs consolidados en JSON */
export async function getDashboardKpis(): Promise<DashboardKpisResponse> {
  const res = await fetch(`${API_URL}/dashboard/kpis/`, {
    headers: headers(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al obtener los KPIs del dashboard.");
  return data;
}