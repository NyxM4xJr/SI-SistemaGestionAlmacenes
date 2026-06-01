/**
 * ============================================================
 * ARCHIVO: frontend/src/pages/Recetas/RecetaForm.tsx
 * CASO DE USO: CU21 - Gestionar Recetas
 * CICLO: 3
 * AUTOR: Karen Ortega
 * FECHA: 01/06/26
 *
 * DESCRIPCIÓN: Formulario para crear y editar recetas.
 * Tiene dos secciones:
 *   1. Cabecera: selección de plato, descripción y porciones.
 *   2. Ingredientes: tabla dinámica donde se agregan/quitan
 *      insumos con cantidad y unidad de medida.
 * ============================================================
 */

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft, BookOpen, Plus, Trash2,
  Save, Loader2, PackageOpen,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AppHeader from "@/components/AppHeader";

import {
  type Catalogos,
  type DetalleReceta,
  type RecetaPayload,
  getCatalogos,
  getRecetaById,
  createReceta,
  updateReceta,
} from "@/services/recetaService";

// ── Fila de ingrediente local (antes de guardar) ─────────────
interface FilaIngrediente {
  uid: string;          // clave local para React key
  insumo_id: string;
  cantidad: string;
  unidad_id: string;
}

function filaVacia(): FilaIngrediente {
  return { uid: crypto.randomUUID(), insumo_id: "", cantidad: "", unidad_id: "" };
}

