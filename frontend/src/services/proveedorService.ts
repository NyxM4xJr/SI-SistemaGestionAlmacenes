/**
 * ============================================================
 * ARCHIVO: frontend/src/services/proveedorService.ts
 * CASO DE USO: CU17 - Gestionar Proveedores
 * CICLO: 2
 * DESCRIPCIÓN: Servicio de comunicación con la API de proveedores.
 *   Contiene las interfaces de TypeScript (Proveedor, ProveedorInsumo)
 *   y las funciones para consumir los endpoints REST.
 * ============================================================
 */

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

export interface ProveedorInsumo {
  id: number;
  precio: number;
  fecha: string;
  calificacion: string;
  nota: string;
  proveedor_id: number;
  insumo_id: number;
  insumo?: {
    nombre: string;
  };
}

export interface Proveedor {
  id: number;
  nombre: string;
  contacto: string;
  email: string;
  ubicacion: string;
  tipo_pago: string;
  proveedor_insumo?: ProveedorInsumo[];
}

const getToken = () => localStorage.getItem("access_token");

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

export const ProveedorService = {
  getAll: async (): Promise<Proveedor[]> => {
    const res = await fetch(`${API_URL}/proveedores/`, {
      headers: headers(),
    });
    if (!res.ok) {
      throw new Error("Error al cargar proveedores");
    }
    return res.json();
  },

  getById: async (id: number): Promise<Proveedor> => {
    const res = await fetch(`${API_URL}/proveedores/${id}/`, {
      headers: headers(),
    });
    if (!res.ok) {
      throw new Error("Proveedor no encontrado");
    }
    return res.json();
  },

  create: async (data: Partial<Proveedor>): Promise<Proveedor> => {
    const res = await fetch(`${API_URL}/proveedores/`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      throw new Error("Error al crear proveedor");
    }
    return res.json();
  },

  update: async (id: number, data: Partial<Proveedor>): Promise<Proveedor> => {
    const res = await fetch(`${API_URL}/proveedores/${id}/`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      throw new Error("Error al actualizar proveedor");
    }
    return res.json();
  },

  delete: async (id: number): Promise<void> => {
    const res = await fetch(`${API_URL}/proveedores/${id}/`, {
      method: "DELETE",
      headers: headers(),
    });
    if (!res.ok) {
      throw new Error("Error al eliminar proveedor");
    }
  },

  asociarInsumo: async (proveedorId: number, data: Partial<ProveedorInsumo>): Promise<ProveedorInsumo> => {
    const res = await fetch(`${API_URL}/proveedores/${proveedorId}/insumos/`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      throw new Error("Error al asociar el insumo al proveedor");
    }
    return res.json();
  },

  desasociarInsumo: async (proveedorId: number, insumoId: number): Promise<void> => {
    const res = await fetch(`${API_URL}/proveedores/${proveedorId}/insumos/${insumoId}/`, {
      method: "DELETE",
      headers: headers(),
    });
    if (!res.ok) {
      throw new Error("Error al eliminar la asociación");
    }
  },
};
