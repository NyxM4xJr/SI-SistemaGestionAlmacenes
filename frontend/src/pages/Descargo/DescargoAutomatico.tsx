/**
 * ============================================================
 * ARCHIVO: frontend/src/pages/Descargo/DescargoAutomatico.tsx
 * CASO DE USO: CU16 - Generar Propuesta de Descargo Automático
 * CICLO: 4
 * AUTOR: Mateo Hurtado
 * FECHA: 21/06/26
 *
 * DESCRIPCIÓN: Pantalla separada (/descargo) a la que se llega
 * desde CierreTurno.tsx (CU15) tras validar el cierre de turno,
 * vía estado de navegación de React Router ({horaDesde, horaHasta,
 * ventas}). NO se vuelve a pedir esos datos al Chef.
 *
 * Flujo de 2 pasos (F1 alt / F3 loop+F4 alt / F5 critical, ver
 * CICLO4_DIAGRAMS_SPEC_MATEO.md):
 * 1. Al montar, calcula automáticamente la propuesta de descargo
 *    (no modifica la BD).
 * 2. El Chef revisa la propuesta (insumos, cantidades, costos,
 *    insumos con problema de stock) y confirma.
 * 3. Solo al confirmar se ejecutan las salidas reales — operación
 *    parcial (best-effort): los insumos sin stock suficiente se
 *    excluyen, pero no bloquean el descargo del resto.
 *
 * Si se accede directamente a /descargo sin pasar por CU15 (sin
 * datos de turno en el estado de navegación), se muestra un aviso
 * pidiendo hacer el cierre de turno primero, sin intentar calcular
 * nada (F1 alt del diagrama de secuencia).
 * ============================================================
 */

import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  PackageMinus,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
} from "lucide-react";

import { Button } from "@/components/ui/button";
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

import type { VentaPlato } from "@/services/cierreTurnoService";
import {
  calcularPropuestaDescargo,
  confirmarDescargo,
  type PropuestaDescargoResponse,
  type ResultadoDescargoResponse,
} from "@/services/descargoService";

interface EstadoNavegacionDescargo {
  horaDesde: string;
  horaHasta: string;
  ventas: VentaPlato[];
}

