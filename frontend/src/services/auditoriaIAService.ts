const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

const getToken = () => localStorage.getItem("access_token");

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

export interface SenalesAuditoria {
  total_registros: number;
  logins_fallidos_por_usuario: { usuario: string; intentos: number }[];
  acciones_sensibles: { usuario: string; accion: string; fecha: string }[];
  usuarios_mas_activos: { usuario: string; acciones: number }[];
}

export interface AuditoriaResponse {
  resumen: string;
  detalle: string;
  senales: SenalesAuditoria;
}

/** GET /api/auditoria-ia/ — Auditoría inteligente de la bitácora. */
export async function getAuditoriaIA(): Promise<AuditoriaResponse> {
  const res = await fetch(`${API_URL}/auditoria-ia/`, { headers: headers() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al generar la auditoría.");
  return data;
}
