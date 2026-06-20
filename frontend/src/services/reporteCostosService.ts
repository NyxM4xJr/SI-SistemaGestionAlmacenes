/**
 * ============================================================
 * ARCHIVO: frontend/src/services/reporteCostosService.ts
 * CASO DE USO: CU27 - Generar Reporte de Costos por Plato
 * CICLO: 4
 * AUTOR: Karen Ortega
 * FECHA: 19/06/26
 *
 * DESCRIPCIÓN: Servicio de comunicación con la API REST para
 * el reporte de costos. Las descargas de PDF y Excel se manejan
 * como blobs (no JSON) y se disparan con un link temporal.
 * Sigue el patrón exacto de platoService.ts / recetaService.ts.
 * ============================================================
 */

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

const getToken = () => localStorage.getItem("access_token");

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

// ── Tipos ────────────────────────────────────────────────────

export interface ItemReporteCostos {
  plato_id: number;
  plato_nombre: string;
  costo_teorico: number;
  costo_real: number;
  precio_venta: number | null;
  margen: number | null;
  costos_incompletos: boolean;
}

export interface ReporteCostosResponse {
  reporte: ItemReporteCostos[];
  plato_mas_rentable: ItemReporteCostos | null;
  plato_menos_rentable: ItemReporteCostos | null;
}

// ── Endpoints ────────────────────────────────────────────────

/** GET /api/reportes/costos-plato/ — Reporte en JSON */
export async function getReporteCostos(
  platoId?: number
): Promise<ReporteCostosResponse> {
  const params = platoId ? `?plato_id=${platoId}` : "";
  const res = await fetch(`${API_URL}/reportes/costos-plato/${params}`, {
    headers: headers(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al obtener el reporte de costos.");
  return data;
}

/** Dispara la descarga de un blob en el navegador con el nombre indicado */
function descargarBlob(blob: Blob, nombreArchivo: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nombreArchivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

/** GET /api/reportes/costos-plato/pdf/ — Descarga el reporte en PDF */
export async function descargarReportePDF(platoId?: number): Promise<void> {
  const params = platoId ? `?plato_id=${platoId}` : "";
  const res = await fetch(`${API_URL}/reportes/costos-plato/pdf/${params}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error("Error al generar el PDF del reporte.");
  const blob = await res.blob();
  descargarBlob(blob, "reporte_costos_plato.pdf");
}

/** GET /api/reportes/costos-plato/excel/ — Descarga el reporte en Excel */
export async function descargarReporteExcel(platoId?: number): Promise<void> {
  const params = platoId ? `?plato_id=${platoId}` : "";
  const res = await fetch(`${API_URL}/reportes/costos-plato/excel/${params}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error("Error al generar el Excel del reporte.");
  const blob = await res.blob();
  descargarBlob(blob, "reporte_costos_plato.xlsx");
}