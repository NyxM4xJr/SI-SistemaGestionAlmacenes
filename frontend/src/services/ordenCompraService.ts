const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

const getToken = () => localStorage.getItem("access_token");

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

export type EstadoOrden = "generada" | "enviada" | "recibida" | "cancelada";

export interface DetalleOrdenCompra {
  id?: number;
  orden_id?: number;
  insumo_id: number;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  insumo?: { nombre: string };
}

export interface OrdenCompra {
  id: number;
  fecha: string;
  proveedor_id: number;
  estado: EstadoOrden;
  total: number;
  generada_auto: boolean;
  created_at?: string;
  proveedor?: { nombre: string; email?: string };
  detalle_orden_compra?: DetalleOrdenCompra[];
}

export interface ResultadoGeneracion {
  mensaje?: string;
  ordenes: {
    orden_id: number;
    proveedor: string;
    total: number;
    items: number;
    email_enviado: boolean;
    estado: EstadoOrden;
  }[];
  insumos_sin_proveedor: string[];
}

/** GET /api/ordenes-compra/ — Lista de órdenes */
export async function getOrdenesCompra(): Promise<OrdenCompra[]> {
  const res = await fetch(`${API_URL}/ordenes-compra/`, { headers: headers() });
  if (!res.ok) throw new Error("Error al obtener las órdenes de compra.");
  return res.json();
}

/** POST /api/ordenes-compra/generar/ — Genera órdenes automáticas */
export async function generarOrdenesAutomaticas(): Promise<ResultadoGeneracion> {
  const res = await fetch(`${API_URL}/ordenes-compra/generar/`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al generar las órdenes.");
  return data;
}

/** PATCH /api/ordenes-compra/:id/ — Cambiar estado */
export async function updateOrdenCompra(
  id: number,
  estado: EstadoOrden
): Promise<{ id: number; estado: EstadoOrden }> {
  const res = await fetch(`${API_URL}/ordenes-compra/${id}/`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({ estado }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al actualizar la orden.");
  return data;
}

/** DELETE /api/ordenes-compra/:id/ — Eliminar orden */
export async function deleteOrdenCompra(id: number): Promise<{ mensaje: string }> {
  const res = await fetch(`${API_URL}/ordenes-compra/${id}/`, {
    method: "DELETE",
    headers: headers(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al eliminar la orden.");
  return data;
}
