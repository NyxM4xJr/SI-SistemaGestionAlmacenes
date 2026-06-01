/**
 * ============================================================
 * ARCHIVO: frontend/src/pages/Menus/MenuList.tsx
 * CASO DE USO: CU23 - Gestionar Menú
 * DESCRIPCIÓN: Vista principal para listar todos los menús
 * creados, permitiendo crear nuevos o eliminarlos.
 * ============================================================
 */
import { useEffect, useState } from "react";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Menu, MenuService } from "@/services/menuService";
import { PlusCircle, UtensilsCrossed, Calendar, FileText, ArrowRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function MenuList() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal de creacion
  const [openDialog, setOpenDialog] = useState(false);
  const [newNombre, setNewNombre] = useState("");
  const [newTemporada, setNewTemporada] = useState("");
  const [newDescripcion, setNewDescripcion] = useState("");
  const [saving, setSaving] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    cargarMenus();
  }, []);

  const cargarMenus = async () => {
    try {
      setLoading(true);
      const data = await MenuService.getAll();
      setMenus(data);
    } catch (error) {
      console.error(error);
      toast.error("Error al cargar los menús");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newNombre.trim()) {
      toast.error("El nombre del menú es obligatorio");
      return;
    }
    
    setSaving(true);
    try {
      const nuevo = await MenuService.create({
        nombre: newNombre,
        temporada: newTemporada,
        descripcion: newDescripcion
      });
      toast.success("Menú creado exitosamente");
      setOpenDialog(false);
      setNewNombre("");
      setNewTemporada("");
      setNewDescripcion("");
      
      // Navegar directo al detalle del menú recién creado
      navigate(`/menus/${nuevo.id}`);
    } catch (error: unknown) {
      console.error(error);
      toast.error((error as Error).message || "Error al crear el menú");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation(); // Evitar que el clic abra la tarjeta
    if (!confirm("¿Estás seguro de eliminar este menú? Se eliminarán todos sus platos asociados.")) return;
    
    try {
      await MenuService.delete(id);
      setMenus(prev => prev.filter(m => m.id !== id));
      toast.success("Menú eliminado");
    } catch (error: unknown) {
      console.error(error);
      toast.error((error as Error).message || "Error al eliminar");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <AppHeader />
      
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gestión de Menús</h1>
            <p className="text-gray-500 mt-1">
              Crea y administra los diferentes menús o cartas del restaurante.
            </p>
          </div>
          <Button 
            onClick={() => setOpenDialog(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <PlusCircle className="w-5 h-5 mr-2" />
            Nuevo Menú
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : menus.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 flex flex-col items-center justify-center text-center">
            <UtensilsCrossed className="h-16 w-16 text-gray-300 mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">No hay menús registrados</h2>
            <p className="text-gray-500 max-w-md mb-6">
              Comienza creando tu primer menú para poder asociarle platos, definir precios y organizar tu oferta gastronómica.
            </p>
            <Button onClick={() => setOpenDialog(true)} variant="outline">
              Crear mi primer menú
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {menus.map((menu) => (
              <div 
                key={menu.id} 
                onClick={() => navigate(`/menus/${menu.id}`)}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer group flex flex-col"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                    <UtensilsCrossed className="w-6 h-6" />
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={(e) => handleDelete(e, menu.id!)}
                    className="text-gray-400 hover:text-red-600 hover:bg-red-50 -mr-2 -mt-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                
                <h3 className="text-xl font-bold text-gray-900 mb-2">{menu.nombre}</h3>
                
                <div className="space-y-2 mb-4 flex-1">
                  {menu.temporada && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                      {menu.temporada}
                    </div>
                  )}
                  {menu.descripcion && (
                    <div className="flex items-start text-sm text-gray-600">
                      <FileText className="w-4 h-4 mr-2 mt-0.5 text-gray-400 shrink-0" />
                      <span className="line-clamp-2">{menu.descripcion}</span>
                    </div>
                  )}
                </div>
                
                <div className="pt-4 border-t border-gray-100 flex items-center justify-between text-blue-600 font-medium text-sm">
                  <span>Gestionar platos</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Menú</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Nombre del Menú <span className="text-red-500">*</span></Label>
              <Input 
                placeholder="Ej. Menú Ejecutivo, Carta Principal..." 
                value={newNombre}
                onChange={(e) => setNewNombre(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Temporada / Vigencia</Label>
              <Input 
                placeholder="Ej. Verano 2026, Fines de semana..." 
                value={newTemporada}
                onChange={(e) => setNewTemporada(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input 
                placeholder="Breve descripción del menú" 
                value={newDescripcion}
                onChange={(e) => setNewDescripcion(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={saving || !newNombre.trim()}>
              {saving ? "Creando..." : "Crear Menú"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
