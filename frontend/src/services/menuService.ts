const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

export interface DetalleMenu {
  id: number;
  precio_venta: number;
  categoria: string;
  menu_id: number;
  plato_id: number;
  plato?: {
    nombre: string;
    costo: number;
  };
}

export interface Menu {
  id?: number;
  nombre: string;
  temporada: string;
  descripcion: string;
  detalle_menu?: DetalleMenu[];
}

const getToken = () => localStorage.getItem("access_token");

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

export const MenuService = {
  getAll: async (): Promise<Menu[]> => {
    const res = await fetch(`${API_URL}/menus/`, { headers: headers() });
    if (!res.ok) throw new Error("Error al cargar menús");
    return res.json();
  },

  getById: async (id: number): Promise<Menu> => {
    const res = await fetch(`${API_URL}/menus/${id}/`, { headers: headers() });
    if (!res.ok) throw new Error("Menú no encontrado");
    return res.json();
  },

  create: async (data: Partial<Menu>): Promise<Menu> => {
    const res = await fetch(`${API_URL}/menus/`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Error al crear el menú");
    }
    return res.json();
  },

  update: async (id: number, data: Partial<Menu>): Promise<Menu> => {
    const res = await fetch(`${API_URL}/menus/${id}/`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Error al actualizar el menú");
    }
    return res.json();
  },

  delete: async (id: number): Promise<void> => {
    const res = await fetch(`${API_URL}/menus/${id}/`, {
      method: "DELETE",
      headers: headers(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Error al eliminar el menú");
    }
  },

  // Gestión de platos en el menú
  addPlato: async (menuId: number, data: Partial<DetalleMenu>): Promise<DetalleMenu> => {
    const res = await fetch(`${API_URL}/menus/${menuId}/platos/`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Error al añadir el plato");
    }
    return res.json();
  },

  removePlato: async (menuId: number, detalleId: number): Promise<void> => {
    const res = await fetch(`${API_URL}/menus/${menuId}/platos/${detalleId}/`, {
      method: "DELETE",
      headers: headers(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Error al remover el plato");
    }
  },
};
