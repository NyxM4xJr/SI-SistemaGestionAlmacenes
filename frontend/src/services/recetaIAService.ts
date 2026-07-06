/**
 * ============================================================
 * ARCHIVO: frontend/src/services/recetaIAService.ts
 * CASO DE USO: CU38 - Generación de Recetas con IA
 * CICLO: 5
 *
 * DESCRIPCIÓN: Servicio de comunicación con el endpoint de
 * generación de recetas con la IA, priorizando insumos por
 * vencer y con alta merma técnica.
 * ============================================================
 */

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

const getToken = () => localStorage.getItem("access_token");

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

export interface InsumoCandidato {
  insumo: string;
  categoria: string;
  dias_restantes: number;
  porcentaje_merma: number;
}

export interface IngredienteSugerido {
  insumo: string;
  cantidad_aproximada: string;
}

export interface PlatoSugeridoIA {
  nombre: string;
  categoria: string;
  descripcion: string;
  ingredientes: IngredienteSugerido[];
  justificacion: string;
}

export interface RecetaIAResponse {
  insumos_considerados: InsumoCandidato[];
  platos_sugeridos: PlatoSugeridoIA[];
  mensaje?: string;
}

/** GET /api/recetas-ia/generar/ — sugerencias de recetas generadas por la IA */
export async function generarRecetasIA(): Promise<RecetaIAResponse> {
  const res = await fetch(`${API_URL}/recetas-ia/generar/`, {
    headers: headers(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al generar las sugerencias de recetas.");
  return data;
}
