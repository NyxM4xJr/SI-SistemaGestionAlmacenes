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

// ── CU36 (Ciclo 5): PayPal ───────────────────────────────────

/** POST /api/pagos/paypal/crear-orden/ — Crea orden y devuelve la URL de aprobación */
export async function crearOrdenPayPal(
  monto: number,
  descripcion: string,
  returnUrl: string,
  cancelUrl: string
): Promise<{ order_id: string; approve_url: string }> {
  const res = await fetch(`${API_URL}/pagos/paypal/crear-orden/`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ monto, descripcion, return_url: returnUrl, cancel_url: cancelUrl }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al crear la orden de PayPal.");
  return data;
}

/** POST /api/pagos/paypal/capturar/ — Captura la orden aprobada */
export async function capturarPayPal(
  orderId: string
): Promise<{ status: string; order_id: string }> {
  const res = await fetch(`${API_URL}/pagos/paypal/capturar/`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ order_id: orderId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al capturar el pago de PayPal.");
  return data;
}
