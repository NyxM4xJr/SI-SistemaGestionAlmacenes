/**
 * ============================================================
 * ARCHIVO: frontend/src/services/insumoService.ts
 * CASO DE USO: CU07 - Gestionar Insumos
 * CICLO: 2
 * FECHA: 09/05/26
 * AUTOR: Karen Ortega Mancilla
 * DESCRIPCIÓN: Servicio de comunicación con la API de insumos.
 *   - getAll(): Lista todos los insumos
 *   - getById(id): Obtiene un insumo por ID
 *   - create(data): Crea un nuevo insumo
 *   - update(id, data): Actualiza un insumo existente
 *   - delete(id): Elimina un insumo
 * ============================================================
 */

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

export interface Insumo {
  id?: number;
  nombre: string;
  categoria: string;
  origen: string;
  conservado: string;
  vencimiento_dias: number;
  proteinas: number;
  calorias: number;
  grasas: number;
  calcio: number;
  hierro: number;
}

const getToken = () => localStorage.getItem("access_token");

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

export const insumoService = {
  getAll: async (): Promise<Insumo[]> => {
    const res = await fetch(`${API_URL}/insumos/`, { headers: headers() });
    if (!res.ok) throw new Error("Error al cargar insumos");
    return res.json();
  },

  getById: async (id: number): Promise<Insumo> => {
    const res = await fetch(`${API_URL}/insumos/${id}/`, { headers: headers() });
    if (!res.ok) throw new Error("Insumo no encontrado");
    return res.json();
  },

  create: async (data: Insumo): Promise<Insumo> => {
    const res = await fetch(`${API_URL}/insumos/`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Error al crear insumo");
    }
    return res.json();
  },

  update: async (id: number, data: Partial<Insumo>): Promise<Insumo> => {
    const res = await fetch(`${API_URL}/insumos/${id}/`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Error al actualizar insumo");
    return res.json();
  },

  delete: async (id: number): Promise<void> => {
    const res = await fetch(`${API_URL}/insumos/${id}/`, {
      method: "DELETE",
      headers: headers(),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || "Error al eliminar insumo");
    }
  },
};