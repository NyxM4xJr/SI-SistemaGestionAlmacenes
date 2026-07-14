/**
 * ============================================================
 * ARCHIVO: frontend/src/services/etiquetaService.ts
 * CASO DE USO: CU42 - Escaneo de Etiqueta → Lote
 * CICLO: 6
 *
 * DESCRIPCIÓN: Envía la foto de la etiqueta al backend para que la
 * IA de visión extraiga fecha de vencimiento y número de lote, y así
 * precargar el formulario de alta de lote.
 * ============================================================
 */

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

const getToken = () => localStorage.getItem("access_token");

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

export interface EtiquetaEscaneada {
  fecha_vencimiento: string | null;
  numero_lote: string | null;
  producto: string | null;
}

/** POST /api/etiquetas/escanear/ — Extrae datos de la etiqueta (sin guardar). */
export async function escanearEtiqueta(imagen: string): Promise<EtiquetaEscaneada> {
  const res = await fetch(`${API_URL}/etiquetas/escanear/`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ imagen }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al escanear la etiqueta.");
  return data;
}
