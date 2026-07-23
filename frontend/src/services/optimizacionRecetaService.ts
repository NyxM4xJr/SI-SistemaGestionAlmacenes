const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

const getToken = () => localStorage.getItem("access_token");

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

export type TipoSustitucion = "proveedor" | "insumo";

export interface Sustitucion {
  tipo: TipoSustitucion;
  insumo_original: string;
  insumo_sugerido: string;
  proveedor_sugerido: string | null;
  costo_original: number;
  costo_sugerido: number;
  ahorro_unitario: number;
  ahorro_plato: number;
  motivo: string;
}

export interface OptimizacionRecetaResponse {
  plato: { id: number; nombre: string };
  costo_actual: number;
  margen_actual: number | null;
  sustituciones: Sustitucion[];
  costo_proyectado: number;
  margen_proyectado: number | null;
  ahorro_total: number;
  ahorro_porcentaje: number;
  resumen: string;
}

/** GET /api/recetas-ia/optimizar/?plato_id=N — sugiere cambio de proveedor o sustitución de insumo para abaratar la receta */
export async function optimizarReceta(platoId: number): Promise<OptimizacionRecetaResponse> {
  const res = await fetch(`${API_URL}/recetas-ia/optimizar/?plato_id=${platoId}`, {
    headers: headers(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al optimizar la receta.");
  return data;
}
