/**
 * ============================================================
 * ARCHIVO: frontend/src/pages/Movimientos/MovimientoForm.tsx
 * CASO DE USO: CU14 - Registrar Movimiento de Inventario
 * CICLO: 3
 * AUTOR: Mateo Hurtado
 * FECHA: 01/06/26
 *
 * DESCRIPCIÓN: Formulario dinámico para registrar movimientos.
 * El usuario selecciona el tipo (4 tabs) y el formulario
 * muestra los campos correspondientes a ese tipo.
 * Sigue el patrón exacto de PlatoForm.tsx.
 * ============================================================
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  PackageOpen,
  Save,
  Loader2,
  ArrowDownCircle,
  ArrowUpCircle,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

import { Button }   from "@/components/ui/button";
import { Input }    from "@/components/ui/input";
import { Label }    from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AppHeader from "@/components/AppHeader";

import {
  type TipoMovimiento,
  type MovimientoPayload,
  createMovimiento,
} from "@/services/movimientoService";

// ── Tipos para selects ───────────────────────────────────────

interface InsumoOpcion {
  id: number;
  nombre: string;
}

interface StockOpcion {
  id: number;
  cantidad: number;
  insumo_id: number;
}

// ── Config de tabs de tipo ────────────────────────────────────

const TIPOS: {
  value: TipoMovimiento;
  label: string;
  icon: React.ReactNode;
  color: string;
  active: string;
}[] = [
  {
    value:  "ingreso",
    label:  "Ingreso",
    icon:   <ArrowDownCircle className="h-4 w-4" />,
    color:  "text-green-600 border-green-200 hover:bg-green-50",
    active: "bg-green-500 text-white border-green-500 hover:bg-green-500",
  },
  {
    value:  "salida",
    label:  "Salida",
    icon:   <ArrowUpCircle className="h-4 w-4" />,
    color:  "text-blue-600 border-blue-200 hover:bg-blue-50",
    active: "bg-blue-500 text-white border-blue-500 hover:bg-blue-500",
  },
  {
    value:  "merma",
    label:  "Merma",
    icon:   <AlertTriangle className="h-4 w-4" />,
    color:  "text-red-600 border-red-200 hover:bg-red-50",
    active: "bg-red-500 text-white border-red-500 hover:bg-red-500",
  },
  {
    value:  "sobrerecuperada",
    label:  "Sobrerecuperada",
    icon:   <RefreshCw className="h-4 w-4" />,
    color:  "text-yellow-600 border-yellow-200 hover:bg-yellow-50",
    active: "bg-yellow-500 text-white border-yellow-500 hover:bg-yellow-500",
  },
];

const CAUSAS_MERMA = [
  "Vencimiento",
  "Daño físico",
  "Contaminación",
  "Error de manipulación",
  "Deterioro por temperatura",
  "Otro",
];

// ── Componente principal ─────────────────────────────────────

export default function MovimientoForm() {
  const navigate = useNavigate();

  // ── Tipo seleccionado ────────────────────────────────────
  const [tipo, setTipo] = useState<TipoMovimiento>("ingreso");

  // ── Campos comunes ───────────────────────────────────────
  const [insumoId, setInsumoId]     = useState<string>("");
  const [stockId, setStockId]       = useState<string>("");
  const [cantidad, setCantidad]     = useState<string>("");
  const [fechaMov, setFechaMov]     = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [observacion, setObservacion] = useState<string>("");

  // ── Campos específicos ───────────────────────────────────
  const [origen, setOrigen]                   = useState("");
  const [costoUnitario, setCostoUnitario]     = useState("");
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [destino, setDestino]                 = useState("");
  const [causa, setCausa]                     = useState("");
  const [valorPerdido, setValorPerdido]       = useState("");
  const [porcentajePerdida, setPorcentajePerdida] = useState("");
  const [procedencia, setProcedencia]         = useState("");

  // ── Selects cargados ─────────────────────────────────────
  const [insumos, setInsumos]   = useState<InsumoOpcion[]>([]);
  const [stocks, setStocks]     = useState<StockOpcion[]>([]);
  const [cargandoInsumos, setCargandoInsumos] = useState(true);
  const [cargandoStocks, setCargandoStocks]   = useState(false);

  // ── UI ────────────────────────────────────────────────────
  const [guardando, setGuardando]   = useState(false);
  const [errores, setErrores]       = useState<Record<string, string>>({});

  const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";
  const getToken = () => localStorage.getItem("access_token");
  const hdrs = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  });

  // ── Cargar insumos al montar ─────────────────────────────
  useEffect(() => {
    async function cargar() {
      try {
        const res  = await fetch(`${API_URL}/insumos/`, { headers: hdrs() });
        const data = await res.json();
        setInsumos(data);
      } catch {
        toast.error("No se pudieron cargar los insumos.");
      } finally {
        setCargandoInsumos(false);
      }
    }
    cargar();
  }, []);

  // ── Cargar stocks cuando cambia el insumo ────────────────
  useEffect(() => {
    if (!insumoId) { setStocks([]); setStockId(""); return; }

    async function cargarStocks() {
      try {
        setCargandoStocks(true);
        setStockId("");
        const res  = await fetch(`${API_URL}/stock/`, { headers: hdrs() });
        const data: StockOpcion[] = await res.json();
        setStocks(data.filter((s) => s.insumo_id === Number(insumoId)));
      } catch {
        toast.error("No se pudieron cargar las ubicaciones de stock.");
      } finally {
        setCargandoStocks(false);
      }
    }
    cargarStocks();
  }, [insumoId]);

  // ── Resetear campos específicos al cambiar tipo ──────────
  function cambiarTipo(nuevo: TipoMovimiento) {
    setTipo(nuevo);
    setErrores({});
    setOrigen(""); setCostoUnitario(""); setFechaVencimiento("");
    setDestino(""); setCausa(""); setValorPerdido("");
    setPorcentajePerdida(""); setProcedencia("");
  }

  // ── Validaciones ─────────────────────────────────────────
  function validar(): boolean {
    const e: Record<string, string> = {};

    if (!insumoId)  e.insumoId  = "Debe seleccionar un insumo.";
    if (!stockId)   e.stockId   = "Debe seleccionar una ubicación de stock.";
    if (!cantidad || Number(cantidad) <= 0)
                    e.cantidad  = "La cantidad debe ser mayor a cero.";

    if (tipo === "ingreso"  && !origen.trim())     e.origen     = "El origen es obligatorio.";
    if (tipo === "salida"   && !destino.trim())    e.destino    = "El destino es obligatorio.";
    if (tipo === "merma") {
      if (!causa)                                  e.causa       = "La causa es obligatoria.";
      if (!valorPerdido || Number(valorPerdido) < 0)
                                                   e.valorPerdido = "Ingrese el valor perdido.";
    }
    if (tipo === "sobrerecuperada" && !procedencia.trim())
                                                   e.procedencia = "La procedencia es obligatoria.";

    setErrores(e);
    return Object.keys(e).length === 0;
  }

  // ── Submit ────────────────────────────────────────────────
  async function handleSubmit() {
    if (!validar()) return;

    const payload: MovimientoPayload = {
      tipo,
      insumo_id:   Number(insumoId),
      stock_id:    Number(stockId),
      cantidad:    Number(cantidad),
      fecha_mov:   fechaMov,
      observacion: observacion.trim() || undefined,
    };

    if (tipo === "ingreso") {
      payload.origen = origen.trim();
      if (costoUnitario)    payload.costo_unitario    = Number(costoUnitario);
      if (fechaVencimiento) payload.fecha_vencimiento = fechaVencimiento;
    } else if (tipo === "salida") {
      payload.destino = destino.trim();
    } else if (tipo === "merma") {
      payload.causa         = causa;
      payload.valor_perdido = Number(valorPerdido);
      if (porcentajePerdida) payload.porcentaje_perdida = Number(porcentajePerdida);
    } else if (tipo === "sobrerecuperada") {
      payload.procedencia = procedencia.trim();
    }

    try {
      setGuardando(true);
      await createMovimiento(payload);
      toast.success("Movimiento registrado correctamente.");
      navigate("/movimientos");
    } catch (err: unknown) {
      const mensaje =
        err instanceof Error ? err.message : "Error al registrar el movimiento.";
      toast.error(mensaje);
    } finally {
      setGuardando(false);
    }
  }

  // ── Helpers de campo ─────────────────────────────────────
  function campo(id: string) {
    return errores[id]
      ? "border-red-400 focus:ring-red-300"
      : "border-gray-200";
  }

  const tipoActual = TIPOS.find((t) => t.value === tipo)!;

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Botón volver ── */}
        <Button
          variant="ghost"
          className="mb-6 gap-2 text-gray-500 hover:text-gray-700 -ml-2"
          onClick={() => navigate("/movimientos")}
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a movimientos
        </Button>

        {/* ── Card principal ── */}
        <Card className="rounded-3xl shadow-md border-0 bg-white">
          <CardHeader className="pb-2 px-8 pt-8">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-50">
                <PackageOpen className="h-6 w-6 text-indigo-500" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-gray-900">
                  Nuevo Movimiento
                </CardTitle>
                <p className="text-sm text-gray-400 mt-0.5">
                  Selecciona el tipo y completa los datos.
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="px-8 pb-8 pt-6 space-y-6">

            {/* ── Tabs de tipo ── */}
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-2 block">
                Tipo de Movimiento <span className="text-red-500">*</span>
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {TIPOS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => cambiarTipo(t.value)}
                    className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      tipo === t.value ? t.active : t.color
                    }`}
                  >
                    {t.icon}
                    <span className="hidden sm:inline">{t.label}</span>
                    <span className="sm:hidden">{t.label.slice(0, 6)}</span>
                  </button>
                ))}
              </div>
              {/* Indicador del tipo activo */}
              <p className="text-xs text-gray-400 mt-2 ml-1">
                Tipo seleccionado:{" "}
                <span className="font-medium text-gray-600">{tipoActual.label}</span>
              </p>
            </div>

            {/* ── Campos comunes ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Insumo */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-sm font-medium text-gray-700">
                  Insumo <span className="text-red-500">*</span>
                </Label>
                <select
                  value={insumoId}
                  onChange={(e) => {
                    setInsumoId(e.target.value);
                    if (errores.insumoId) setErrores((p) => ({ ...p, insumoId: "" }));
                  }}
                  disabled={cargandoInsumos}
                  className={`w-full h-11 rounded-xl border px-3 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 ${campo("insumoId")}`}
                >
                  <option value="">
                    {cargandoInsumos ? "Cargando insumos..." : "Selecciona un insumo"}
                  </option>
                  {insumos.map((ins) => (
                    <option key={ins.id} value={ins.id}>
                      {ins.nombre}
                    </option>
                  ))}
                </select>
                {errores.insumoId && (
                  <p className="text-xs text-red-500">{errores.insumoId}</p>
                )}
              </div>

              {/* Stock / Ubicación */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-sm font-medium text-gray-700">
                  Ubicación de Stock <span className="text-red-500">*</span>
                </Label>
                <select
                  value={stockId}
                  onChange={(e) => {
                    setStockId(e.target.value);
                    if (errores.stockId) setErrores((p) => ({ ...p, stockId: "" }));
                  }}
                  disabled={!insumoId || cargandoStocks}
                  className={`w-full h-11 rounded-xl border px-3 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-50 ${campo("stockId")}`}
                >
                  <option value="">
                    {!insumoId
                      ? "Selecciona un insumo primero"
                      : cargandoStocks
                      ? "Cargando ubicaciones..."
                      : stocks.length === 0
                      ? "Sin stock para este insumo"
                      : "Selecciona una ubicación"}
                  </option>
                  {stocks.map((s) => (
                    <option key={s.id} value={s.id}>
                      Stock #{s.id} — Disponible: {s.cantidad} uds.
                    </option>
                  ))}
                </select>
                {errores.stockId && (
                  <p className="text-xs text-red-500">{errores.stockId}</p>
                )}
              </div>

              {/* Cantidad */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  Cantidad <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="0"
                  value={cantidad}
                  onChange={(e) => {
                    setCantidad(e.target.value);
                    if (errores.cantidad) setErrores((p) => ({ ...p, cantidad: "" }));
                  }}
                  className={`rounded-xl h-11 ${campo("cantidad")}`}
                />
                {errores.cantidad && (
                  <p className="text-xs text-red-500">{errores.cantidad}</p>
                )}
              </div>

              {/* Fecha */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  Fecha del Movimiento
                </Label>
                <Input
                  type="date"
                  value={fechaMov}
                  onChange={(e) => setFechaMov(e.target.value)}
                  className="rounded-xl h-11 border-gray-200"
                />
              </div>
            </div>

            {/* ── Campos específicos por tipo ── */}

            {/* INGRESO */}
            {tipo === "ingreso" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-green-50 border border-green-100">
                <p className="sm:col-span-2 text-xs font-semibold text-green-700 uppercase tracking-wide">
                  Datos del Ingreso
                </p>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-sm font-medium text-gray-700">
                    Origen <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder="Ej: Mercado Central, Proveedor ABC..."
                    value={origen}
                    onChange={(e) => {
                      setOrigen(e.target.value);
                      if (errores.origen) setErrores((p) => ({ ...p, origen: "" }));
                    }}
                    className={`rounded-xl h-11 bg-white ${campo("origen")}`}
                  />
                  {errores.origen && (
                    <p className="text-xs text-red-500">{errores.origen}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">
                    Costo Unitario (Bs.)
                    <span className="text-gray-400 font-normal ml-1">(opcional)</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">Bs.</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={costoUnitario}
                      onChange={(e) => setCostoUnitario(e.target.value)}
                      className="pl-10 rounded-xl h-11 bg-white border-gray-200"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">
                    Fecha de Vencimiento
                    <span className="text-gray-400 font-normal ml-1">(opcional)</span>
                  </Label>
                  <Input
                    type="date"
                    value={fechaVencimiento}
                    onChange={(e) => setFechaVencimiento(e.target.value)}
                    className="rounded-xl h-11 bg-white border-gray-200"
                  />
                </div>
              </div>
            )}

            {/* SALIDA */}
            {tipo === "salida" && (
              <div className="grid grid-cols-1 gap-4 p-4 rounded-2xl bg-blue-50 border border-blue-100">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                  Datos de la Salida
                </p>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">
                    Destino <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder="Ej: Cocina principal, Área de preparación..."
                    value={destino}
                    onChange={(e) => {
                      setDestino(e.target.value);
                      if (errores.destino) setErrores((p) => ({ ...p, destino: "" }));
                    }}
                    className={`rounded-xl h-11 bg-white ${campo("destino")}`}
                  />
                  {errores.destino && (
                    <p className="text-xs text-red-500">{errores.destino}</p>
                  )}
                </div>
              </div>
            )}

            {/* MERMA */}
            {tipo === "merma" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-red-50 border border-red-100">
                <p className="sm:col-span-2 text-xs font-semibold text-red-700 uppercase tracking-wide">
                  Datos de la Merma
                </p>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-sm font-medium text-gray-700">
                    Causa <span className="text-red-500">*</span>
                  </Label>
                  <select
                    value={causa}
                    onChange={(e) => {
                      setCausa(e.target.value);
                      if (errores.causa) setErrores((p) => ({ ...p, causa: "" }));
                    }}
                    className={`w-full h-11 rounded-xl border px-3 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-red-300 ${campo("causa")}`}
                  >
                    <option value="">Selecciona la causa</option>
                    {CAUSAS_MERMA.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  {errores.causa && (
                    <p className="text-xs text-red-500">{errores.causa}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">
                    Valor Perdido (Bs.) <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">Bs.</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={valorPerdido}
                      onChange={(e) => {
                        setValorPerdido(e.target.value);
                        if (errores.valorPerdido) setErrores((p) => ({ ...p, valorPerdido: "" }));
                      }}
                      className={`pl-10 rounded-xl h-11 bg-white ${campo("valorPerdido")}`}
                    />
                  </div>
                  {errores.valorPerdido && (
                    <p className="text-xs text-red-500">{errores.valorPerdido}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">
                    % Pérdida
                    <span className="text-gray-400 font-normal ml-1">(opcional)</span>
                  </Label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      placeholder="0.0"
                      value={porcentajePerdida}
                      onChange={(e) => setPorcentajePerdida(e.target.value)}
                      className="rounded-xl h-11 bg-white border-gray-200 pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                  </div>
                </div>
              </div>
            )}

            {/* SOBRERECUPERADA */}
            {tipo === "sobrerecuperada" && (
              <div className="grid grid-cols-1 gap-4 p-4 rounded-2xl bg-yellow-50 border border-yellow-100">
                <p className="text-xs font-semibold text-yellow-700 uppercase tracking-wide">
                  Datos de la Sobrerecuperación
                </p>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">
                    Procedencia <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder="Ej: Reutilización de cortes, proceso de recuperación..."
                    value={procedencia}
                    onChange={(e) => {
                      setProcedencia(e.target.value);
                      if (errores.procedencia) setErrores((p) => ({ ...p, procedencia: "" }));
                    }}
                    className={`rounded-xl h-11 bg-white ${campo("procedencia")}`}
                  />
                  {errores.procedencia && (
                    <p className="text-xs text-red-500">{errores.procedencia}</p>
                  )}
                </div>
              </div>
            )}

            {/* ── Observación (siempre visible) ── */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">
                Observación
                <span className="text-gray-400 font-normal ml-1">(opcional)</span>
              </Label>
              <Textarea
                placeholder="Notas adicionales sobre este movimiento..."
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                rows={3}
                className="rounded-xl resize-none border-gray-200"
              />
            </div>

            {/* ── Botón submit ── */}
            <Button
              size="lg"
              className="w-full mt-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl h-12 font-semibold gap-2"
              onClick={handleSubmit}
              disabled={guardando}
            >
              {guardando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Registrar Movimiento
                </>
              )}
            </Button>

          </CardContent>
        </Card>
      </main>
    </div>
  );
}