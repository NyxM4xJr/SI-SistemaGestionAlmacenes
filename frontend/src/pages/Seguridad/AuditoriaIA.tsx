/**
 * ============================================================
 * ARCHIVO: frontend/src/pages/Seguridad/AuditoriaIA.tsx
 * CASO DE USO: CU43 - Auditoría Inteligente de Bitácora
 * CICLO: 6
 *
 * DESCRIPCIÓN: Muestra un informe ejecutivo redactado por la IA sobre la
 * actividad reciente del sistema (logins fallidos, cambios de rol, etc.)
 * más las señales objetivas calculadas por el backend.
 * ============================================================
 */

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, AlertTriangle, Activity, KeyRound } from "lucide-react";

import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { getAuditoriaIA, type AuditoriaResponse } from "@/services/auditoriaIAService";

export default function AuditoriaIA() {
  const [data, setData] = useState<AuditoriaResponse | null>(null);
  const [cargando, setCargando] = useState(true);
  const [verDetalle, setVerDetalle] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setVerDetalle(false);
      setData(await getAuditoriaIA());
    } catch (e) {
      toast.error((e as Error).message || "Error al generar la auditoría.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const senales = data?.senales;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <AppHeader />

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-6 w-6 text-indigo-600" />
              <h1 className="text-2xl font-bold text-gray-900">Auditoría Inteligente (IA)</h1>
            </div>
            <p className="text-gray-500 mt-1">
              La IA resume la actividad reciente del sistema y marca patrones
              sospechosos, a partir de la bitácora.
            </p>
          </div>
          <Button variant="outline" onClick={cargar} disabled={cargando} className="rounded-xl h-11 shrink-0">
            {cargando ? "Analizando..." : "Volver a analizar"}
          </Button>
        </div>

        {cargando ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-500" />
            <p className="text-sm">La IA está revisando la bitácora...</p>
          </div>
        ) : (
          <>
            {/* Informe IA — resumen con opción de ver el detalle */}
            <div className="bg-white rounded-xl shadow-sm border border-indigo-200 p-5 mb-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold text-gray-800">
                  {verDetalle ? "Informe detallado" : "Resumen ejecutivo"}
                </h2>
                {data?.detalle && data.detalle !== data.resumen && (
                  <button
                    onClick={() => setVerDetalle((v) => !v)}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    {verDetalle ? "Ver menos" : "Ver más"}
                  </button>
                )}
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-line">
                {verDetalle ? data?.detalle : data?.resumen}
              </p>
            </div>

            {/* Señales */}
            {senales && (
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center gap-2 text-amber-600 mb-2">
                    <KeyRound className="w-4 h-4" />
                    <span className="text-xs font-semibold uppercase tracking-wide">Logins fallidos</span>
                  </div>
                  {senales.logins_fallidos_por_usuario.length === 0 ? (
                    <p className="text-sm text-gray-400">Ninguno</p>
                  ) : (
                    senales.logins_fallidos_por_usuario.map((u, i) => (
                      <p key={i} className="text-sm text-gray-700">
                        {u.usuario}: <span className="font-semibold">{u.intentos}</span>
                      </p>
                    ))
                  )}
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center gap-2 text-red-600 mb-2">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-xs font-semibold uppercase tracking-wide">Acciones sensibles</span>
                  </div>
                  {senales.acciones_sensibles.length === 0 ? (
                    <p className="text-sm text-gray-400">Ninguna</p>
                  ) : (
                    senales.acciones_sensibles.slice(0, 6).map((a, i) => (
                      <p key={i} className="text-sm text-gray-700">
                        {a.accion} · <span className="text-gray-400">{a.usuario}</span>
                      </p>
                    ))
                  )}
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center gap-2 text-gray-600 mb-2">
                    <Activity className="w-4 h-4" />
                    <span className="text-xs font-semibold uppercase tracking-wide">Más activos</span>
                  </div>
                  {senales.usuarios_mas_activos.map((u, i) => (
                    <p key={i} className="text-sm text-gray-700">
                      {u.usuario}: <span className="font-semibold">{u.acciones}</span>
                    </p>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
