/**
 * ============================================================
 * ARCHIVO: frontend/src/services/reporteValorPerdidoService.ts
 * CASO DE USO: CU25 - Generar Reporte de Valor Perdido
 * CICLO: 4
 * AUTOR: Mateo Hurtado
 * FECHA: 21/06/26
 *
 * DESCRIPCIÓN: Servicio de comunicación con la API REST para
 * el reporte de valor perdido. Las descargas de PDF y Excel se
 * manejan como blobs (no JSON) y se disparan con un link temporal.
 * Sigue el patrón exacto de reporteCostosService.ts (CU27).
 * ============================================================
 */

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

const getToken = () => localStorage.getItem("access_token");

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

// ── Tipos ────────────────────────────────────────────────────

export type AgruparPor = "dia" | "semana" | "mes";

export interface FiltrosReporteValorPerdido {
  fecha_desde?: string;
  fecha_hasta?: string;
  insumo_id?: number;
  agrupar_por?: AgruparPor;
}

export interface MovimientoMerma {
  id: number;
  insumo_id: number;
  insumo_nombre: string;
  fecha_mov: string;
  causa: string | null;
  categoria_causa: string;
  valor_perdido: number;
}

export interface ItemPorCausa {
  causa: string;
  valor_perdido: number;
  cantidad_eventos: number;
}

export interface ItemPorPeriodo {
  periodo: string;
  valor_perdido: number;
}

export interface ItemPorInsumo {
  insumo_id: number;
  insumo_nombre: string;
  valor_perdido: number;
}

export interface ReporteValorPerdidoResponse {
  movimientos: MovimientoMerma[];
  por_causa: ItemPorCausa[];
  por_periodo: ItemPorPeriodo[];
  por_insumo: ItemPorInsumo[];
  valor_perdido_total: number;
  total_eventos: number;
}

// ── Helpers internos ────────────────────────────────────────

function construirQueryParams(filtros?: FiltrosReporteValorPerdido): string {
  if (!filtros) return "";
  const params = new URLSearchParams();
  if (filtros.fecha_desde) params.append("fecha_desde", filtros.fecha_desde);
  if (filtros.fecha_hasta) params.append("fecha_hasta", filtros.fecha_hasta);
  if (filtros.insumo_id !== undefined) params.append("insumo_id", String(filtros.insumo_id));
  if (filtros.agrupar_por) params.append("agrupar_por", filtros.agrupar_por);
  const query = params.toString();
  return query ? `?${query}` : "";
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

// ── Endpoints ────────────────────────────────────────────────

/** GET /api/reportes/valor-perdido/ — Reporte en JSON */
export async function getReporteValorPerdido(
  filtros?: FiltrosReporteValorPerdido
): Promise<ReporteValorPerdidoResponse> {
  const params = construirQueryParams(filtros);
  const res = await fetch(`${API_URL}/reportes/valor-perdido/${params}`, {
    headers: headers(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al obtener el reporte de valor perdido.");
  return data;
}

/** GET /api/reportes/valor-perdido/pdf/ — Descarga el reporte en PDF */
export async function descargarReporteValorPerdidoPDF(
  filtros?: FiltrosReporteValorPerdido
): Promise<void> {
  const params = construirQueryParams(filtros);
  const res = await fetch(`${API_URL}/reportes/valor-perdido/pdf/${params}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error("Error al generar el PDF del reporte.");
  const blob = await res.blob();
  descargarBlob(blob, "reporte_valor_perdido.pdf");
}

/** GET /api/reportes/valor-perdido/excel/ — Descarga el reporte en Excel */
export async function descargarReporteValorPerdidoExcel(
  filtros?: FiltrosReporteValorPerdido
): Promise<void> {
  const params = construirQueryParams(filtros);
  const res = await fetch(`${API_URL}/reportes/valor-perdido/excel/${params}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error("Error al generar el Excel del reporte.");
  const blob = await res.blob();
  descargarBlob(blob, "reporte_valor_perdido.xlsx");
}