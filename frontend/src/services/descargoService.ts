/**
 * ============================================================
 * ARCHIVO: frontend/src/services/descargoService.ts
 * CASO DE USO: CU16 - Generar Propuesta de Descargo Automático
 * CICLO: 4
 * AUTOR: Mateo Hurtado
 * FECHA: 21/06/26
 *
 * DESCRIPCIÓN: Servicio de comunicación con la API REST para el
 * descargo automático. Reutiliza el tipo VentaPlato de CU15
 * (cierreTurnoService.ts) para mantener el mismo contrato de
 * datos entre ambos CUs. Sigue el patrón exacto de
 * reporteValorPerdidoService.ts para headers y manejo de errores.
 * ============================================================
 */

import type { VentaPlato } from "./cierreTurnoService";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

const getToken = () => localStorage.getItem("access_token");

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

// ── Tipos ────────────────────────────────────────────────────

export interface ItemPropuestaDescargo {
  insumo_id: number;
  insumo_nombre: string;
  cantidad_a_descargar: number;
  costo_unitario_vigente: number | null;
  costo_unitario_disponible: boolean;
  valor_estimado: number;
  stock_actual: number;
  stock_suficiente: boolean;
}

export interface PlatoSinRecetaDescargo {
  plato_id: number;
  plato_nombre: string;
}

export interface PropuestaDescargoResponse {
  items: ItemPropuestaDescargo[];
  valor_total_estimado: number;
  total_insumos: number;
  total_insumos_con_problema: number;
  platos_sin_receta: PlatoSinRecetaDescargo[];
}

export interface InsumoDescargado {
  insumo_id: number;
  insumo_nombre: string;
  cantidad: number;
  valor: number;
}

export interface InsumoExcluido {
  insumo_id: number;
  insumo_nombre: string;
  motivo: string;
}

export interface ResultadoDescargoResponse {
  insumos_descargados: InsumoDescargado[];
  insumos_excluidos: InsumoExcluido[];
  valor_total_descargado: number;
}

// ── Endpoints ────────────────────────────────────────────────

/**
 * GET /api/descargo/ — Calcula la propuesta de descargo (no modifica la BD)
 * Mismo formato de 'ventas' que CU15 (plato_id, plato_nombre, unidades),
 * aunque el backend solo usa plato_id y unidades.
 */
export async function calcularPropuestaDescargo(
  ventas: VentaPlato[]
): Promise<PropuestaDescargoResponse> {
  const params = new URLSearchParams({
    ventas: JSON.stringify(
      ventas.map((v) => ({ plato_id: v.plato_id, unidades: v.unidades }))
    ),
  });

  const res = await fetch(`${API_URL}/descargo/?${params.toString()}`, {
    headers: headers(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al calcular la propuesta de descargo.");
  return data;
}

/** POST /api/descargo/confirmar/ — Ejecuta el descargo (best-effort por insumo) */
export async function confirmarDescargo(
  ventas: VentaPlato[]
): Promise<ResultadoDescargoResponse> {
  const res = await fetch(`${API_URL}/descargo/confirmar/`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      ventas: ventas.map((v) => ({ plato_id: v.plato_id, unidades: v.unidades })),
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al confirmar el descargo.");
  return data;
}