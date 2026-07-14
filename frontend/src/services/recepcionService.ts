/**
 * ============================================================
 * ARCHIVO: frontend/src/services/recepcionService.ts
 * CASO DE USO: CU42 - Recepción de Lote Asistida por IA
 * CICLO: 6
 *
 * DESCRIPCIÓN: Envía la foto del remito/factura de entrega al backend
 * para que la IA de visión extraiga todos los ítems (insumo, cantidad,
 * costo, vencimiento) y precargar el formulario de alta de lote.
 * ============================================================
 */

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

const getToken = () => localStorage.getItem("access_token");

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

export interface ItemRemito {
  insumo: string;
  insumo_id: number | null;
  cantidad: number | null;
  costo_unitario: number | null;
  fecha_vencimiento: string | null;
}

export interface RemitoResult {
  items: ItemRemito[];
}

/** POST /api/lotes/recepcion-remito/ — Extrae los ítems del remito (sin guardar). */
export async function importarRemito(imagen: string): Promise<RemitoResult> {
  const res = await fetch(`${API_URL}/lotes/recepcion-remito/`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ imagen }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al leer el remito.");
  return data;
}
