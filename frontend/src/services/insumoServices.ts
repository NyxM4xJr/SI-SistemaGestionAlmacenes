/**
 * ============================================================
 * ARCHIVO: frontend/src/services/insumoService.ts
 * CASO DE USO: CU07 - Gestionar Insumos
 *              CU22 - Configurar Porcentaje de Merma Técnica
 * CICLO: 2 / 3
 * FECHA: 01/06/26
 * AUTOR: Karen Ortega Mancilla
 * CAMBIO CU22: Agrega porcentaje_merma a FichaTecnica e Insumo
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
  porcentaje_merma?: number; // CU22 — se envía al PATCH, backend lo guarda en ficha_tecnica
}

const getToken = () => localStorage.getItem("access_token");

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

export interface HistorialPrecio {
  id: number;
  insumo_id: number;
  tipo_temporada: string;
  mes: number;
  precio_prom: number;
  comentarios: string;
}

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

  getHistorialPrecios: async (id: number): Promise<HistorialPrecio[]> => {
    const res = await fetch(`${API_URL}/insumos/${id}/historial-precios/`, {
      headers: headers(),
    });
    if (!res.ok) throw new Error("Error al cargar el historial de precios");
    return res.json();
  },

  updateEstacionalidad: async (id: number, meses: Partial<HistorialPrecio>[]): Promise<void> => {
    const res = await fetch(`${API_URL}/insumos/${id}/estacionalidad/`, {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify({ meses }),
    });
    if (!res.ok) throw new Error("Error al actualizar la estacionalidad");
  },
};

/**
 * ============================================================
 * CU08 - Consultar Ficha Técnica Digital
 * Agregado: 11/05/26
 * ============================================================
 */

export interface FichaTecnica {
  id?: number;
  temperatura: string;
  madurez: string;
  caracteristicas: string;
  referencias: string;
  insumo_id: number;
  porcentaje_merma?: number | null; // CU22 — puede ser null si no fue configurado
}

export interface InsumoConFicha {
  insumo: Insumo;
  ficha_tecnica: FichaTecnica | null;
}

export const fichaTecnicaService = {
  getById: async (insumoId: number): Promise<InsumoConFicha> => {
    const res = await fetch(`${API_URL}/insumos/${insumoId}/ficha-tecnica/`, {
      headers: headers(),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Error al obtener ficha técnica");
    }
    return res.json();
  },
};