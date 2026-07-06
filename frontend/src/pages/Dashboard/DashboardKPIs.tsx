/**
 * ============================================================
 * ARCHIVO: frontend/src/pages/Dashboard/DashboardKPIs.tsx
 * CASO DE USO: CU29 - Visualizar Dashboard de KPIs
 * CICLO: 4
 * AUTOR: Mateo Hurtado
 * FECHA: 21/06/26
 *
 * DESCRIPCIÓN: Panel con 5 indicadores clave del negocio (valor
 * perdido acumulado, margen promedio, rotación de inventario,
 * próximos a vencer, stock bajo) con colores semáforo, más un
 * gráfico de tendencia de valor perdido de los últimos 6 meses
 * (recharts). El backend (CU29) entrega solo valores numéricos;
 * toda la lógica de semáforo vive aquí, igual principio que
 * badgeMargen() en CU27 y badgeDiferencia() en CU15.
 *
 * Umbrales de semáforo (definidos en sesión de diseño Fase 3):
 * - Margen promedio:      verde >=30% | amarillo 0-30% | rojo <0%
 *   (mismo umbral que ReporteCostos.tsx, CU27)
 * - Rotación inventario:  verde >=70% | amarillo 40-70% | rojo <40%
 * - Valor perdido:        comparado contra el mes anterior, no contra
 *   un umbral absoluto en Bs. — verde si bajó o igual, amarillo si
 *   subió hasta 20%, rojo si subió más de 20%
 * - Próximos a vencer:    verde 0-5 | amarillo 6-15 | rojo >15
 * - Stock bajo:           verde 0 | amarillo 1-5 | rojo >5
 *
 * No tiene botón "Volver" ni filtros (se accede desde el sidebar,
 * mismo criterio que CU25/CU27) y se puede refrescar manualmente.
 * ============================================================
 */

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Loader2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Minus,
  DollarSign,
  Percent,
  RotateCcw,
  CalendarClock,
  AlertTriangle,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AppHeader from "@/components/AppHeader";

import {
  getDashboardKpis,
  type DashboardKpisResponse,
  type KpiNumerico,
} from "@/services/dashboardKpisService";
import BriefingIACard from "@/components/BriefingIACard";

type NivelSemaforo = "verde" | "amarillo" | "rojo" | "neutro";

const ESTILOS_SEMAFORO: Record<NivelSemaforo, string> = {
  verde: "bg-green-50 text-green-700 border-green-100",
  amarillo: "bg-yellow-50 text-yellow-700 border-yellow-100",
  rojo: "bg-red-50 text-red-700 border-red-100",
  neutro: "bg-gray-50 text-gray-500 border-gray-100",
};

const ICONO_SEMAFORO: Record<NivelSemaforo, JSX.Element> = {
  verde: <TrendingUp className="h-3.5 w-3.5" />,
  amarillo: <Minus className="h-3.5 w-3.5" />,
  rojo: <TrendingDown className="h-3.5 w-3.5" />,
  neutro: <Minus className="h-3.5 w-3.5" />,
};

