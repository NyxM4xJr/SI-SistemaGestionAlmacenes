/**
 * ============================================================
 * ARCHIVO: frontend/src/services/facturaAnomaliaService.ts
 * CASO DE USO: CU41 - Detección de Facturas Anómalas
 * CICLO: 6
 *
 * DESCRIPCIÓN: Consulta la auditoría de facturas: duplicados y
 * sobreprecios detectados en el backend, más el informe redactado
 * por la IA.
 * ============================================================
 */

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

const getToken = () => localStorage.getItem("access_token");

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

export interface FacturaDuplicada {
  numero_factura: string;
  proveedor: string | null;
  veces_cargada: number;
  factura_ids: number[];
}

export interface FacturaSobreprecio {
  factura_id: number;
  numero_factura: string | null;
  insumo: string;
  precio_facturado: number;
  precio_pactado: number;
  sobreprecio_pct: number;
}

export interface AuditoriaFacturas {
  facturas_anomalas: number[];
  duplicados: FacturaDuplicada[];
  sobreprecios: FacturaSobreprecio[];
  informe: string;
}

/** GET /api/facturas/anomalias/ — Auditoría de facturas con IA. */
export async function detectarFacturasAnomalas(): Promise<AuditoriaFacturas> {
  const res = await fetch(`${API_URL}/facturas/anomalias/`, { headers: headers() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al auditar las facturas.");
  return data;
}
