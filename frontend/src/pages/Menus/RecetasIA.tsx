/**
 * ============================================================
 * ARCHIVO: frontend/src/pages/Menus/RecetasIA.tsx
 * CASO DE USO: CU41 - Generación de Recetas con IA
 * CICLO: 5
 *
 * DESCRIPCIÓN: A diferencia de CU24 (que solo filtra el catálogo
 * de platos ya existente), esta página genera platos NUEVOS con
 * La IA, priorizando insumos próximos a vencer y con alta merma
 * técnica. Es de solo sugerencia: no crea nada en la base, solo
 * muestra el razonamiento de la IA. Sigue el patrón visual de
 * SugerirMenu.tsx (CU24).
 * ============================================================
 */

import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bot,
  Clock,
  Percent,
  ChefHat,
  Sparkles,
} from "lucide-react";

import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import {
  generarRecetasIA,
  type PlatoSugeridoIA,
  type InsumoCandidato,
} from "@/services/recetaIAService";

export default function RecetasIA() {
  const navigate = useNavigate();

  const [platos, setPlatos] = useState<PlatoSugeridoIA[]>([]);
  const [insumos, setInsumos] = useState<InsumoCandidato[]>([]);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [yaGenero, setYaGenero] = useState(false);

  const generar = useCallback(async () => {
    try {
      setCargando(true);
      setMensaje(null);
      const data = await generarRecetasIA();
      setPlatos(data.platos_sugeridos);
      setInsumos(data.insumos_considerados);
      setMensaje(data.mensaje || null);
      setYaGenero(true);
    } catch (error: unknown) {
      console.error(error);
      toast.error(
        (error as Error).message || "Error al generar las sugerencias de recetas."
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    generar();
  }, [generar]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <AppHeader />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/menus")}
          className="mb-6 -ml-4 text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a Menús
        </Button>

        {/* ── Cabecera ── */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-4 bg-indigo-50 text-indigo-600 rounded-xl hidden sm:block">
                <Bot className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Recetas Sugeridas por IA
                </h1>
                <p className="text-gray-500 mt-1">
                  La IA propone platos nuevos priorizando insumos que vencen
                  pronto y tienen alta merma técnica, para evitar desperdicio.
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={generar}
              disabled={cargando}
              className="rounded-xl h-11 px-4 shrink-0"
            >
              {cargando ? "Generando..." : yaGenero ? "Generar de nuevo" : "Generar sugerencias"}
            </Button>
          </div>
        </div>

        {/* ── Insumos considerados ── */}
        {!cargando && insumos.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
              Insumos considerados (próximos a vencer)
            </p>
            <div className="flex flex-wrap gap-2">
              {insumos.map((i) => (
                <span
                  key={i.insumo}
                  className="inline-flex items-center gap-1.5 text-xs font-medium bg-gray-50 text-gray-700 px-3 py-1.5 rounded-full border border-gray-200"
                >
                  {i.insumo}
                  <span className="inline-flex items-center gap-0.5 text-orange-600">
                    <Clock className="w-3 h-3" />
                    {i.dias_restantes}d
                  </span>
                  {i.porcentaje_merma > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-red-500">
                      <Percent className="w-3 h-3" />
                      {i.porcentaje_merma}% merma
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Contenido ── */}
        {cargando ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-500" />
            <p className="text-sm">La IA está razonando sobre tus insumos...</p>
          </div>
        ) : mensaje ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 flex flex-col items-center justify-center text-center">
            <ChefHat className="h-16 w-16 text-gray-300 mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              Nada urgente por ahora
            </h2>
            <p className="text-gray-500 max-w-md">{mensaje}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {platos.map((plato, idx) => (
              <Card key={idx} className="rounded-2xl shadow-sm border border-gray-200">
                <CardContent className="p-6 flex flex-col h-full">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge className="bg-indigo-100 text-indigo-700 border-0 gap-1">
                      <Sparkles className="w-3 h-3" />
                      {plato.categoria}
                    </Badge>
                  </div>

                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    {plato.nombre}
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">{plato.descripcion}</p>

                  <div className="mb-4">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                      Ingredientes
                    </p>
                    <ul className="space-y-1">
                      {plato.ingredientes.map((ing, i2) => (
                        <li key={i2} className="text-sm text-gray-700 flex justify-between">
                          <span>{ing.insumo}</span>
                          <span className="text-gray-400">{ing.cantidad_aproximada}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-auto pt-4 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                      Por qué este plato
                    </p>
                    <p className="text-sm text-gray-600 italic">{plato.justificacion}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
