/**
 * ============================================================
 * ARCHIVO: frontend/src/pages/Menus/SugerirMenu.tsx
 * CASO DE USO: CU24 - Consultar Sugerencia de Menú por Temporada
 * CICLO: 4
 * AUTOR: Karen Ortega
 * FECHA: 19/06/26
 *
 * DESCRIPCIÓN: Sugiere platos que conviene priorizar porque usan
 * insumos en temporada (más baratos) o próximos a vencer (evitar
 * desperdicio). Permite agregar un plato sugerido a un menú ya
 * existente, reutilizando MenuService.addPlato() de CU23 — no
 * existe un endpoint de escritura propio para esto.
 * Sigue el patrón visual de MenuList.tsx / MenuDetalle.tsx.
 * ============================================================
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Sparkles,
  Leaf,
  Clock,
  PlusCircle,
  TrendingDown,
} from "lucide-react";

import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import { MenuService, type Menu } from "@/services/menuService";
import {
  getSugerenciaMenu,
  type PlatoSugerido,
  type Temporada,
} from "@/services/sugerenciaMenuService";

const TEMPORADAS: { value: Temporada; label: string }[] = [
  { value: "verano", label: "Verano" },
  { value: "otono", label: "Otoño" },
  { value: "invierno", label: "Invierno" },
  { value: "primavera", label: "Primavera" },
];

const CATEGORIAS = ["Entrada", "Plato Principal", "Postre", "Bebida"];

export default function SugerirMenu() {
  const navigate = useNavigate();

  // ── Estado de filtro y sugerencias ─────────────────────────
  const [temporada, setTemporada] = useState<Temporada | "">("");
  const [platosSugeridos, setPlatosSugeridos] = useState<PlatoSugerido[]>([]);
  const [sinDatosTemporada, setSinDatosTemporada] = useState(false);
  const [loading, setLoading] = useState(true);

  // ── Estado del modal "Agregar a Menú" ──────────────────────
  const [modalAbierto, setModalAbierto] = useState(false);
  const [platoSeleccionado, setPlatoSeleccionado] = useState<PlatoSugerido | null>(null);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [menuDestinoId, setMenuDestinoId] = useState<string>("");
  const [categoriaDestino, setCategoriaDestino] = useState<string>("Plato Principal");
  const [precioVentaDestino, setPrecioVentaDestino] = useState<number>(0);
  const [guardando, setGuardando] = useState(false);

  // ── Cargar sugerencias (temporada actual al inicio) ─────────
  useEffect(() => {
    cargarSugerencias(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargarSugerencias(t: Temporada | undefined) {
    try {
      setLoading(true);
      const data = await getSugerenciaMenu(t);
      setTemporada(data.temporada);
      setPlatosSugeridos(data.platos_sugeridos);
      setSinDatosTemporada(data.sin_datos_temporada);
    } catch (error: unknown) {
      console.error(error);
      toast.error((error as Error).message || "Error al cargar las sugerencias.");
    } finally {
      setLoading(false);
    }
  }

  function handleCambiarTemporada(valor: string) {
    cargarSugerencias(valor as Temporada);
  }

  // ── Abrir modal "Agregar a Menú" ────────────────────────────
  async function abrirModalAgregar(plato: PlatoSugerido) {
    setPlatoSeleccionado(plato);
    setCategoriaDestino("Plato Principal");
    setPrecioVentaDestino(0);
    setMenuDestinoId("");
    setModalAbierto(true);

    try {
      const data = await MenuService.getAll();
      setMenus(data);
    } catch (error: unknown) {
      console.error(error);
      toast.error("No se pudieron cargar los menús disponibles.");
    }
  }

  async function handleConfirmarAgregar() {
    if (!platoSeleccionado || !menuDestinoId) return;

    setGuardando(true);
    try {
      await MenuService.addPlato(Number(menuDestinoId), {
        plato_id: platoSeleccionado.plato_id,
        categoria: categoriaDestino,
        precio_venta: precioVentaDestino,
      });
      toast.success(`"${platoSeleccionado.plato_nombre}" agregado al menú.`);
      setModalAbierto(false);
    } catch (error: unknown) {
      console.error(error);
      toast.error((error as Error).message || "Error al agregar el plato al menú.");
    } finally {
      setGuardando(false);
    }
  }

  function labelTemporada(t: Temporada | "") {
    return TEMPORADAS.find((x) => x.value === t)?.label || "";
  }

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
              <div className="p-4 bg-blue-50 text-blue-600 rounded-xl hidden sm:block">
                <Sparkles className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Sugerencia de Menú por Temporada
                </h1>
                <p className="text-gray-500 mt-1">
                  Platos que conviene priorizar usando insumos en temporada o
                  próximos a vencer.
                </p>
              </div>
            </div>

            <div className="w-full sm:w-48 space-y-1.5">
              <Label className="text-sm">Temporada</Label>
              <Select value={temporada} onValueChange={handleCambiarTemporada}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {TEMPORADAS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* ── Aviso si no hay datos de temporada ── */}
        {!loading && sinDatosTemporada && (
          <div className="bg-orange-50 text-orange-800 p-4 rounded-xl text-sm flex items-start gap-2 border border-orange-200 mb-6">
            <Clock className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              No hay insumos registrados en temporada {labelTemporada(temporada)} en
              POR_ESTACIONES. Mostrando solo sugerencias por insumos próximos a vencer.
            </p>
          </div>
        )}

        {/* ── Cards de platos sugeridos ── */}
        {loading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : platosSugeridos.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 flex flex-col items-center justify-center text-center">
            <Leaf className="h-16 w-16 text-gray-300 mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              No hay sugerencias para esta temporada
            </h2>
            <p className="text-gray-500 max-w-md">
              No se encontraron platos que usen insumos en temporada o próximos a
              vencer en este momento.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {platosSugeridos.map((plato) => (
              <div
                key={plato.plato_id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow flex flex-col"
              >
                <div className="flex flex-wrap gap-2 mb-3">
                  {plato.en_temporada && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium bg-green-100 text-green-700 px-2.5 py-1 rounded-full">
                      <Leaf className="w-3 h-3" />
                      En temporada
                    </span>
                  )}
                  {plato.proximo_vencer && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full">
                      <Clock className="w-3 h-3" />
                      Próximo a vencer
                    </span>
                  )}
                </div>

                <h3 className="text-lg font-bold text-gray-900 mb-3">
                  {plato.plato_nombre}
                </h3>

                <div className="space-y-1.5 mb-4 flex-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Costo estimado</span>
                    <span className="font-medium text-gray-900">
                      Bs. {plato.costo_estimado.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Costo normal</span>
                    <span className="text-gray-400 line-through">
                      Bs. {plato.costo_normal.toFixed(2)}
                    </span>
                  </div>
                  {plato.ahorro > 0 && (
                    <div className="flex justify-between text-sm pt-1">
                      <span className="text-green-600 font-medium flex items-center gap-1">
                        <TrendingDown className="w-3.5 h-3.5" />
                        Ahorro
                      </span>
                      <span className="font-bold text-green-600">
                        Bs. {plato.ahorro.toFixed(2)}
                      </span>
                    </div>
                  )}

                  {(plato.insumos_en_temporada.length > 0 ||
                    plato.insumos_por_vencer.length > 0) && (
                    <p className="text-xs text-gray-400 pt-2 border-t border-gray-100 mt-2">
                      {plato.insumos_en_temporada.length > 0 &&
                        `Temporada: ${plato.insumos_en_temporada.join(", ")}`}
                      {plato.insumos_en_temporada.length > 0 &&
                        plato.insumos_por_vencer.length > 0 &&
                        " · "}
                      {plato.insumos_por_vencer.length > 0 &&
                        `Por vencer: ${plato.insumos_por_vencer.join(", ")}`}
                    </p>
                  )}
                </div>

                <Button
                  onClick={() => abrirModalAgregar(plato)}
                  className="bg-blue-600 hover:bg-blue-700 w-full gap-2"
                >
                  <PlusCircle className="w-4 h-4" />
                  Agregar a Menú
                </Button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── Modal: Agregar a Menú ── */}
      <Dialog open={modalAbierto} onOpenChange={setModalAbierto}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              Agregar "{platoSeleccionado?.plato_nombre}" a un Menú
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Menú destino <span className="text-red-500">*</span></Label>
              <Select value={menuDestinoId} onValueChange={setMenuDestinoId}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Seleccionar menú" />
                </SelectTrigger>
                <SelectContent>
                  {menus.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No hay menús disponibles
                    </SelectItem>
                  ) : (
                    menus.map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>
                        {m.nombre}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Categoría <span className="text-red-500">*</span></Label>
              <Select value={categoriaDestino} onValueChange={setCategoriaDestino}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Precio de Venta (Bs.) <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={precioVentaDestino || ""}
                onChange={(e) => setPrecioVentaDestino(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAbierto(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmarAgregar}
              disabled={!menuDestinoId || menuDestinoId === "none" || guardando}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {guardando ? "Agregando..." : "Agregar al Menú"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}