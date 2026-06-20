/**
 * ============================================================
 * ARCHIVO: frontend/src/pages/CierreTurno/CierreTurno.tsx
 * CASO DE USO: CU15 - Validar Cierre de Turno
 * CICLO: 4
 * AUTOR: Karen
 * FECHA: 19/06/26
 *
 * DESCRIPCIÓN: Página de cierre de turno. El Chef define un
 * rango horario e ingresa cuántas unidades de cada plato del
 * catálogo se vendieron (no se guarda en BD, solo viaja en el
 * request). El sistema calcula la comparativa de consumo
 * teórico (según receta) vs consumo real (según movimientos
 * de salida) y permite validar el cierre, lo que solo deja
 * constancia en la bitácora.
 * Sigue el patrón de PlatoForm.tsx / MovimientoList.tsx.
 * ============================================================
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  ClipboardCheck,
  Loader2,
  Clock,
  UtensilsCrossed,
  Calculator,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import AppHeader from "@/components/AppHeader";

import { getPlatos, type Plato } from "@/services/platoService";
import {
  calcularComparativa,
  validarCierreTurno,
  type ItemComparativa,
  type PlatoSinReceta,
  type VentaPlato,
} from "@/services/cierreTurnoService";

export default function CierreTurno() {
  const navigate = useNavigate();

  // ── Estado del formulario ────────────────────────────────
  const [horaDesde, setHoraDesde] = useState("08:00");
  const [horaHasta, setHoraHasta] = useState("16:00");
  const [platos, setPlatos] = useState<Plato[]>([]);
  const [unidadesPorPlato, setUnidadesPorPlato] = useState<Record<number, string>>({});

  // ── Estado de la comparativa ──────────────────────────────
  const [comparativa, setComparativa] = useState<ItemComparativa[] | null>(null);
  const [platosSinReceta, setPlatosSinReceta] = useState<PlatoSinReceta[]>([]);

  // ── Estado de UI ─────────────────────────────────────────
  const [cargando, setCargando] = useState(true);
  const [calculando, setCalculando] = useState(false);
  const [validando, setValidando] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});

  // ── Cargar catálogo de platos al montar ──────────────────
  useEffect(() => {
    async function cargarPlatos() {
      try {
        setCargando(true);
        const data = await getPlatos();
        setPlatos(data);
      } catch {
        toast.error("No se pudo cargar el catálogo de platos.");
      } finally {
        setCargando(false);
      }
    }

    cargarPlatos();
  }, []);

  // ── Validación del formulario ─────────────────────────────
  function validar(): boolean {
    const nuevosErrores: Record<string, string> = {};

    if (!horaDesde) {
      nuevosErrores.horaDesde = "La hora de inicio es obligatoria.";
    }
    if (!horaHasta) {
      nuevosErrores.horaHasta = "La hora de fin es obligatoria.";
    }
    if (horaDesde && horaHasta && horaDesde >= horaHasta) {
      nuevosErrores.horaHasta = "Debe ser mayor a la hora de inicio.";
    }

    const algunaVenta = Object.values(unidadesPorPlato).some(
      (v) => Number(v) > 0
    );
    if (!algunaVenta) {
      nuevosErrores.ventas = "Debe ingresar al menos un plato vendido.";
    }

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  function actualizarUnidades(platoId: number, valor: string) {
    setUnidadesPorPlato((prev) => ({ ...prev, [platoId]: valor }));
    if (errores.ventas) setErrores((prev) => ({ ...prev, ventas: "" }));
  }

  // ── Calcular comparativa ──────────────────────────────────
  async function handleCalcular() {
    if (!validar()) return;

    const ventas: VentaPlato[] = platos.map((p) => ({
      plato_id: p.id,
      plato_nombre: p.nombre,
      unidades: Number(unidadesPorPlato[p.id] || 0),
    }));

    try {
      setCalculando(true);
      const resultado = await calcularComparativa(horaDesde, horaHasta, ventas);
      setComparativa(resultado.comparativa);
      setPlatosSinReceta(resultado.platos_sin_receta);

      if (resultado.comparativa.length === 0) {
        toast.info("No se encontraron movimientos ni consumo en el rango indicado.");
      } else {
        toast.success("Comparativa calculada correctamente.");
      }
    } catch (err: unknown) {
      const mensaje =
        err instanceof Error ? err.message : "Error al calcular la comparativa.";
      toast.error(mensaje);
    } finally {
      setCalculando(false);
    }
  }

  // ── Validar cierre de turno ────────────────────────────────
  async function handleValidar() {
    if (!comparativa) return;

    try {
      setValidando(true);
      await validarCierreTurno({
        hora_desde: horaDesde,
        hora_hasta: horaHasta,
        comparativa,
      });
      toast.success("Cierre de turno validado exitosamente.");
    } catch (err: unknown) {
      const mensaje =
        err instanceof Error ? err.message : "Error al validar el cierre de turno.";
      toast.error(mensaje);
    } finally {
      setValidando(false);
    }
  }

  // ── Badge de color según % de diferencia ──────────────────
  function badgeDiferencia(porcentaje: number) {
    if (porcentaje < 5) {
      return (
        <Badge className="bg-green-100 text-green-700 border-0 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          {porcentaje.toFixed(1)}%
        </Badge>
      );
    }
    if (porcentaje <= 15) {
      return (
        <Badge className="bg-yellow-100 text-yellow-700 border-0 gap-1">
          <AlertTriangle className="h-3 w-3" />
          {porcentaje.toFixed(1)}%
        </Badge>
      );
    }
    return (
      <Badge className="bg-red-100 text-red-700 border-0 gap-1">
        <AlertTriangle className="h-3 w-3" />
        {porcentaje.toFixed(1)}%
      </Badge>
    );
  }

  // ── Render: carga inicial ──────────────────────────────────
  if (cargando) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppHeader />
        <div className="flex items-center justify-center py-32">
          <div className="flex flex-col items-center gap-3 text-gray-400">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-200 border-t-orange-500" />
            <p className="text-sm">Cargando catálogo de platos...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Botón volver ── */}
        <Button
          variant="ghost"
          className="mb-6 gap-2 text-gray-500 hover:text-gray-700 -ml-2"
          onClick={() => navigate("/movimientos")}
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Movimientos
        </Button>

        {/* ── Card del formulario ── */}
        <Card className="rounded-3xl shadow-md border-0 bg-white mb-6">
          <CardHeader className="pb-2 px-8 pt-8">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-orange-50">
                <ClipboardCheck className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-gray-900">
                  Validar Cierre de Turno
                </CardTitle>
                <p className="text-sm text-gray-400 mt-0.5">
                  Compara el consumo teórico de insumos (según receta) contra el
                  consumo real registrado en movimientos de salida.
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="px-8 pb-8 pt-6">
            <div className="grid grid-cols-1 gap-5">

              {/* ── Rango horario ── */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="horaDesde" className="text-sm font-medium text-gray-700">
                    Hora Desde <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="horaDesde"
                      type="time"
                      value={horaDesde}
                      onChange={(e) => {
                        setHoraDesde(e.target.value);
                        if (errores.horaDesde) setErrores((prev) => ({ ...prev, horaDesde: "" }));
                      }}
                      className={`pl-10 rounded-xl h-11 ${
                        errores.horaDesde ? "border-red-400 focus:ring-red-300" : "border-gray-200"
                      }`}
                    />
                  </div>
                  {errores.horaDesde && (
                    <p className="text-xs text-red-500 mt-1">{errores.horaDesde}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="horaHasta" className="text-sm font-medium text-gray-700">
                    Hora Hasta <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="horaHasta"
                      type="time"
                      value={horaHasta}
                      onChange={(e) => {
                        setHoraHasta(e.target.value);
                        if (errores.horaHasta) setErrores((prev) => ({ ...prev, horaHasta: "" }));
                      }}
                      className={`pl-10 rounded-xl h-11 ${
                        errores.horaHasta ? "border-red-400 focus:ring-red-300" : "border-gray-200"
                      }`}
                    />
                  </div>
                  {errores.horaHasta && (
                    <p className="text-xs text-red-500 mt-1">{errores.horaHasta}</p>
                  )}
                </div>
              </div>

              {/* ── Unidades vendidas por plato ── */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <UtensilsCrossed className="h-4 w-4 text-gray-400" />
                  Unidades Vendidas por Plato
                </Label>
                <p className="text-xs text-gray-400 mb-2">
                  Ingresa cuántas unidades de cada plato se vendieron en el rango
                  horario indicado. Déjalo en 0 si no se vendió.
                </p>

                {platos.length === 0 ? (
                  <p className="text-sm text-gray-400 italic py-4 text-center bg-gray-50 rounded-xl">
                    No hay platos registrados en el catálogo.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {platos.map((plato) => (
                      <div
                        key={plato.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-4 py-2.5"
                      >
                        <span className="text-sm text-gray-700 truncate">
                          {plato.nombre}
                        </span>
                        <Input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={unidadesPorPlato[plato.id] || ""}
                          onChange={(e) => actualizarUnidades(plato.id, e.target.value)}
                          className="w-20 h-9 rounded-lg border-gray-200 text-center"
                        />
                      </div>
                    ))}
                  </div>
                )}
                {errores.ventas && (
                  <p className="text-xs text-red-500 mt-1">{errores.ventas}</p>
                )}
              </div>

              {/* ── Botón calcular ── */}
              <Button
                size="lg"
                className="w-full mt-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl h-12 font-semibold gap-2"
                onClick={handleCalcular}
                disabled={calculando}
              >
                {calculando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Calculando...
                  </>
                ) : (
                  <>
                    <Calculator className="h-4 w-4" />
                    Calcular Comparativa
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Card de la comparativa (solo si ya se calculó) ── */}
        {comparativa && (
          <Card className="rounded-3xl shadow-md border-0 bg-white">
            <CardHeader className="pb-2 px-8 pt-8">
              <CardTitle className="text-lg font-bold text-gray-900">
                Comparativa de Consumo
              </CardTitle>
              <p className="text-sm text-gray-400 mt-0.5">
                Turno de {horaDesde} a {horaHasta}
              </p>
            </CardHeader>

            <CardContent className="px-8 pb-8 pt-6">

              {/* ── Aviso de platos sin receta ── */}
              {platosSinReceta.length > 0 && (
                <div className="mb-5 flex items-start gap-2 rounded-xl bg-yellow-50 border border-yellow-200 px-4 py-3">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-yellow-700">
                    Los siguientes platos no tienen receta asociada y se excluyeron
                    del cálculo:{" "}
                    {platosSinReceta.map((p) => p.plato_nombre).join(", ")}
                  </p>
                </div>
              )}

              {/* ── Tabla comparativa ── */}
              {comparativa.length === 0 ? (
                <p className="text-sm text-gray-400 italic py-8 text-center bg-gray-50 rounded-xl">
                  No hay consumo registrado para comparar en este rango.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>Insumo</TableHead>
                        <TableHead className="text-right">Consumo Teórico</TableHead>
                        <TableHead className="text-right">Consumo Real</TableHead>
                        <TableHead className="text-right">Diferencia</TableHead>
                        <TableHead className="text-center">% Diferencia</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comparativa.map((item) => (
                        <TableRow key={item.insumo_id}>
                          <TableCell className="font-medium text-gray-700">
                            {item.insumo_nombre}
                          </TableCell>
                          <TableCell className="text-right text-gray-600">
                            {item.consumo_teorico}
                          </TableCell>
                          <TableCell className="text-right text-gray-600">
                            {item.consumo_real}
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={`inline-flex items-center gap-1 font-medium ${
                                item.diferencia > 0
                                  ? "text-red-600"
                                  : item.diferencia < 0
                                  ? "text-blue-600"
                                  : "text-gray-500"
                              }`}
                            >
                              {item.diferencia > 0 && <TrendingUp className="h-3.5 w-3.5" />}
                              {item.diferencia < 0 && <TrendingDown className="h-3.5 w-3.5" />}
                              {item.diferencia}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            {badgeDiferencia(item.porcentaje_diferencia)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* ── Botón validar cierre ── */}
              <Button
                size="lg"
                className="w-full mt-6 bg-orange-500 hover:bg-orange-600 text-white rounded-xl h-12 font-semibold gap-2"
                onClick={handleValidar}
                disabled={validando}
              >
                {validando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Validando...
                  </>
                ) : (
                  <>
                    <ClipboardCheck className="h-4 w-4" />
                    Validar Cierre de Turno
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}