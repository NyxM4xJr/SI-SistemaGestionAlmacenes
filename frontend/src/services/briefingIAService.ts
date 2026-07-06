/**
 * ============================================================
 * ARCHIVO: frontend/src/services/briefingIAService.ts
 * CASO DE USO: CU37 - Briefing Ejecutivo Proactivo con IA
 * CICLO: 5
 *
 * DESCRIPCIÓN: Servicio de comunicación con el endpoint del
 * briefing proactivo generado por la IA. Sigue el patrón de
 * dashboardKpisService.ts.
 * ============================================================
 */

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

const getToken = () => localStorage.getItem("access_token");

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

export interface BriefingIAResponse {
  resumen: string;
  datos: Record<string, unknown>;
  generado_en: string;
}

/** GET /api/briefing-ia/ — briefing ejecutivo redactado por la IA */
export async function getBriefingIA(): Promise<BriefingIAResponse> {
  const res = await fetch(`${API_URL}/briefing-ia/`, {
    headers: headers(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al generar el briefing.");
  return data;
}
