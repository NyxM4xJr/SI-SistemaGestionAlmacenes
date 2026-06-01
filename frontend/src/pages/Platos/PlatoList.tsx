/**
 * ============================================================
 * ARCHIVO: frontend/src/pages/Platos/PlatoList.tsx
 * CASO DE USO: CU20 - Gestionar Platos del Menú
 * CICLO: 3
 * AUTOR: Karen Ortega
 * FECHA: 01/06/26
 *
 * DESCRIPCIÓN: Página principal del catálogo de platos.
 * Muestra estadísticas, barra de búsqueda y tabla/cards
 * con toggle de vista. Sigue el patrón de InsumoList.tsx.
 * ============================================================
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  UtensilsCrossed,
  TrendingUp,
  DollarSign,
  ChefHat,
  LayoutGrid,
  LayoutList,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AppHeader from "@/components/AppHeader";

import { type Plato, getPlatos, deletePlato } from "@/services/platoService";

type Vista = "tabla" | "cards";

export default function PlatoList() {
  const navigate = useNavigate();

  const [platos, setPlatos]                 = useState<Plato[]>([]);
  const [filtrados, setFiltrados]           = useState<Plato[]>([]);
  const [busqueda, setBusqueda]             = useState("");
  const [cargando, setCargando]             = useState(true);
  const [eliminandoId, setEliminandoId]     = useState<number | null>(null);
  const [platoAEliminar, setPlatoAEliminar] = useState<Plato | null>(null);
  const [vista, setVista]                   = useState<Vista>("tabla");

  useEffect(() => { cargarPlatos(); }, []);

  async function cargarPlatos() {
    try {
      setCargando(true);
      const data = await getPlatos();
      setPlatos(data);
      setFiltrados(data);
    } catch {
      toast.error("Error al cargar los platos.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    const termino = busqueda.toLowerCase();
    setFiltrados(
      platos.filter(
        (p) =>
          p.nombre.toLowerCase().includes(termino) ||
          p.descripcion?.toLowerCase().includes(termino)
      )
    );
  }, [busqueda, platos]);

  async function confirmarEliminar() {
    if (!platoAEliminar) return;
    try {
      setEliminandoId(platoAEliminar.id);
      await deletePlato(platoAEliminar.id);
      toast.success(`Plato "${platoAEliminar.nombre}" eliminado correctamente.`);
      await cargarPlatos();
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : "Error al eliminar el plato.";
      toast.error(mensaje);
    } finally {
      setEliminandoId(null);
      setPlatoAEliminar(null);
    }
  }

  const costoPromedio =
    platos.length > 0
      ? platos.reduce((acc, p) => acc + Number(p.costo), 0) / platos.length
      : 0;
  const costoMaximo =
    platos.length > 0 ? Math.max(...platos.map((p) => Number(p.costo))) : 0;

  function getBadge(costo: number) {
    if (costo <= 30) return { label: "Económico", color: "text-green-600 bg-green-50 border-green-200", barra: "bg-green-400" };
    if (costo <= 60) return { label: "Estándar",  color: "text-blue-600 bg-blue-50 border-blue-200",   barra: "bg-blue-400"  };
    return              { label: "Premium",    color: "text-orange-600 bg-orange-50 border-orange-200", barra: "bg-orange-400" };
  }

  const spinner = (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3 text-gray-400">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-200 border-t-orange-500" />
        <p className="text-sm">Cargando platos...</p>
      </div>
    </div>
  );

  const estadoVacio = (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
      <UtensilsCrossed className="h-12 w-12 mb-3 text-gray-300" />
      <p className="text-base font-medium text-gray-500">
        {busqueda ? "No se encontraron platos con ese criterio." : "No hay platos registrados."}
      </p>
      {!busqueda && (
        <Button variant="ghost" className="mt-3 text-orange-500 hover:text-orange-600"
          onClick={() => navigate("/platos/nuevo")}>
          Registrar el primer plato
        </Button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Encabezado */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <ChefHat className="h-8 w-8 text-orange-500" />
              Gestionar Platos
            </h1>
            <p className="text-gray-500 mt-1 text-sm">Catálogo de platos del menú gastronómico</p>
          </div>
          <Button onClick={() => navigate("/platos/nuevo")}
            className="bg-orange-500 hover:bg-orange-600 text-white gap-2 rounded-xl px-5">
            <Plus className="h-4 w-4" /> Nuevo Plato
          </Button>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card className="rounded-2xl shadow-sm border-0 bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Total de Platos</CardTitle>
              <UtensilsCrossed className="h-5 w-5 text-orange-400" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">{platos.length}</p>
              <p className="text-xs text-gray-400 mt-1">platos registrados</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm border-0 bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Costo Promedio</CardTitle>
              <DollarSign className="h-5 w-5 text-green-400" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">Bs. {costoPromedio.toFixed(2)}</p>
              <p className="text-xs text-gray-400 mt-1">por plato</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm border-0 bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Plato más Caro</CardTitle>
              <TrendingUp className="h-5 w-5 text-blue-400" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">Bs. {costoMaximo.toFixed(2)}</p>
              <p className="text-xs text-gray-400 mt-1">costo máximo</p>
            </CardContent>
          </Card>
        </div>

        {/* Búsqueda + Toggle */}
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar plato por nombre o descripción..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-10 rounded-xl border-gray-200 bg-white h-11"
            />
          </div>

          <div className="flex rounded-xl border border-gray-200 bg-white overflow-hidden h-11">
            <button
              onClick={() => setVista("tabla")}
              title="Vista de tabla"
              className={`px-3 flex items-center gap-1.5 text-sm transition-colors ${
                vista === "tabla" ? "bg-orange-500 text-white" : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              <LayoutList className="h-4 w-4" />
              <span className="hidden sm:inline">Tabla</span>
            </button>
            <button
              onClick={() => setVista("cards")}
              title="Vista de tarjetas"
              className={`px-3 flex items-center gap-1.5 text-sm transition-colors ${
                vista === "cards" ? "bg-orange-500 text-white" : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Tarjetas</span>
            </button>
          </div>
        </div>

        {/* ── VISTA TABLA ── */}
        {vista === "tabla" && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
            {cargando ? spinner : filtrados.length === 0 ? estadoVacio : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 hover:bg-gray-50">
                      <TableHead className="font-semibold text-gray-600 w-[60px]">#</TableHead>
                      <TableHead className="font-semibold text-gray-600">Nombre</TableHead>
                      <TableHead className="font-semibold text-gray-600 hidden md:table-cell">Descripción</TableHead>
                      <TableHead className="font-semibold text-gray-600">Costo (Bs.)</TableHead>
                      <TableHead className="font-semibold text-gray-600 hidden sm:table-cell">Categoría</TableHead>
                      <TableHead className="font-semibold text-gray-600 text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtrados.map((plato, index) => {
                      const badge = getBadge(Number(plato.costo));
                      return (
                        <TableRow key={plato.id} className="hover:bg-orange-50/40 transition-colors">
                          <TableCell className="text-gray-400 text-sm">{index + 1}</TableCell>
                          <TableCell className="font-medium text-gray-900">{plato.nombre}</TableCell>
                          <TableCell className="text-gray-500 text-sm hidden md:table-cell max-w-xs truncate">
                            {plato.descripcion || <span className="italic text-gray-300">Sin descripción</span>}
                          </TableCell>
                          <TableCell className="font-semibold text-gray-800">
                            {Number(plato.costo).toFixed(2)}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${badge.color}`}>
                              {badge.label}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2 flex-wrap">
                              <Button variant="ghost" size="sm"
                                className="h-8 w-8 p-0 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                                onClick={() => navigate(`/platos/${plato.id}/editar`)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm"
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => setPlatoAEliminar(plato)}
                                disabled={eliminandoId === plato.id}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

        {/* ── VISTA CARDS ── */}
        {vista === "cards" && (
          <>
            {cargando ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100">{spinner}</div>
            ) : filtrados.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100">{estadoVacio}</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtrados.map((plato) => {
                  const badge = getBadge(Number(plato.costo));
                  return (
                    <div key={plato.id}
                      className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden group">

                      {/* Franja de color superior */}
                      <div className={`h-1.5 w-full ${badge.barra}`} />

                      <div className="p-5 flex flex-col flex-1">
                        {/* Badge */}
                        <span className={`self-start text-xs font-medium px-2.5 py-0.5 rounded-full border mb-3 ${badge.color}`}>
                          {badge.label}
                        </span>

                        {/* Nombre */}
                        <h3 className="font-bold text-gray-900 text-base leading-tight mb-1 line-clamp-2">
                          {plato.nombre}
                        </h3>

                        {/* Descripción */}
                        <p className="text-gray-400 text-sm line-clamp-3 flex-1 mb-4">
                          {plato.descripcion || <span className="italic">Sin descripción</span>}
                        </p>

                        {/* Costo + Acciones */}
                        <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100">
                          <span className="text-xl font-bold text-gray-900">
                            <span className="text-sm font-normal text-gray-400 mr-0.5">Bs.</span>
                            {Number(plato.costo).toFixed(2)}
                          </span>

                          {/* Botones visibles al hover */}
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="sm"
                              className="h-8 w-8 p-0 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg"
                              onClick={() => navigate(`/platos/${plato.id}/editar`)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm"
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                              onClick={() => setPlatoAEliminar(plato)}
                              disabled={eliminandoId === plato.id}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Contador */}
        {!cargando && filtrados.length > 0 && (
          <p className="text-xs text-gray-400 mt-3 text-right">
            Mostrando {filtrados.length} de {platos.length} platos
          </p>
        )}
      </main>

      {/* Diálogo eliminar */}
      <AlertDialog open={!!platoAEliminar} onOpenChange={(open) => { if (!open) setPlatoAEliminar(null); }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar plato?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de eliminar{" "}
              <span className="font-semibold text-gray-800">"{platoAEliminar?.nombre}"</span>.
              Esta acción no se puede deshacer. Si el plato tiene recetas asociadas, no podrá eliminarse.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarEliminar} className="bg-red-500 hover:bg-red-600 rounded-xl">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}