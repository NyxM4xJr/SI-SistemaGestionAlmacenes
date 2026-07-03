const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

const getToken = () => localStorage.getItem("access_token");

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

export interface Pago {
  id: number;
  usuario_id: string;
  monto: number;
  moneda: string;
  estado: string;
  metodo: string;
  descripcion: string;
  fecha_creacion: string;
  fecha_completado: string | null;
  usuario?: {
    nombre: string;
    email: string;
  };
}

export async function crearSesionPago(monto: number, descripcion: string): Promise<{url: string}> {
  const res = await fetch(`${API_URL}/pagos/crear-sesion/`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ monto, descripcion }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al crear la sesión de pago.");
  return data;
}

export async function getHistorialPagos(): Promise<Pago[]> {
  const res = await fetch(`${API_URL}/pagos/historial/`, {
    headers: headers(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al obtener el historial de pagos.");
  return data;
}

export async function getSaldoPagos(): Promise<{saldo_total: number}> {
  const res = await fetch(`${API_URL}/pagos/saldo/`, {
    headers: headers(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al obtener el saldo.");
  return data;
}
