/**
 * ============================================================
 * ARCHIVO: frontend/src/services/recetaService.ts
 * CASO DE USO: CU21 - Gestionar Recetas
 * CICLO: 3
 * AUTOR: Karen Ortega
 * FECHA: 01/06/26
 * ============================================================
 */

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";
const getToken = () => localStorage.getItem("access_token");
const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

// ── Tipos ─────────────────────────────────────────────────────

export interface DetalleReceta {
  id?: number;
  insumo_id: number;
  cantidad: number;
  unidad_id: number;
  insumo?: { id: number; nombre: string; categoria?: string };
  unidad_medida?: { id: number; unidad: string };
}

export interface Receta {
  id: number;
  cantidad: number | null;
  descripcion: string;
  plato_id: number;
  plato?: { id: number; nombre: string };
  detalles?: DetalleReceta[];
  cantidad_ingredientes?: number;
}

export interface RecetaPayload {
  plato_id: number;
  descripcion: string;
  cantidad: number | null;
  detalles: Omit<DetalleReceta, "id" | "insumo" | "unidad_medida">[];
}

export interface Catalogos {
  platos:   { id: number; nombre: string }[];
  insumos:  { id: number; nombre: string; categoria?: string }[];
  unidades: { id: number; unidad: string }[];
}

// ── Endpoints ─────────────────────────────────────────────────

/** GET /api/recetas/catalogos/ — Platos, insumos y unidades para los selects */
export async function getCatalogos(): Promise<Catalogos> {
  const res = await fetch(`${API_URL}/recetas/catalogos/`, { headers: headers() });
  if (!res.ok) throw new Error("Error al obtener los catálogos.");
  return res.json();
}

/** GET /api/recetas/ — Lista todas las recetas */
export async function getRecetas(): Promise<Receta[]> {
  const res = await fetch(`${API_URL}/recetas/`, { headers: headers() });
  if (!res.ok) throw new Error("Error al obtener las recetas.");
  return res.json();
}

/** GET /api/recetas/:id/ — Detalle de una receta con sus ingredientes */
export async function getRecetaById(id: number): Promise<Receta> {
  const res = await fetch(`${API_URL}/recetas/${id}/`, { headers: headers() });
  if (!res.ok) throw new Error("Receta no encontrada.");
  return res.json();
}

/** POST /api/recetas/ — Crear receta con detalles */
export async function createReceta(payload: RecetaPayload): Promise<Receta> {
  const res = await fetch(`${API_URL}/recetas/`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al crear la receta.");
  return data;
}

/** PATCH /api/recetas/:id/ — Editar receta */
export async function updateReceta(
  id: number,
  payload: Partial<RecetaPayload>
): Promise<Receta> {
  const res = await fetch(`${API_URL}/recetas/${id}/`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al actualizar la receta.");
  return data;
}

/** DELETE /api/recetas/:id/ — Eliminar receta */
export async function deleteReceta(id: number): Promise<{ mensaje: string }> {
  const res = await fetch(`${API_URL}/recetas/${id}/`, {
    method: "DELETE",
    headers: headers(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al eliminar la receta.");
  return data;
}