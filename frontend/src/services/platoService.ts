/**
 * ============================================================
 * ARCHIVO: frontend/src/services/platoService.ts
 * CASO DE USO: CU20 - Gestionar Platos del Menú
 * CICLO: 3
 * AUTOR: Karen Ortega
 * FECHA: 01/06/26
 *
 * DESCRIPCIÓN: Servicio de comunicación con la API REST
 * para el CRUD de platos del menú gastronómico.
 * Sigue el patrón exacto de insumoService.ts.
 * ============================================================
 */

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

const getToken = () => localStorage.getItem("access_token");

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

// ── Tipos ────────────────────────────────────────────────────

export interface Plato {
  id: number;
  nombre: string;
  descripcion: string;
  costo: number;
}

export interface PlatoPayload {
  nombre: string;
  descripcion: string;
  costo: number;
}

// ── Endpoints ────────────────────────────────────────────────

/** GET /api/platos/ — Lista todos los platos */
export async function getPlatos(): Promise<Plato[]> {
  const res = await fetch(`${API_URL}/platos/`, { headers: headers() });
  if (!res.ok) throw new Error("Error al obtener los platos.");
  return res.json();
}

/** GET /api/platos/:id/ — Detalle de un plato */
export async function getPlatoById(id: number): Promise<Plato> {
  const res = await fetch(`${API_URL}/platos/${id}/`, { headers: headers() });
  if (!res.ok) throw new Error("Plato no encontrado.");
  return res.json();
}

/** POST /api/platos/ — Crear un nuevo plato */
export async function createPlato(payload: PlatoPayload): Promise<Plato> {
  const res = await fetch(`${API_URL}/platos/`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al crear el plato.");
  return data;
}

/** PATCH /api/platos/:id/ — Editar un plato */
export async function updatePlato(
  id: number,
  payload: Partial<PlatoPayload>
): Promise<Plato> {
  const res = await fetch(`${API_URL}/platos/${id}/`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al actualizar el plato.");
  return data;
}

/** DELETE /api/platos/:id/ — Eliminar un plato */
export async function deletePlato(id: number): Promise<{ mensaje: string }> {
  const res = await fetch(`${API_URL}/platos/${id}/`, {
    method: "DELETE",
    headers: headers(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al eliminar el plato.");
  return data;
}