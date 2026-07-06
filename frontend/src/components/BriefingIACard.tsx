/**
 * ============================================================
 * ARCHIVO: frontend/src/components/BriefingIACard.tsx
 * CASO DE USO: CU40 - Briefing Ejecutivo Proactivo con IA
 * CICLO: 5
 *
 * DESCRIPCIÓN: Card reutilizable del briefing generado por IA.
 * Se usa en Profile.tsx (landing real post-login) y en
 * DashboardKPIs.tsx (CU29), para no duplicar la lógica de carga.
 * Solo se debe renderizar para roles administrador/gerente (el
 * backend ya lo valida con 403, pero se evita el request para
 * el resto de roles desde donde se use este componente).
 * ============================================================
 */

import { useEffect, useState, useCallback } from "react";
import { Bot, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getBriefingIA } from "@/services/briefingIAService";

export default function BriefingIACard() {
  const [briefing, setBriefing] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setError(null);
      const data = await getBriefingIA();
      setBriefing(data.resumen);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo generar el briefing.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <Card className="rounded-3xl shadow-md border-0 bg-gradient-to-br from-indigo-50 to-white">
      <CardContent className="p-6">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-100 text-indigo-600 shrink-0">
            <Bot className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-indigo-600 uppercase tracking-wide mb-1">
              Briefing del día · generado por IA
            </p>
            {cargando ? (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-1">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analizando el estado del negocio...
              </div>
            ) : error ? (
              <p className="text-sm text-gray-400 italic">{error}</p>
            ) : (
              <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                {briefing}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
