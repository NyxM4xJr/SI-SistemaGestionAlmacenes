/**
 * ============================================================
 * ARCHIVO: frontend/src/pages/Platos/PlatoForm.tsx
 * CASO DE USO: CU20 - Gestionar Platos del Menú
 * CICLO: 3
 * AUTOR: Karen Ortega
 * FECHA: 01/06/26
 *
 * DESCRIPCIÓN: Formulario para crear y editar platos.
 * Si la URL tiene :id, entra en modo edición y precarga
 * los datos del plato. Sigue el patrón de InsumoForm.tsx.
 * ============================================================
 */

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, ChefHat, Save, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AppHeader from "@/components/AppHeader";

import {
  type PlatoPayload,
  getPlatoById,
  createPlato,
  updatePlato,
} from "@/services/platoService";

export default function PlatoForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const esEdicion = Boolean(id);

  // ── Estado del formulario ────────────────────────────────
  const [nombre, setNombre]           = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [costo, setCosto]             = useState("");

  // ── Estado de UI ─────────────────────────────────────────
  const [cargando, setCargando]     = useState(false);
  const [guardando, setGuardando]   = useState(false);
  const [errores, setErrores]       = useState<Record<string, string>>({});

  // ── Precargar datos en modo edición ──────────────────────
  useEffect(() => {
    if (!esEdicion) return;

    async function cargarPlato() {
      try {
        setCargando(true);
        const plato = await getPlatoById(Number(id));
        setNombre(plato.nombre);
        setDescripcion(plato.descripcion || "");
        setCosto(String(plato.costo));
      } catch {
        toast.error("No se pudo cargar el plato.");
        navigate("/platos");
      } finally {
        setCargando(false);
      }
    }

    cargarPlato();
  }, [id, esEdicion, navigate]);

  // ── Validación del formulario ─────────────────────────────
  function validar(): boolean {
    const nuevosErrores: Record<string, string> = {};

    if (!nombre.trim()) {
      nuevosErrores.nombre = "El nombre es obligatorio.";
    }

    if (!costo) {
      nuevosErrores.costo = "El costo es obligatorio.";
    } else if (isNaN(Number(costo)) || Number(costo) < 0) {
      nuevosErrores.costo = "El costo debe ser un número positivo.";
    }

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  // ── Envío del formulario ──────────────────────────────────
  async function handleSubmit() {
    if (!validar()) return;

    const payload: PlatoPayload = {
      nombre:      nombre.trim(),
      descripcion: descripcion.trim(),
      costo:       Number(costo),
    };

    try {
      setGuardando(true);

      if (esEdicion) {
        await updatePlato(Number(id), payload);
        toast.success("Plato actualizado correctamente.");
      } else {
        await createPlato(payload);
        toast.success("Plato creado correctamente.");
      }

      navigate("/platos");
    } catch (err: unknown) {
      const mensaje =
        err instanceof Error ? err.message : "Error al guardar el plato.";
      toast.error(mensaje);
    } finally {
      setGuardando(false);
    }
  }

  // ── Render ────────────────────────────────────────────────
  if (cargando) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppHeader />
        <div className="flex items-center justify-center py-32">
          <div className="flex flex-col items-center gap-3 text-gray-400">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-200 border-t-orange-500" />
            <p className="text-sm">Cargando plato...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Botón volver ── */}
        <Button
          variant="ghost"
          className="mb-6 gap-2 text-gray-500 hover:text-gray-700 -ml-2"
          onClick={() => navigate("/platos")}
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al catálogo
        </Button>

        {/* ── Card del formulario ── */}
        <Card className="rounded-3xl shadow-md border-0 bg-white">
          <CardHeader className="pb-2 px-8 pt-8">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-orange-50">
                <ChefHat className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-gray-900">
                  {esEdicion ? "Editar Plato" : "Nuevo Plato"}
                </CardTitle>
                <p className="text-sm text-gray-400 mt-0.5">
                  {esEdicion
                    ? "Modifica los datos del plato seleccionado."
                    : "Completa los datos para registrar un nuevo plato."}
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="px-8 pb-8 pt-6">
            <div className="grid grid-cols-1 gap-5">

              {/* ── Nombre ── */}
              <div className="space-y-1.5">
                <Label htmlFor="nombre" className="text-sm font-medium text-gray-700">
                  Nombre del Plato <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="nombre"
                  placeholder="Ej: Lomo Saltado, Ceviche de Corvina..."
                  value={nombre}
                  onChange={(e) => {
                    setNombre(e.target.value);
                    if (errores.nombre) setErrores((prev) => ({ ...prev, nombre: "" }));
                  }}
                  className={`rounded-xl h-11 ${
                    errores.nombre ? "border-red-400 focus:ring-red-300" : "border-gray-200"
                  }`}
                />
                {errores.nombre && (
                  <p className="text-xs text-red-500 mt-1">{errores.nombre}</p>
                )}
              </div>

              {/* ── Costo ── */}
              <div className="space-y-1.5">
                <Label htmlFor="costo" className="text-sm font-medium text-gray-700">
                  Costo Base (Bs.) <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">
                    Bs.
                  </span>
                  <Input
                    id="costo"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={costo}
                    onChange={(e) => {
                      setCosto(e.target.value);
                      if (errores.costo) setErrores((prev) => ({ ...prev, costo: "" }));
                    }}
                    className={`pl-10 rounded-xl h-11 ${
                      errores.costo ? "border-red-400 focus:ring-red-300" : "border-gray-200"
                    }`}
                  />
                </div>
                {errores.costo && (
                  <p className="text-xs text-red-500 mt-1">{errores.costo}</p>
                )}
              </div>

              {/* ── Descripción ── */}
              <div className="space-y-1.5">
                <Label htmlFor="descripcion" className="text-sm font-medium text-gray-700">
                  Descripción
                  <span className="text-gray-400 font-normal ml-1">(opcional)</span>
                </Label>
                <Textarea
                  id="descripcion"
                  placeholder="Describe brevemente el plato: ingredientes principales, estilo de cocción, origen..."
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  rows={4}
                  className="rounded-xl resize-none border-gray-200"
                />
              </div>

              {/* ── Botón submit ── */}
              <Button
                size="lg"
                className="w-full mt-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl h-12 font-semibold gap-2"
                onClick={handleSubmit}
                disabled={guardando}
              >
                {guardando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {esEdicion ? "Actualizando..." : "Guardando..."}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    {esEdicion ? "Guardar Cambios" : "Registrar Plato"}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}