export default function DescargoAutomatico() {
  const navigate = useNavigate();
  const location = useLocation();
  const estado = location.state as EstadoNavegacionDescargo | null;

  // ── Estado de la propuesta ──────────────────────────────────
  const [propuesta, setPropuesta] = useState<PropuestaDescargoResponse | null>(null);
  const [resultado, setResultado] = useState<ResultadoDescargoResponse | null>(null);

  // ── Estado de UI ─────────────────────────────────────────────
  const [calculando, setCalculando] = useState(true);
  const [confirmando, setConfirmando] = useState(false);

  // F1 (alt) — sin datos de turno: no se calcula nada, se muestra aviso
  const sinDatosDeTurno = !estado || !estado.ventas || estado.ventas.length === 0;

  useEffect(() => {
    if (sinDatosDeTurno) {
      setCalculando(false);
      return;
    }

    async function cargarPropuesta() {
      try {
        setCalculando(true);
        const data = await calcularPropuestaDescargo(estado!.ventas);
        setPropuesta(data);
      } catch (err: unknown) {
        const mensaje =
          err instanceof Error ? err.message : "Error al calcular la propuesta de descargo.";
        toast.error(mensaje);
      } finally {
        setCalculando(false);
      }
    }

    cargarPropuesta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sinDatosDeTurno]);

  async function handleConfirmar() {
    if (!estado) return;

    try {
      setConfirmando(true);
      const data = await confirmarDescargo(estado.ventas);
      setResultado(data);

      if (data.insumos_excluidos.length === 0) {
        toast.success("Descargo confirmado: todos los insumos se descargaron correctamente.");
      } else {
        toast.warning(
          `Descargo confirmado con ${data.insumos_excluidos.length} insumo(s) excluido(s) por falta de stock.`
        );
      }
    } catch (err: unknown) {
      const mensaje =
        err instanceof Error ? err.message : "Error al confirmar el descargo.";
      toast.error(mensaje);
    } finally {
      setConfirmando(false);
    }
  }

  function formatoBs(valor: number | null): string {
    return valor !== null ? `Bs. ${valor.toFixed(2)}` : "N/D";
  }

  // ── F1 (alt): sin datos de turno ────────────────────────────
  if (sinDatosDeTurno) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppHeader />
        <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card className="rounded-3xl shadow-md border-0 bg-white">
            <CardContent className="p-10 text-center">
              <div className="mx-auto mb-4 w-12 h-12 rounded-xl bg-yellow-50 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">
                No hay datos de turno disponibles
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                El descargo automático necesita los datos de un cierre de turno
                ya validado. Primero realiza el cierre de turno y, desde ahí,
                genera el descargo.
              </p>
              <Button
                className="rounded-xl h-11 gap-2 bg-orange-500 hover:bg-orange-600 text-white"
                onClick={() => navigate("/cierre-turno")}
              >
                Ir a Validar Cierre de Turno
              </Button>
            </CardContent>
          </Card>
        </main>
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
          onClick={() => navigate("/cierre-turno")}
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Cierre de Turno
        </Button>

        {/* ── Encabezado ── */}
        <Card className="rounded-3xl shadow-md border-0 bg-white mb-6">
          <CardHeader className="pb-2 px-8 pt-8">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-orange-50">
                <PackageMinus className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-gray-900">
                  Descargo Automático
                </CardTitle>
                <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Turno de {estado!.horaDesde} a {estado!.horaHasta}
                </p>
              </div>
            </div>
          </CardHeader>
        </Card>

        {calculando ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3 text-gray-400">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-200 border-t-orange-500" />
              <p className="text-sm">Calculando propuesta de descargo...</p>
            </div>
          </div>
        ) : !propuesta ? (
          <p className="text-sm text-gray-400 italic py-8 text-center bg-white rounded-xl border border-gray-200">
            No se pudo calcular la propuesta de descargo.
          </p>
        ) : resultado ? (
          // ── Resultado tras confirmar ──────────────────────────
          <Card className="rounded-3xl shadow-md border-0 bg-white">
            <CardHeader className="pb-2 px-8 pt-8">
              <CardTitle className="text-lg font-bold text-gray-900">
                Resultado del Descargo
              </CardTitle>
            </CardHeader>
            <CardContent className="px-8 pb-8 pt-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-green-100 bg-green-50 p-4">
                  <p className="text-xs text-green-700 mb-1">Insumos descargados</p>
                  <p className="text-2xl font-bold text-green-700">
                    {resultado.insumos_descargados.length}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs text-gray-500 mb-1">Valor total descargado</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatoBs(resultado.valor_total_descargado)}
                  </p>
                </div>
              </div>

              {resultado.insumos_descargados.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Descargados exitosamente
                  </p>
                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead>Insumo</TableHead>
                          <TableHead className="text-right">Cantidad</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {resultado.insumos_descargados.map((item) => (
                          <TableRow key={item.insumo_id}>
                            <TableCell className="font-medium text-gray-700">
                              {item.insumo_nombre}
                            </TableCell>
                            <TableCell className="text-right text-gray-600">
                              {item.cantidad}
                            </TableCell>
                            <TableCell className="text-right text-gray-600">
                              {formatoBs(item.valor)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {resultado.insumos_excluidos.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                    <XCircle className="h-4 w-4 text-red-500" />
                    Excluidos (no se descargaron)
                  </p>
                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead>Insumo</TableHead>
                          <TableHead>Motivo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {resultado.insumos_excluidos.map((item) => (
                          <TableRow key={item.insumo_id}>
                            <TableCell className="font-medium text-gray-700">
                              {item.insumo_nombre}
                            </TableCell>
                            <TableCell className="text-sm text-gray-500">
                              {item.motivo}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <Button
                variant="outline"
                className="rounded-xl h-11"
                onClick={() => navigate("/movimientos")}
              >
                Ver Movimientos de Inventario
              </Button>
            </CardContent>
          </Card>
        ) : (
          // ── Propuesta calculada, pendiente de confirmar ───────
          <Card className="rounded-3xl shadow-md border-0 bg-white">
            <CardHeader className="pb-2 px-8 pt-8">
              <CardTitle className="text-lg font-bold text-gray-900">
                Propuesta de Descargo
              </CardTitle>
              <p className="text-sm text-gray-400 mt-0.5">
                Revisa los insumos a descontar antes de confirmar.
              </p>
            </CardHeader>

            <CardContent className="px-8 pb-8 pt-6">

              {/* ── Aviso de platos sin receta ── */}
              {propuesta.platos_sin_receta.length > 0 && (
                <div className="mb-5 flex items-start gap-2 rounded-xl bg-yellow-50 border border-yellow-200 px-4 py-3">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-yellow-700">
                    Los siguientes platos no tienen receta asociada y se excluyeron
                    del cálculo:{" "}
                    {propuesta.platos_sin_receta.map((p) => p.plato_nombre).join(", ")}
                  </p>
                </div>
              )}

              {/* ── Aviso de insumos con problema de stock ── */}
              {propuesta.total_insumos_con_problema > 0 && (
                <div className="mb-5 flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                  <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-700">
                    {propuesta.total_insumos_con_problema} insumo(s) no tienen stock
                    suficiente y se excluirán automáticamente del descargo al confirmar.
                  </p>
                </div>
              )}

              {/* ── Resumen ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-50">
                    <DollarSign className="h-5 w-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Valor total estimado</p>
                    <p className="text-lg font-bold text-gray-900">
                      {formatoBs(propuesta.valor_total_estimado)}
                    </p>
                  </div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs text-gray-400">Total de insumos</p>
                  <p className="text-lg font-bold text-gray-900">
                    {propuesta.total_insumos}
                  </p>
                </div>
              </div>

              {/* ── Tabla de la propuesta ── */}
              {propuesta.items.length === 0 ? (
                <p className="text-sm text-gray-400 italic py-8 text-center bg-gray-50 rounded-xl">
                  No hay insumos para descargar con los platos vendidos indicados.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>Insumo</TableHead>
                        <TableHead className="text-right">Cantidad a Descargar</TableHead>
                        <TableHead className="text-right">Costo Unitario</TableHead>
                        <TableHead className="text-right">Valor Estimado</TableHead>
                        <TableHead className="text-center">Stock</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {propuesta.items.map((item) => (
                        <TableRow key={item.insumo_id}>
                          <TableCell className="font-medium text-gray-700">
                            {item.insumo_nombre}
                          </TableCell>
                          <TableCell className="text-right text-gray-600">
                            {item.cantidad_a_descargar}
                          </TableCell>
                          <TableCell className="text-right text-gray-600">
                            {item.costo_unitario_disponible
                              ? formatoBs(item.costo_unitario_vigente)
                              : "N/D"}
                          </TableCell>
                          <TableCell className="text-right text-gray-600">
                            {formatoBs(item.valor_estimado)}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.stock_suficiente ? (
                              <Badge className="bg-green-100 text-green-700 border-0 gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Suficiente
                              </Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-700 border-0 gap-1">
                                <XCircle className="h-3 w-3" />
                                Insuficiente
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* ── Botón confirmar ── */}
              <Button
                size="lg"
                className="w-full mt-6 bg-orange-500 hover:bg-orange-600 text-white rounded-xl h-12 font-semibold gap-2"
                onClick={handleConfirmar}
                disabled={confirmando || propuesta.items.length === 0}
              >
                {confirmando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Confirmando...
                  </>
                ) : (
                  <>
                    <PackageMinus className="h-4 w-4" />
                    Confirmar Descargo
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