export default function RecetaForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const esEdicion = Boolean(id);

  // ── Catálogos ────────────────────────────────────────────
  const [catalogos, setCatalogos] = useState<Catalogos>({
    platos: [], insumos: [], unidades: [],
  });

  // ── Campos de cabecera ───────────────────────────────────
  const [platoId, setPlatoId]         = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [cantidad, setCantidad]       = useState("");

  // ── Ingredientes ─────────────────────────────────────────
  const [ingredientes, setIngredientes] = useState<FilaIngrediente[]>([filaVacia()]);

  // ── UI ───────────────────────────────────────────────────
  const [cargando, setCargando]   = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores]     = useState<Record<string, string>>({});

  // ── Carga inicial ─────────────────────────────────────────
  useEffect(() => {
    async function inicializar() {
      try {
        setCargando(true);
        const cats = await getCatalogos();
        setCatalogos(cats);

        if (esEdicion) {
          const receta = await getRecetaById(Number(id));
          setPlatoId(String(receta.plato_id));
          setDescripcion(receta.descripcion || "");
          setCantidad(receta.cantidad ? String(receta.cantidad) : "");

          if (receta.detalles && receta.detalles.length > 0) {
            setIngredientes(
              receta.detalles.map((d: DetalleReceta) => ({
                uid:       crypto.randomUUID(),
                insumo_id: String(d.insumo_id),
                cantidad:  String(d.cantidad),
                unidad_id: String(d.unidad_id),
              }))
            );
          }
        }
      } catch {
        toast.error("Error al cargar los datos.");
        navigate("/recetas");
      } finally {
        setCargando(false);
      }
    }
    inicializar();
  }, [id, esEdicion, navigate]);

  // ── Manejo de ingredientes ────────────────────────────────
  function agregarIngrediente() {
    setIngredientes((prev) => [...prev, filaVacia()]);
  }

  function quitarIngrediente(uid: string) {
    if (ingredientes.length === 1) {
      toast.error("La receta debe tener al menos un ingrediente.");
      return;
    }
    setIngredientes((prev) => prev.filter((f) => f.uid !== uid));
  }

  function actualizarIngrediente(
    uid: string,
    campo: keyof Omit<FilaIngrediente, "uid">,
    valor: string
  ) {
    setIngredientes((prev) =>
      prev.map((f) => (f.uid === uid ? { ...f, [campo]: valor } : f))
    );
    // Limpiar error del campo si existe
    if (errores[`ing_${uid}_${campo}`]) {
      setErrores((prev) => { const n = { ...prev }; delete n[`ing_${uid}_${campo}`]; return n; });
    }
  }

  // ── Validación ────────────────────────────────────────────
  function validar(): boolean {
    const nuevosErrores: Record<string, string> = {};

    if (!platoId) nuevosErrores.platoId = "Debe seleccionar un plato.";

    ingredientes.forEach((ing) => {
      if (!ing.insumo_id) nuevosErrores[`ing_${ing.uid}_insumo_id`] = "Selecciona un insumo.";
      if (!ing.cantidad || Number(ing.cantidad) <= 0)
        nuevosErrores[`ing_${ing.uid}_cantidad`] = "Ingresa una cantidad válida.";
      if (!ing.unidad_id) nuevosErrores[`ing_${ing.uid}_unidad_id`] = "Selecciona unidad.";
    });

    // Insumos duplicados
    const ids = ingredientes.map((i) => i.insumo_id).filter(Boolean);
    if (ids.length !== new Set(ids).size) {
      nuevosErrores.duplicados = "No puedes agregar el mismo insumo dos veces.";
    }

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  // ── Envío ─────────────────────────────────────────────────
  async function handleSubmit() {
    if (!validar()) {
      toast.error("Corrige los errores antes de continuar.");
      return;
    }

    const payload: RecetaPayload = {
      plato_id:    Number(platoId),
      descripcion: descripcion.trim(),
      cantidad:    cantidad ? Number(cantidad) : null,
      detalles:    ingredientes.map((ing) => ({
        insumo_id: Number(ing.insumo_id),
        cantidad:  Number(ing.cantidad),
        unidad_id: Number(ing.unidad_id),
      })),
    };

    try {
      setGuardando(true);
      if (esEdicion) {
        await updateReceta(Number(id), payload);
        toast.success("Receta actualizada correctamente.");
      } else {
        await createReceta(payload);
        toast.success("Receta creada correctamente.");
      }
      navigate("/recetas");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al guardar la receta.");
    } finally {
      setGuardando(false);
    }
  }

  // ── Nombre de insumo para mostrar en la fila ─────────────
  function nombreInsumo(insumo_id: string) {
    return catalogos.insumos.find((i) => String(i.id) === insumo_id)?.nombre || "";
  }

  // ── Render ────────────────────────────────────────────────
  if (cargando) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppHeader />
        <div className="flex items-center justify-center py-32">
          <div className="flex flex-col items-center gap-3 text-gray-400">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-500" />
            <p className="text-sm">Cargando datos...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Botón volver */}
        <Button variant="ghost"
          className="mb-6 gap-2 text-gray-500 hover:text-gray-700 -ml-2"
          onClick={() => navigate("/recetas")}>
          <ArrowLeft className="h-4 w-4" />
          Volver a recetas
        </Button>

        {/* ── SECCIÓN 1: Cabecera ── */}
        <Card className="rounded-3xl shadow-md border-0 bg-white mb-6">
          <CardHeader className="pb-2 px-8 pt-8">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-50">
                <BookOpen className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-gray-900">
                  {esEdicion ? "Editar Receta" : "Nueva Receta"}
                </CardTitle>
                <p className="text-sm text-gray-400 mt-0.5">
                  {esEdicion
                    ? "Modifica los datos y los ingredientes de la receta."
                    : "Define el plato, la descripción y agrega los ingredientes."}
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="px-8 pb-8 pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

              {/* Selección de plato */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-sm font-medium text-gray-700">
                  Plato <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={platoId}
                  onValueChange={(v) => {
                    setPlatoId(v);
                    if (errores.platoId) setErrores((p) => ({ ...p, platoId: "" }));
                  }}
                  disabled={esEdicion}
                >
                  <SelectTrigger className={`rounded-xl h-11 ${errores.platoId ? "border-red-400" : "border-gray-200"}`}>
                    <SelectValue placeholder="Selecciona un plato..." />
                  </SelectTrigger>
                  <SelectContent>
                    {catalogos.platos.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {esEdicion && (
                  <p className="text-xs text-gray-400">El plato no puede cambiarse en modo edición.</p>
                )}
                {errores.platoId && <p className="text-xs text-red-500">{errores.platoId}</p>}
              </div>

              {/* Porciones */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  Porciones <span className="text-gray-400 font-normal">(opcional)</span>
                </Label>
                <Input
                  type="number" min="1" placeholder="Ej: 4"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  className="rounded-xl h-11 border-gray-200"
                />
              </div>

              {/* Descripción */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  Descripción <span className="text-gray-400 font-normal">(opcional)</span>
                </Label>
                <Input
                  placeholder="Notas de preparación..."
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="rounded-xl h-11 border-gray-200"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── SECCIÓN 2: Ingredientes ── */}
        <Card className="rounded-3xl shadow-md border-0 bg-white mb-6">
          <CardHeader className="pb-2 px-8 pt-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-orange-50">
                  <PackageOpen className="h-6 w-6 text-orange-500" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-gray-900">Ingredientes</CardTitle>
                  <p className="text-sm text-gray-400 mt-0.5">
                    {ingredientes.length} ingrediente{ingredientes.length !== 1 ? "s" : ""} agregado{ingredientes.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={agregarIngrediente}
                className="gap-1.5 rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              >
                <Plus className="h-4 w-4" />
                Agregar
              </Button>
            </div>
          </CardHeader>

          <CardContent className="px-8 pb-8 pt-4">

            {/* Error de duplicados */}
            {errores.duplicados && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
                {errores.duplicados}
              </div>
            )}

            {/* Encabezado de columnas */}
            <div className="hidden sm:grid grid-cols-12 gap-2 mb-2 px-1">
              <p className="col-span-5 text-xs font-medium text-gray-400 uppercase tracking-wide">Insumo</p>
              <p className="col-span-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Cantidad</p>
              <p className="col-span-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Unidad</p>
              <p className="col-span-1" />
            </div>

            {/* Filas de ingredientes */}
            <div className="space-y-3">
              {ingredientes.map((ing, index) => (
                <div key={ing.uid}
                  className="grid grid-cols-12 gap-2 items-start p-3 rounded-2xl bg-gray-50 border border-gray-100">

                  {/* Número en móvil */}
                  <div className="col-span-12 sm:hidden flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-gray-400">Ingrediente {index + 1}</span>
                    {ing.insumo_id && (
                      <span className="text-xs text-emerald-600 font-medium">
                        — {nombreInsumo(ing.insumo_id)}
                      </span>
                    )}
                  </div>

                  {/* Select de insumo */}
                  <div className="col-span-12 sm:col-span-5">
                    <Select
                      value={ing.insumo_id}
                      onValueChange={(v) => actualizarIngrediente(ing.uid, "insumo_id", v)}
                    >
                      <SelectTrigger className={`rounded-xl h-10 text-sm ${
                        errores[`ing_${ing.uid}_insumo_id`] ? "border-red-400" : "border-gray-200 bg-white"
                      }`}>
                        <SelectValue placeholder="Seleccionar insumo..." />
                      </SelectTrigger>
                      <SelectContent>
                        {catalogos.insumos.map((ins) => (
                          <SelectItem key={ins.id} value={String(ins.id)}>
                            <span>{ins.nombre}</span>
                            {ins.categoria && (
                              <span className="text-gray-400 text-xs ml-1">({ins.categoria})</span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errores[`ing_${ing.uid}_insumo_id`] && (
                      <p className="text-xs text-red-500 mt-0.5">{errores[`ing_${ing.uid}_insumo_id`]}</p>
                    )}
                  </div>

                  {/* Cantidad */}
                  <div className="col-span-5 sm:col-span-3">
                    <Input
                      type="number" min="0.01" step="0.01"
                      placeholder="0.00"
                      value={ing.cantidad}
                      onChange={(e) => actualizarIngrediente(ing.uid, "cantidad", e.target.value)}
                      className={`rounded-xl h-10 text-sm ${
                        errores[`ing_${ing.uid}_cantidad`] ? "border-red-400" : "border-gray-200 bg-white"
                      }`}
                    />
                    {errores[`ing_${ing.uid}_cantidad`] && (
                      <p className="text-xs text-red-500 mt-0.5">{errores[`ing_${ing.uid}_cantidad`]}</p>
                    )}
                  </div>

                  {/* Select de unidad */}
                  <div className="col-span-5 sm:col-span-3">
                    <Select
                      value={ing.unidad_id}
                      onValueChange={(v) => actualizarIngrediente(ing.uid, "unidad_id", v)}
                    >
                      <SelectTrigger className={`rounded-xl h-10 text-sm ${
                        errores[`ing_${ing.uid}_unidad_id`] ? "border-red-400" : "border-gray-200 bg-white"
                      }`}>
                        <SelectValue placeholder="Unidad..." />
                      </SelectTrigger>
                      <SelectContent>
                        {catalogos.unidades.map((u) => (
                          <SelectItem key={u.id} value={String(u.id)}>{u.unidad}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errores[`ing_${ing.uid}_unidad_id`] && (
                      <p className="text-xs text-red-500 mt-0.5">{errores[`ing_${ing.uid}_unidad_id`]}</p>
                    )}
                  </div>

                  {/* Botón quitar */}
                  <div className="col-span-2 sm:col-span-1 flex items-center justify-center">
                    <Button
                      variant="ghost" size="sm"
                      className="h-10 w-10 p-0 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl"
                      onClick={() => quitarIngrediente(ing.uid)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Botón agregar al pie */}
            <button
              onClick={agregarIngrediente}
              className="mt-4 w-full py-2.5 rounded-2xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-emerald-300 hover:text-emerald-600 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Agregar otro ingrediente
            </button>
          </CardContent>
        </Card>

        {/* ── Botón guardar ── */}
        <Button
          size="lg"
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl h-12 font-semibold gap-2"
          onClick={handleSubmit}
          disabled={guardando}
        >
          {guardando ? (
            <><Loader2 className="h-4 w-4 animate-spin" />
              {esEdicion ? "Actualizando..." : "Guardando..."}</>
          ) : (
            <><Save className="h-4 w-4" />
              {esEdicion ? "Guardar Cambios" : "Registrar Receta"}</>
          )}
        </Button>
      </main>
    </div>
  );
}