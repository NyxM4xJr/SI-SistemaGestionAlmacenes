/**
 * ============================================================
 * ARCHIVO: frontend/src/pages/Menus/MenuDetalle.tsx
 * CASO DE USO: CU23 - Gestionar Menú
 * DESCRIPCIÓN: Vista de detalle para asociar platos a un menú,
 * agrupándolos por categoría (Entrada, Plato Principal, etc.)
 * e incluyendo validación visual del costo base vs precio de venta.
 * ============================================================
 */
import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import { Menu, DetalleMenu, MenuService } from "@/services/menuService";
import { Plato, getPlatos } from "@/services/platoService";
import { UtensilsCrossed, ArrowLeft, PlusCircle, Trash2, AlertTriangle, Calendar, FileText } from "lucide-react";
import { toast } from "sonner";

const CATEGORIAS = ["Entrada", "Plato Principal", "Postre", "Bebida"];

export default function MenuDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [menu, setMenu] = useState<Menu | null>(null);
  const [platos, setPlatos] = useState<Plato[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Formulario para asociar plato
  const [newPlatoId, setNewPlatoId] = useState<string>("");
  const [newCategoria, setNewCategoria] = useState<string>("Plato Principal");
  const [newPrecio, setNewPrecio] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) {
      cargarDatos(parseInt(id));
    }
  }, [id]);

  const cargarDatos = async (menuId: number) => {
    try {
      setLoading(true);
      const [menuData, platosData] = await Promise.all([
        MenuService.getById(menuId),
        getPlatos()
      ]);
      setMenu(menuData);
      setPlatos(platosData);
    } catch (error: unknown) {
      console.error(error);
      toast.error((error as Error).message || "Error al cargar datos");
      navigate("/menus");
    } finally {
      setLoading(false);
    }
  };

  // Cuando se selecciona un plato, pre-completar el precio de venta con el costo
  const handleSelectPlato = (val: string) => {
    setNewPlatoId(val);
    const selected = platos.find(p => p.id.toString() === val);
    if (selected) {
      setNewPrecio(selected.costo);
    }
  };

  const selectedPlatoInfo = useMemo(() => {
    if (!newPlatoId) return null;
    return platos.find(p => p.id.toString() === newPlatoId);
  }, [newPlatoId, platos]);

  const platosDisponibles = useMemo(() => {
    if (!menu) return [];
    const asociadosIds = menu.detalle_menu?.map(d => d.plato_id) || [];
    return platos.filter(p => !asociadosIds.includes(p.id));
  }, [platos, menu]);

  // Agrupar platos por categoría para mostrarlos como carta
  const platosAgrupados = useMemo(() => {
    if (!menu?.detalle_menu) return {};
    const grupos: Record<string, DetalleMenu[]> = {};
    
    // Inicializar los grupos en orden
    CATEGORIAS.forEach(cat => grupos[cat] = []);
    
    menu.detalle_menu.forEach(detalle => {
      const cat = detalle.categoria || "Otros";
      if (!grupos[cat]) grupos[cat] = [];
      grupos[cat].push(detalle);
    });
    
    return grupos;
  }, [menu]);

  const handleAddPlato = async () => {
    if (!menu?.id || !newPlatoId) return;
    
    setSaving(true);
    try {
      const nuevoDetalle = await MenuService.addPlato(menu.id, {
        plato_id: parseInt(newPlatoId),
        categoria: newCategoria,
        precio_venta: newPrecio
      });
      
      const menuUpdated = { ...menu };
      menuUpdated.detalle_menu = [...(menuUpdated.detalle_menu || []), nuevoDetalle];
      setMenu(menuUpdated);
      
      toast.success("Plato agregado al menú");
      setNewPlatoId("");
      setNewPrecio(0);
    } catch (error: unknown) {
      console.error(error);
      toast.error((error as Error).message || "Error al añadir el plato");
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePlato = async (detalleId: number) => {
    if (!menu?.id) return;
    if (!confirm("¿Deseas remover este plato del menú?")) return;
    
    try {
      await MenuService.removePlato(menu.id, detalleId);
      
      const menuUpdated = { ...menu };
      menuUpdated.detalle_menu = menuUpdated.detalle_menu?.filter(d => d.id !== detalleId);
      setMenu(menuUpdated);
      
      toast.success("Plato removido");
    } catch (error: unknown) {
      console.error(error);
      toast.error((error as Error).message || "Error al remover el plato");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <AppHeader />
        <div className="flex-1 flex justify-center items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!menu) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <AppHeader />
      
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <Button 
          variant="ghost" 
          onClick={() => navigate("/menus")}
          className="mb-6 -ml-4 text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a Menús
        </Button>
        
        {/* Cabecera del Menú */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
          <div className="flex items-start gap-4">
            <div className="p-4 bg-blue-50 text-blue-600 rounded-xl hidden sm:block">
              <UtensilsCrossed className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{menu.nombre}</h1>
              <div className="flex flex-wrap gap-4 mt-3">
                {menu.temporada && (
                  <div className="flex items-center text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                    <Calendar className="w-4 h-4 mr-2" />
                    {menu.temporada}
                  </div>
                )}
                {menu.descripcion && (
                  <div className="flex items-center text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                    <FileText className="w-4 h-4 mr-2" />
                    {menu.descripcion}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Panel Izquierdo: Formulario de Asociación */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 sticky top-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-green-600" />
                Añadir Plato
              </h3>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Plato <span className="text-red-500">*</span></Label>
                  <Select value={newPlatoId} onValueChange={handleSelectPlato}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Seleccionar plato" />
                    </SelectTrigger>
                    <SelectContent>
                      {platosDisponibles.length === 0 ? (
                        <SelectItem value="none" disabled>No hay platos disponibles</SelectItem>
                      ) : (
                        platosDisponibles.map(p => (
                          <SelectItem key={p.id} value={p.id.toString()}>{p.nombre}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Categoría <span className="text-red-500">*</span></Label>
                  <Select value={newCategoria} onValueChange={setNewCategoria}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Precio de Venta (Bs.) <span className="text-red-500">*</span></Label>
                  <Input 
                    type="number" 
                    min="0" step="0.5" 
                    value={newPrecio || ""}
                    onChange={(e) => setNewPrecio(parseFloat(e.target.value) || 0)}
                  />
                  {selectedPlatoInfo && (
                    <p className="text-xs text-gray-500 mt-1">
                      Costo base: Bs. {selectedPlatoInfo.costo}
                    </p>
                  )}
                </div>

                {/* Validación Visual de Costo vs Precio */}
                {selectedPlatoInfo && newPrecio < selectedPlatoInfo.costo && (
                  <div className="bg-orange-50 text-orange-800 p-3 rounded-lg text-sm flex items-start gap-2 border border-orange-200">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <p>El precio de venta es menor al costo de producción (Bs. {selectedPlatoInfo.costo}).</p>
                  </div>
                )}

                <Button 
                  onClick={handleAddPlato} 
                  disabled={!newPlatoId || newPlatoId === "none" || saving}
                  className="bg-green-600 hover:bg-green-700 w-full mt-4"
                >
                  {saving ? "Añadiendo..." : "Añadir al Menú"}
                </Button>
              </div>
            </div>
          </div>

          {/* Panel Derecho: La Carta del Menú */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[500px]">
              <div className="p-6 border-b border-gray-100 bg-gray-50/50 text-center">
                <h2 className="font-serif text-2xl text-gray-800 tracking-wider uppercase">La Carta</h2>
              </div>
              
              <div className="p-6 sm:p-8 space-y-10">
                {(!menu.detalle_menu || menu.detalle_menu.length === 0) ? (
                  <div className="text-center text-gray-400 py-12">
                    <UtensilsCrossed className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>Este menú aún no tiene platos asociados.</p>
                  </div>
                ) : (
                  Object.entries(platosAgrupados).map(([categoria, detalles]) => {
                    if (detalles.length === 0) return null;
                    
                    return (
                      <div key={categoria} className="space-y-4">
                        <h3 className="font-serif text-xl text-gray-800 border-b-2 border-gray-100 pb-2">
                          {categoria}
                        </h3>
                        <div className="space-y-4">
                          {detalles.map((detalle) => (
                            <div key={detalle.id} className="flex justify-between items-start group">
                              <div className="flex-1 pr-4">
                                <div className="flex justify-between items-baseline">
                                  <h4 className="font-medium text-gray-900 text-lg">
                                    {detalle.plato?.nombre}
                                  </h4>
                                  <div className="flex items-center gap-4">
                                    <span className="font-bold text-gray-900 shrink-0">
                                      Bs. {detalle.precio_venta}
                                    </span>
                                    <Button 
                                      variant="ghost" 
                                      size="icon"
                                      onClick={() => handleRemovePlato(detalle.id)}
                                      className="text-red-400 hover:text-red-600 hover:bg-red-50 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                      title="Remover plato"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                                <div className="border-b border-dotted border-gray-300 mt-1 mb-1 w-full"></div>
                                {detalle.plato?.costo && (
                                  <p className="text-xs text-gray-400">
                                    Margen: Bs. {(detalle.precio_venta - detalle.plato.costo).toFixed(2)}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
          
        </div>
      </main>
    </div>
  );
}
