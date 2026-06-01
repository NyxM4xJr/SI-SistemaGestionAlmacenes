/**
 * ============================================================
 * ARCHIVO: frontend/src/pages/Recetas/RecetaList.tsx
 * CASO DE USO: CU21 - Gestionar Recetas
 * CICLO: 3
 * AUTOR: Karen Ortega
 * FECHA: 01/06/26
 * ACTUALIZACIÓN: Modal de detalle de receta + mejoras UI/UX
 * ============================================================
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Plus, Search, Pencil, Trash2, BookOpen,
  UtensilsCrossed, ChefHat, Layers, Eye, X,
  Package, Ruler,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import AppHeader from "@/components/AppHeader";

import {
  type Receta,
  getRecetas,
  getRecetaById,
  deleteReceta,
} from "@/services/recetaService";

export default function RecetaList() {
  const navigate = useNavigate();

  // ── Estado principal ─────────────────────────────────────
  const [recetas, setRecetas]                 = useState<Receta[]>([]);
  const [filtradas, setFiltradas]             = useState<Receta[]>([]);
  const [busqueda, setBusqueda]               = useState("");
  const [cargando, setCargando]               = useState(true);
  const [eliminandoId, setEliminandoId]       = useState<number | null>(null);
  const [recetaAEliminar, setRecetaAEliminar] = useState<Receta | null>(null);

  // ── Estado del modal de detalle ──────────────────────────
  const [recetaDetalle, setRecetaDetalle]     = useState<Receta | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [modalAbierto, setModalAbierto]       = useState(false);

  useEffect(() => { cargarRecetas(); }, []);

  async function cargarRecetas() {
    try {
      setCargando(true);
      const data = await getRecetas();
      setRecetas(data);
      setFiltradas(data);
    } catch {
      toast.error("Error al cargar las recetas.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    const termino = busqueda.toLowerCase();
    setFiltradas(
      recetas.filter((r) =>
        r.plato?.nombre?.toLowerCase().includes(termino) ||
        r.descripcion?.toLowerCase().includes(termino)
      )
    );
  }, [busqueda, recetas]);

  // ── Ver detalle ──────────────────────────────────────────
  async function verDetalle(receta: Receta) {
    try {
      setCargandoDetalle(true);
      setModalAbierto(true);
      setRecetaDetalle(null);
      const data = await getRecetaById(receta.id);
      setRecetaDetalle(data);
    } catch {
      toast.error("Error al cargar el detalle de la receta.");
      setModalAbierto(false);
    } finally {
      setCargandoDetalle(false);
    }
  }

  // ── Eliminar ─────────────────────────────────────────────
  async function confirmarEliminar() {
    if (!recetaAEliminar) return;
    try {
      setEliminandoId(recetaAEliminar.id);
      await deleteReceta(recetaAEliminar.id);
      toast.success(`Receta de "${recetaAEliminar.plato?.nombre}" eliminada correctamente.`);
      await cargarRecetas();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar la receta.");
    } finally {
      setEliminandoId(null);
      setRecetaAEliminar(null);
    }
  }

  // ── Estadísticas ─────────────────────────────────────────
  const totalIngredientes = recetas.reduce(
    (acc, r) => acc + (r.cantidad_ingredientes || 0), 0
  );
  const promedioIngredientes = recetas.length > 0
    ? (totalIngredientes / recetas.length).toFixed(1)
    : "0";

  // ── Helpers ───────────────────────────────────────────────
  const spinner = (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3 text-gray-400">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-500" />
        <p className="text-sm">Cargando recetas...</p>
      </div>
    </div>
  );

  const estadoVacio = (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
      <BookOpen className="h-12 w-12 mb-3 text-gray-300" />
      <p className="text-base font-medium text-gray-500">
        {busqueda ? "No se encontraron recetas con ese criterio." : "No hay recetas registradas."}
      </p>
      {!busqueda && (
        <Button variant="ghost" className="mt-3 text-emerald-600 hover:text-emerald-700"
          onClick={() => navigate("/recetas/nueva")}>
          Registrar la primera receta
        </Button>
      )}
    </div>
  );

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Encabezado */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <BookOpen className="h-8 w-8 text-emerald-600" />
              Gestionar Recetas
            </h1>
            <p className="text-gray-500 mt-1 text-sm">
              Composición de ingredientes por plato del menú
            </p>
          </div>
          <Button onClick={() => navigate("/recetas/nueva")}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 rounded-xl px-5">
            <Plus className="h-4 w-4" />
            Nueva Receta
          </Button>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card className="rounded-2xl shadow-sm border-0 bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Total de Recetas</CardTitle>
              <BookOpen className="h-5 w-5 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">{recetas.length}</p>
              <p className="text-xs text-gray-400 mt-1">recetas registradas</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm border-0 bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Total Ingredientes</CardTitle>
              <Layers className="h-5 w-5 text-blue-400" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">{totalIngredientes}</p>
              <p className="text-xs text-gray-400 mt-1">en todas las recetas</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm border-0 bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Promedio por Receta</CardTitle>
              <ChefHat className="h-5 w-5 text-orange-400" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">{promedioIngredientes}</p>
              <p className="text-xs text-gray-400 mt-1">ingredientes promedio</p>
            </CardContent>
          </Card>
        </div>

        {/* Búsqueda */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar receta por nombre de plato o descripción..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-10 rounded-xl border-gray-200 bg-white h-11"
          />
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
          {cargando ? spinner : filtradas.length === 0 ? estadoVacio : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:bg-gray-50">
                    <TableHead className="font-semibold text-gray-600 w-[50px]">#</TableHead>
                    <TableHead className="font-semibold text-gray-600">Plato</TableHead>
                    <TableHead className="font-semibold text-gray-600 hidden md:table-cell">Descripción</TableHead>
                    <TableHead className="font-semibold text-gray-600 hidden sm:table-cell">Porciones</TableHead>
                    <TableHead className="font-semibold text-gray-600">Ingredientes</TableHead>
                    <TableHead className="font-semibold text-gray-600 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.map((receta, index) => (
                    <TableRow
                      key={receta.id}
                      className="hover:bg-emerald-50/30 transition-colors cursor-pointer"
                      onClick={() => verDetalle(receta)}
                    >
                      <TableCell className="text-gray-400 text-sm">{index + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                            <UtensilsCrossed className="h-4 w-4 text-emerald-500" />
                          </div>
                          <span className="font-medium text-gray-900">
                            {receta.plato?.nombre || `Plato #${receta.plato_id}`}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-500 text-sm hidden md:table-cell max-w-xs truncate">
                        {receta.descripcion || <span className="italic text-gray-300">Sin descripción</span>}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {receta.cantidad
                          ? <Badge variant="secondary" className="text-xs">{receta.cantidad} porciones</Badge>
                          : <span className="text-gray-300 text-xs italic">—</span>}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                          <Layers className="h-3.5 w-3.5" />
                          {receta.cantidad_ingredientes || 0}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {/* Detener propagación para que los botones no abran el modal */}
                        <div
                          className="flex items-center justify-end gap-1 flex-wrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button variant="ghost" size="sm"
                            className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50"
                            onClick={() => verDetalle(receta)}
                            title="Ver detalle"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm"
                            className="h-8 w-8 p-0 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                            onClick={() => navigate(`/recetas/${receta.id}/editar`)}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm"
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setRecetaAEliminar(receta)}
                            disabled={eliminandoId === receta.id}
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {!cargando && filtradas.length > 0 && (
          <p className="text-xs text-gray-400 mt-3 text-right">
            Mostrando {filtradas.length} de {recetas.length} recetas
            · Clic en una fila para ver el detalle
          </p>
        )}
      </main>

      {/* ══════════════════════════════════════════
          MODAL DE DETALLE DE RECETA
      ══════════════════════════════════════════ */}
      <Dialog open={modalAbierto} onOpenChange={setModalAbierto}>
        <DialogContent className="rounded-3xl max-w-2xl w-full p-0 overflow-hidden">

          {/* Header del modal */}
          <DialogHeader className="px-8 pt-8 pb-4 border-b border-gray-100">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-50 flex-shrink-0">
                  <BookOpen className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold text-gray-900">
                    {cargandoDetalle
                      ? "Cargando receta..."
                      : recetaDetalle?.plato?.nombre || "Detalle de Receta"}
                  </DialogTitle>
                  {recetaDetalle?.descripcion && (
                    <p className="text-sm text-gray-400 mt-0.5">{recetaDetalle.descripcion}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setModalAbierto(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors mt-1 flex-shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </DialogHeader>

          {/* Cuerpo del modal */}
          <div className="px-8 py-6">

            {/* Spinner de carga */}
            {cargandoDetalle && (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3 text-gray-400">
                  <div className="h-7 w-7 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-500" />
                  <p className="text-sm">Cargando ingredientes...</p>
                </div>
              </div>
            )}

            {/* Contenido cargado */}
            {!cargandoDetalle && recetaDetalle && (
              <>
                {/* Chips de info general */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {recetaDetalle.cantidad && (
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium
                      bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-100">
                      <ChefHat className="h-3.5 w-3.5" />
                      {recetaDetalle.cantidad} porciones
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium
                    bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100">
                    <Layers className="h-3.5 w-3.5" />
                    {recetaDetalle.detalles?.length || 0} ingredientes
                  </span>
                </div>

                {/* Tabla de ingredientes */}
                {recetaDetalle.detalles && recetaDetalle.detalles.length > 0 ? (
                  <div className="rounded-2xl border border-gray-100 overflow-hidden">
                    {/* Encabezado */}
                    <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                      <p className="col-span-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">#</p>
                      <p className="col-span-6 text-xs font-semibold text-gray-400 uppercase tracking-wide">Insumo</p>
                      <p className="col-span-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Cantidad</p>
                      <p className="col-span-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Unidad</p>
                    </div>

                    {/* Filas */}
                    {recetaDetalle.detalles.map((detalle, i) => (
                      <div
                        key={detalle.id ?? i}
                        className={`grid grid-cols-12 gap-2 px-4 py-3 items-center
                          ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}
                          ${i < (recetaDetalle.detalles?.length ?? 0) - 1 ? "border-b border-gray-100" : ""}`}
                      >
                        <span className="col-span-1 text-xs text-gray-400">{i + 1}</span>

                        <div className="col-span-6 flex items-center gap-2">
                          <div className="h-7 w-7 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                            <Package className="h-3.5 w-3.5 text-orange-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {detalle.insumo?.nombre || `Insumo #${detalle.insumo_id}`}
                            </p>
                            {detalle.insumo?.categoria && (
                              <p className="text-xs text-gray-400">{detalle.insumo.categoria}</p>
                            )}
                          </div>
                        </div>

                        <span className="col-span-2 text-sm font-semibold text-gray-800">
                          {Number(detalle.cantidad).toFixed(2)}
                        </span>

                        <div className="col-span-3 flex items-center gap-1">
                          <Ruler className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />
                          <span className="text-sm text-gray-600">
                            {detalle.unidad_medida?.unidad || `Unidad #${detalle.unidad_id}`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <Layers className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">Esta receta no tiene ingredientes registrados.</p>
                  </div>
                )}

                {/* Acciones del modal */}
                <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl gap-2 border-blue-200 text-blue-600 hover:bg-blue-50"
                    onClick={() => {
                      setModalAbierto(false);
                      navigate(`/recetas/${recetaDetalle.id}/editar`);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                    Editar Receta
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl gap-2 border-gray-200 text-gray-600 hover:bg-gray-50"
                    onClick={() => setModalAbierto(false)}
                  >
                    Cerrar
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo eliminar */}
      <AlertDialog open={!!recetaAEliminar}
        onOpenChange={(open) => { if (!open) setRecetaAEliminar(null); }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar receta?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de eliminar la receta de{" "}
              <span className="font-semibold text-gray-800">
                "{recetaAEliminar?.plato?.nombre}"
              </span>.
              Se eliminarán también todos sus ingredientes. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarEliminar}
              className="bg-red-500 hover:bg-red-600 rounded-xl">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}