export default function DashboardKPIs() {
  const [datos, setDatos] = useState<DashboardKpisResponse | null>(null);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  const cargarDashboard = useCallback(async (esRefresco: boolean) => {
    try {
      if (esRefresco) setRefrescando(true);
      else setCargando(true);
      const data = await getDashboardKpis();
      setDatos(data);
    } catch (err: unknown) {
      const mensaje =
        err instanceof Error ? err.message : "No se pudo cargar el dashboard.";
      toast.error(mensaje);
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, []);

  useEffect(() => {
    cargarDashboard(false);
  }, [cargarDashboard]);

  function handleRefrescar() {
    cargarDashboard(true);
  }

  // ── Helpers de semáforo por KPI ─────────────────────────────

  function nivelMargen(kpi: KpiNumerico): NivelSemaforo {
    if (kpi.valor === null) return "neutro";
    if (kpi.valor >= 30) return "verde";
    if (kpi.valor >= 0) return "amarillo";
    return "rojo";
  }

  function nivelRotacion(kpi: KpiNumerico): NivelSemaforo {
    if (kpi.valor === null) return "neutro";
    if (kpi.valor >= 70) return "verde";
    if (kpi.valor >= 40) return "amarillo";
    return "rojo";
  }

  function nivelValorPerdido(kpi: KpiNumerico): NivelSemaforo {
    if (kpi.valor === null || kpi.valor_mes_anterior === undefined) return "neutro";
    if (kpi.valor_mes_anterior === 0) {
      return kpi.valor === 0 ? "verde" : "rojo";
    }
    const variacion = ((kpi.valor - kpi.valor_mes_anterior) / kpi.valor_mes_anterior) * 100;
    if (variacion <= 0) return "verde";
    if (variacion <= 20) return "amarillo";
    return "rojo";
  }

  function nivelProximosAVencer(kpi: KpiNumerico): NivelSemaforo {
    if (kpi.valor === null) return "neutro";
    if (kpi.valor <= 5) return "verde";
    if (kpi.valor <= 15) return "amarillo";
    return "rojo";
  }

  function nivelStockBajo(kpi: KpiNumerico): NivelSemaforo {
    if (kpi.valor === null) return "neutro";
    if (kpi.valor === 0) return "verde";
    if (kpi.valor <= 5) return "amarillo";
    return "rojo";
  }

  function formatoBs(valor: number): string {
    return `Bs. ${valor.toFixed(2)}`;
  }

  function formatoPeriodo(periodo: string): string {
    // periodo viene como 'YYYY-MM-DD' (día a día del mes actual) — se
    // muestra solo como 'DD' para no saturar el eje X.
    const partes = periodo.split("-");
    return partes.length === 3 ? partes[2] : periodo;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Encabezado ── */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-orange-50">
              <LayoutDashboard className="h-6 w-6 text-orange-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Dashboard de KPIs</h1>
              <p className="text-sm text-gray-400 mt-0.5">
                Indicadores clave del negocio, actualizados al momento de la consulta.
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            className="rounded-xl h-11 gap-2 border-gray-200"
            onClick={handleRefrescar}
            disabled={cargando || refrescando}
          >
            {refrescando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refrescar
          </Button>
        </div>

        {/* ── CU38: Briefing ejecutivo proactivo con IA ── */}
        <div className="mb-6">
          <BriefingIACard />
        </div>

        {cargando ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3 text-gray-400">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-200 border-t-orange-500" />
              <p className="text-sm">Calculando indicadores...</p>
            </div>
          </div>
        ) : !datos ? (
          <p className="text-sm text-gray-400 italic py-8 text-center bg-white rounded-xl border border-gray-200">
            No se pudieron cargar los indicadores.
          </p>
        ) : (
          <>
            {/* ── Cards de KPIs ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <CardKpi
                icono={<DollarSign className="h-5 w-5" />}
                titulo="Valor Perdido (mes actual)"
                valorPrincipal={
                  datos.valor_perdido_acumulado.valor !== null
                    ? formatoBs(datos.valor_perdido_acumulado.valor)
                    : "Sin datos"
                }
                subtexto={
                  datos.valor_perdido_acumulado.valor !== null
                    ? `${datos.valor_perdido_acumulado.total_eventos ?? 0} eventos de merma`
                    : datos.valor_perdido_acumulado.error
                }
                nivel={nivelValorPerdido(datos.valor_perdido_acumulado)}
              />

              <CardKpi
                icono={<Percent className="h-5 w-5" />}
                titulo="Margen Promedio por Plato"
                valorPrincipal={
                  datos.margen_promedio.valor !== null
                    ? `${datos.margen_promedio.valor.toFixed(1)}%`
                    : "Sin datos"
                }
                subtexto={
                  datos.margen_promedio.valor !== null
                    ? `${datos.margen_promedio.total_platos ?? 0} platos con receta`
                    : datos.margen_promedio.error
                }
                nivel={nivelMargen(datos.margen_promedio)}
              />

              <CardKpi
                icono={<RotateCcw className="h-5 w-5" />}
                titulo="Rotación de Inventario"
                valorPrincipal={
                  datos.rotacion_inventario.valor !== null
                    ? `${datos.rotacion_inventario.valor.toFixed(1)}%`
                    : "Sin datos"
                }
                subtexto={
                  datos.rotacion_inventario.valor !== null
                    ? `${datos.rotacion_inventario.total_insumos_considerados ?? 0} insumos con ingresos`
                    : datos.rotacion_inventario.error
                }
                nivel={nivelRotacion(datos.rotacion_inventario)}
              />

              <CardKpi
                icono={<CalendarClock className="h-5 w-5" />}
                titulo="Próximos a Vencer"
                valorPrincipal={
                  datos.proximos_a_vencer.valor !== null
                    ? String(datos.proximos_a_vencer.valor)
                    : "Sin datos"
                }
                subtexto="Lotes que vencen en los próximos 7 días"
                nivel={nivelProximosAVencer(datos.proximos_a_vencer)}
              />

              <CardKpi
                icono={<AlertTriangle className="h-5 w-5" />}
                titulo="Alertas de Stock Bajo"
                valorPrincipal={
                  datos.stock_bajo.valor !== null
                    ? String(datos.stock_bajo.valor)
                    : "Sin datos"
                }
                subtexto="Alertas no leídas por debajo del mínimo"
                nivel={nivelStockBajo(datos.stock_bajo)}
              />
            </div>

            {/* ── Gráfico de tendencia ── */}
            <Card className="rounded-3xl shadow-md border-0 bg-white">
              <CardHeader className="pb-2 px-8 pt-8">
                <CardTitle className="text-base font-bold text-gray-900">
                  Tendencia de Valor Perdido — Este Mes, Día a Día
                </CardTitle>
              </CardHeader>
              <CardContent className="px-8 pb-8 pt-4">
                {datos.tendencia_valor_perdido.length === 0 ? (
                  <p className="text-sm text-gray-400 italic py-8 text-center bg-gray-50 rounded-xl">
                    No hay datos suficientes para mostrar la tendencia.
                  </p>
                ) : (
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={datos.tendencia_valor_perdido.map((p) => ({
                          periodo: formatoPeriodo(p.periodo),
                          valor: p.valor_perdido,
                        }))}
                        margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="periodo" tick={{ fontSize: 12, fill: "#6b7280" }} />
                        <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} />
                        <Tooltip
                          formatter={(value: number) => [`Bs. ${value.toFixed(2)}`, "Valor perdido"]}
                          contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb" }}
                        />
                        <Line
                          type="monotone"
                          dataKey="valor"
                          stroke="#f97316"
                          strokeWidth={2.5}
                          dot={{ fill: "#f97316", r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

// ── Subcomponente: card de KPI con semáforo ───────────────────

function CardKpi({
  icono,
  titulo,
  valorPrincipal,
  subtexto,
  nivel,
}: {
  icono: JSX.Element;
  titulo: string;
  valorPrincipal: string;
  subtexto?: string;
  nivel: NivelSemaforo;
}) {
  return (
    <Card className="rounded-3xl shadow-md border-0 bg-white">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-3">
          <div className="p-2.5 rounded-xl bg-orange-50 text-orange-500">
            {icono}
          </div>
          <Badge className={`border gap-1 ${ESTILOS_SEMAFORO[nivel]}`}>
            {ICONO_SEMAFORO[nivel]}
          </Badge>
        </div>
        <p className="text-xs text-gray-400 mb-1">{titulo}</p>
        <p className="text-2xl font-bold text-gray-900">{valorPrincipal}</p>
        {subtexto && (
          <p className="text-xs text-gray-400 mt-1.5">{subtexto}</p>
        )}
      </CardContent>
    </Card>
  );
}