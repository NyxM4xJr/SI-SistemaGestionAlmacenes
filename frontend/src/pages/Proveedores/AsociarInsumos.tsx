/**
 * ============================================================
 * ARCHIVO: frontend/src/pages/Proveedores/AsociarInsumos.tsx
 * CASO DE USO: CU18 - Asociar Insumos a Proveedores
 * DESCRIPCIÓN: Interfaz maestro-detalle para vincular insumos 
 * con proveedores, definiendo precios de compra, calidad y notas.
 * ============================================================
 */
import { useEffect, useState, useMemo } from "react";
import AppHeader from "@/components/AppHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Proveedor, ProveedorInsumo, ProveedorService } from "@/services/proveedorService";
import { Insumo, insumoService } from "@/services/insumoServices";
import { Search, Link, Trash2, PlusCircle, Building2 } from "lucide-react";
import { toast } from "sonner";

export default function AsociarInsumos() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [search, setSearch] = useState("");
  const [selectedProveedor, setSelectedProveedor] = useState<Proveedor | null>(null);
  
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  
  // Formulario para nueva asociación
  const [newInsumoId, setNewInsumoId] = useState<string>("");
  const [newPrecio, setNewPrecio] = useState<number>(0);
  const [newCalificacion, setNewCalificacion] = useState<string>("Buena");
  const [newNota, setNewNota] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      const [provData, insData] = await Promise.all([
        ProveedorService.getAll(),
        insumoService.getAll()
      ]);
      setProveedores(provData);
      setInsumos(insData);
    } catch (error) {
      console.error(error);
      toast.error("Error al cargar datos");
    }
  };

  const handleSelectProveedor = (prov: Proveedor) => {
    setSelectedProveedor(prov);
    // Limpiar formulario al cambiar de proveedor
    setNewInsumoId("");
    setNewPrecio(0);
    setNewCalificacion("Buena");
    setNewNota("");
  };

  const filteredProveedores = useMemo(() => {
    const term = search.toLowerCase();
    return proveedores.filter((p) => p.nombre.toLowerCase().includes(term));
  }, [proveedores, search]);

  // Filtrar insumos que aún NO están asociados al proveedor actual
  const insumosDisponibles = useMemo(() => {
    if (!selectedProveedor) return [];
    const asociadosIds = selectedProveedor.proveedor_insumo?.map(pi => pi.insumo_id) || [];
    return insumos.filter(i => !asociadosIds.includes(i.id!));
  }, [insumos, selectedProveedor]);

  const handleAsociar = async () => {
    if (!selectedProveedor || !newInsumoId) return;
    
    setSaving(true);
    try {
      const nuevaAsociacion = await ProveedorService.asociarInsumo(selectedProveedor.id, {
        insumo_id: parseInt(newInsumoId),
        precio: newPrecio,
        calificacion: newCalificacion,
        nota: newNota
      });
      
      // Actualizar el estado localmente para no hacer refetch de todo
      const provUpdated = { ...selectedProveedor };
      provUpdated.proveedor_insumo = [...(provUpdated.proveedor_insumo || []), nuevaAsociacion];
      
      setSelectedProveedor(provUpdated);
      
      // Actualizar en la lista general también
      setProveedores(prev => prev.map(p => p.id === provUpdated.id ? provUpdated : p));
      
      toast.success("Insumo asociado correctamente");
      setNewInsumoId("");
      setNewPrecio(0);
      setNewNota("");
    } catch (error: unknown) {
      console.error(error);
      toast.error((error as Error).message || "Error al asociar el insumo");
    } finally {
      setSaving(false);
    }
  };

  const handleDesasociar = async (insumoId: number) => {
    if (!selectedProveedor) return;
    if (!confirm("¿Estás seguro de eliminar esta asociación?")) return;

    try {
      await ProveedorService.desasociarInsumo(selectedProveedor.id, insumoId);
      
      // Actualizar estado local
      const provUpdated = { ...selectedProveedor };
      provUpdated.proveedor_insumo = provUpdated.proveedor_insumo?.filter(pi => pi.insumo_id !== insumoId);
      
      setSelectedProveedor(provUpdated);
      setProveedores(prev => prev.map(p => p.id === provUpdated.id ? provUpdated : p));
      
      toast.success("Asociación eliminada");
    } catch (error) {
      console.error(error);
      toast.error("Error al eliminar la asociación");
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans">
      <AppHeader />
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Panel Izquierdo: Lista de Proveedores */}
        <aside className="w-full md:w-80 bg-white border-b md:border-b-0 md:border-r flex flex-col shadow-sm z-10 md:h-full max-h-[40vh] md:max-h-full shrink-0">
          <div className="p-4 border-b bg-gray-50/50 shrink-0">
            <h2 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              Proveedores
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar proveedor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {filteredProveedores.map((prov) => (
              <button
                key={prov.id}
                onClick={() => handleSelectProveedor(prov)}
                className={`w-full text-left p-3 rounded-lg mb-1 transition-all duration-200 border border-transparent ${
                  selectedProveedor?.id === prov.id
                    ? "bg-blue-50 border-blue-200 shadow-sm"
                    : "hover:bg-gray-100 text-gray-700"
                }`}
              >
                <div className="font-medium text-sm text-gray-900">
                  {prov.nombre}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {prov.proveedor_insumo?.length || 0} insumos asociados
                </div>
              </button>
            ))}
            {filteredProveedores.length === 0 && (
              <div className="text-center p-4 text-gray-500 text-sm">
                No se encontraron proveedores
              </div>
            )}
          </div>
        </aside>

        {/* Panel Derecho: Asociación de Insumos */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-4 md:p-8">
          <div className="max-w-4xl mx-auto">
            {!selectedProveedor ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 mt-20">
                <Link className="h-16 w-16 mb-4 text-gray-300" />
                <h2 className="text-xl font-medium text-gray-600">Selecciona un Proveedor</h2>
                <p className="mt-2 text-sm max-w-md text-center">
                  Selecciona un proveedor de la lista para ver los insumos que nos provee y asociar nuevos.
                </p>
              </div>
            ) : (
              <div className="animate-in fade-in duration-300 space-y-6">
                
                {/* Cabecera del Proveedor */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    {selectedProveedor.nombre}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Contacto: {selectedProveedor.contacto || "N/A"} | Email: {selectedProveedor.email || "N/A"}
                  </p>
                </div>

                {/* Formulario para Asociar Nuevo Insumo */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <PlusCircle className="w-5 h-5 text-green-600" />
                    Asociar Nuevo Insumo
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="md:col-span-2 space-y-2">
                      <Label>Insumo</Label>
                      <Select value={newInsumoId} onValueChange={setNewInsumoId}>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Seleccionar insumo" />
                        </SelectTrigger>
                        <SelectContent>
                          {insumosDisponibles.length === 0 ? (
                            <SelectItem value="none" disabled>No hay insumos disponibles</SelectItem>
                          ) : (
                            insumosDisponibles.map(i => (
                              <SelectItem key={i.id} value={i.id!.toString()}>{i.nombre}</SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Precio (Bs.)</Label>
                      <Input 
                        type="number" 
                        min="0" step="0.1" 
                        value={newPrecio || ""}
                        onChange={(e) => setNewPrecio(parseFloat(e.target.value) || 0)}
                        placeholder="Ej. 15.5"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Calificación</Label>
                      <Select value={newCalificacion} onValueChange={setNewCalificacion}>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Calidad" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Excelente">Excelente</SelectItem>
                          <SelectItem value="Buena">Buena</SelectItem>
                          <SelectItem value="Regular">Regular</SelectItem>
                          <SelectItem value="Mala">Mala</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="md:col-span-3 space-y-2">
                      <Label>Nota / Observación</Label>
                      <Input 
                        type="text" 
                        value={newNota}
                        onChange={(e) => setNewNota(e.target.value)}
                        placeholder="Ej. Entregas solo los martes..."
                      />
                    </div>

                    <Button 
                      onClick={handleAsociar} 
                      disabled={!newInsumoId || newInsumoId === "none" || saving}
                      className="bg-green-600 hover:bg-green-700 w-full"
                    >
                      {saving ? "Asociando..." : "Asociar"}
                    </Button>
                  </div>
                </div>

                {/* Lista de Insumos Asociados */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-4 bg-gray-50 border-b">
                    <h3 className="font-bold text-gray-800">Insumos Asociados a este Proveedor</h3>
                  </div>
                  
                  {(!selectedProveedor.proveedor_insumo || selectedProveedor.proveedor_insumo.length === 0) ? (
                    <div className="p-8 text-center text-gray-500 text-sm">
                      Este proveedor no tiene insumos asociados actualmente.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left text-gray-600">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                          <tr>
                            <th className="px-6 py-4">Insumo</th>
                            <th className="px-6 py-4">Precio (Bs.)</th>
                            <th className="px-6 py-4">Calificación</th>
                            <th className="px-6 py-4">Nota</th>
                            <th className="px-6 py-4 text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedProveedor.proveedor_insumo.map((pi) => (
                            <tr key={pi.id} className="border-b last:border-0 hover:bg-gray-50">
                              <td className="px-6 py-4 font-medium text-gray-900">
                                {pi.insumo?.nombre || `Insumo #${pi.insumo_id}`}
                              </td>
                              <td className="px-6 py-4">{pi.precio}</td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium
                                  ${pi.calificacion === 'Excelente' ? 'bg-green-100 text-green-800' : 
                                    pi.calificacion === 'Buena' ? 'bg-blue-100 text-blue-800' :
                                    pi.calificacion === 'Regular' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-red-100 text-red-800'
                                  }`}>
                                  {pi.calificacion}
                                </span>
                              </td>
                              <td className="px-6 py-4 max-w-[200px] truncate" title={pi.nota}>
                                {pi.nota || "-"}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleDesasociar(pi.insumo_id)}
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
