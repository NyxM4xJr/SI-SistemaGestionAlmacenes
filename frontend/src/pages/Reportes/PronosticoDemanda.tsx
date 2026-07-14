/**
 * ============================================================
 * ARCHIVO: frontend/src/pages/Reportes/PronosticoDemanda.tsx
 * CASO DE USO: CU44 - Pronóstico de Demanda
 * CICLO: 6
 *
 * DESCRIPCIÓN: Proyecta el consumo futuro por insumo a partir del
 * histórico de salidas, mostrando días de cobertura y cantidad sugerida.
 * A diferencia de CU36 (reactivo por stock mínimo), es predictivo.
 * ============================================================
 */

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { TrendingUp, AlertTriangle } from "lucide-react";

import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { getPronosticoDemanda, type PronosticoResponse } from "@/services/pronosticoService";

const VENTANAS = [7, 15, 30, 60, 90];

export default function PronosticoDemanda() {
  const [dias, setDias] = useState(30);
  const [data, setData] = useState<PronosticoResponse | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async (ventana: number) => {
    try {
      setCargando(true);
      setData(await getPronosticoDemanda(ventana));
    } catch (e) {
      toast.error((e as Error).message || "Error al generar el pronóstico.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar(dias);
  }, [cargar, dias]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <AppHeader />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <TrendingUp className="h-6 w-6 text-orange-500" />
              <h1 className="text-2xl font-bold text-gray-900">Pronóstico de Demanda</h1>
            </div>
            <p className="text-gray-500 mt-1">
              Proyección de consumo por insumo según el histórico de salidas.
              Muestra cuántos días de cobertura quedan y cuánto conviene pedir.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <label className="text-sm text-gray-500">Ventana:</label>
            <select
              value={dias}
              onChange={(e) => setDias(Number(e.target.value))}
              className="h-10 rounded-md border border-gray-200 px-3 text-sm"
            >
              {VENTANAS.map((v) => (
                <option key={v} value={v}>Últimos {v} días</option>
              ))}
            </select>
          </div>
        </div>

        {/* Resumen IA */}
        {data?.resumen_ia && (
          <div className="bg-white rounded-xl shadow-sm border border-orange-200 p-5 mb-6">
            <h2 className="font-semibold text-gray-800 mb-2">Resumen del analista (IA)</h2>
            <p className="text-sm text-gray-700 whitespace-pre-line">{data.resumen_ia}</p>
          </div>
        )}

        {cargando ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-200 border-t-orange-500" />
            <p className="text-sm">Analizando el consumo histórico...</p>
          </div>
        ) : !data || data.pronostico.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-500">
            No hay consumo (salidas) registrado en la ventana elegida para proyectar demanda.
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500">
                  <tr className="text-left">
                    <th className="px-4 py-3">Insumo</th>
                    <th className="px-4 py-3 text-right">Consumo/día</th>
                    <th className="px-4 py-3 text-right">Stock actual</th>
                    <th className="px-4 py-3 text-right">Cobertura</th>
                    <th className="px-4 py-3 text-right">Sugerido pedir</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pronostico.map((p) => (
                    <tr key={p.insumo_id} className="border-t border-gray-100">
                      <td className="px-4 py-3 font-medium text-gray-900 flex items-center gap-2">
                        {p.urgente && <AlertTriangle className="w-4 h-4 text-red-500" />}
                        {p.insumo}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{p.consumo_diario_promedio}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{p.stock_actual}</td>
                      <td className={`px-4 py-3 text-right font-medium ${p.urgente ? "text-red-600" : "text-gray-700"}`}>
                        {p.dias_cobertura === null ? "—" : `${p.dias_cobertura} días`}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {p.cantidad_sugerida > 0 ? p.cantidad_sugerida : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
