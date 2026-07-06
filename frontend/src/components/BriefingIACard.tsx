/**
 * ============================================================
 * ARCHIVO: frontend/src/components/BriefingIACard.tsx
 * CASO DE USO: CU37 - Briefing Ejecutivo Proactivo con IA
 * CICLO: 5
 *
 * DESCRIPCIÓN: Card reutilizable del briefing generado por IA.
 * Se usa en Profile.tsx (landing real post-login, modo "compacto":
 * solo la primera línea + link al Dashboard) y en DashboardKPIs.tsx
 * (CU29, modo completo), para no duplicar la lógica de carga.
 * Solo se debe renderizar para roles administrador/gerente (el
 * backend ya lo valida con 403, pero se evita el request para
 * el resto de roles desde donde se use este componente).
 * ============================================================
 */

import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getBriefingIA } from "@/services/briefingIAService";

/**
 * Limpia marcado Markdown residual (negrita/cursiva/títulos/backticks)
 * como red de seguridad: el prompt ya le pide a la IA texto plano, pero
 * esto evita que asteriscos sueltos lleguen a mostrarse tal cual si el
 * modelo igual los genera.
 */
function limpiarMarkdown(texto: string): string {
  return texto
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/`/g, "");
}

interface BriefingIACardProps {
  /** Modo compacto (Perfil): solo la primera línea + link al Dashboard. */
  compacto?: boolean;
}

export default function BriefingIACard({ compacto = false }: BriefingIACardProps) {
  const navigate = useNavigate();
  const [briefing, setBriefing] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setError(null);
      const data = await getBriefingIA();
      setBriefing(limpiarMarkdown(data.resumen));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo generar el briefing.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const lineasResumen = briefing
    ?.split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 3);

  return (
    <Card className="rounded-3xl shadow-md border-0 bg-gradient-to-br from-indigo-50 to-white">
      <CardContent className={compacto ? "p-4" : "p-6"}>
        <div className="flex items-start gap-3">
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
            ) : compacto ? (
              <>
                <div className="text-sm text-gray-700 leading-relaxed space-y-0.5">
                  {lineasResumen?.map((linea, i) => (
                    <p key={i}>{linea}</p>
                  ))}
                </div>
                <button
                  onClick={() => navigate("/dashboard")}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                >
                  Ver briefing completo en el Dashboard
                  <ArrowRight className="h-3 w-3" />
                </button>
              </>
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
