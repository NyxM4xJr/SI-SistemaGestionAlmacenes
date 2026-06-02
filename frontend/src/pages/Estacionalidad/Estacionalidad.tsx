/**
 * ============================================================
 * ARCHIVO: frontend/src/pages/Estacionalidad/Estacionalidad.tsx
 * CASO DE USO: CU9 - Gestionar Calendario de Estacionalidad
 * DESCRIPCIÓN: Interfaz para gestionar la temporada, precios y 
 * comentarios mensuales de cada insumo.
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
import { Insumo, insumoService, HistorialPrecio } from "@/services/insumoServices";
import { Search, Calendar, Save, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export default function Estacionalidad() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [search, setSearch] = useState("");
  const [selectedInsumo, setSelectedInsumo] = useState<Insumo | null>(null);
  const [mesesData, setMesesData] = useState<Partial<HistorialPrecio>[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    cargarInsumos();
  }, []);

  const cargarInsumos = async () => {
    try {
      const data = await insumoService.getAll();
      setInsumos(data);
    } catch (error) {
      console.error(error);
      toast.error("Error al cargar los insumos");
    }
  };

  const cargarEstacionalidad = async (insumo: Insumo) => {
    setLoading(true);
    setSelectedInsumo(insumo);
    try {
      const data = await insumoService.getHistorialPrecios(insumo.id!);
      
      // Inicializar el arreglo de 12 meses
      const newData: Partial<HistorialPrecio>[] = Array.from({ length: 12 }, (_, i) => {
        const mesNumber = i + 1;
        const existing = data.find(d => d.mes === mesNumber);
        
        if (existing) {
          return { ...existing };
        }
        
        return {
          mes: mesNumber,
          tipo_temporada: "Media",
          precio_prom: 0,
          comentarios: ""
        };
      });
      
      setMesesData(newData);
    } catch (error: unknown) {
      console.error("Error cargando estacionalidad:", error);
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectInsumo = (insumo: Insumo) => {
    if (selectedInsumo?.id !== insumo.id) {
      cargarEstacionalidad(insumo);
    }
  };

  const filteredInsumos = useMemo(() => {
    const term = search.toLowerCase();
    return insumos.filter((i) => i.nombre.toLowerCase().includes(term));
  }, [insumos, search]);

  const handleChange = (index: number, field: keyof HistorialPrecio, value: string | number) => {
    const newData = [...mesesData];
    newData[index] = { ...newData[index], [field]: value };
    setMesesData(newData);
  };

  const handleSave = async () => {
    if (!selectedInsumo?.id) return;
    
    setSaving(true);
    try {
      await insumoService.updateEstacionalidad(selectedInsumo.id, mesesData);
      toast.success("Calendario de estacionalidad guardado exitosamente");
    } catch (error) {
      console.error(error);
      toast.error("Error al guardar el calendario");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans">
      <AppHeader />
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Panel Izquierdo: Lista de Insumos */}
        <aside className="w-full md:w-80 bg-white border-b md:border-b-0 md:border-r flex flex-col shadow-sm z-10 md:h-full max-h-[40vh] md:max-h-full shrink-0">
          <div className="p-4 border-b bg-gray-50/50 shrink-0">
            <h2 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Calendario
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar insumo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {filteredInsumos.map((insumo) => (
              <button
                key={insumo.id}
                onClick={() => handleSelectInsumo(insumo)}
                className={`w-full text-left p-3 rounded-lg mb-1 transition-all duration-200 border border-transparent ${
                  selectedInsumo?.id === insumo.id
                    ? "bg-blue-50 border-blue-200 shadow-sm"
                    : "hover:bg-gray-100 text-gray-700"
                }`}
              >
                <div className="font-medium text-sm flex justify-between items-center">
                  <span className={selectedInsumo?.id === insumo.id ? "text-blue-700 font-semibold" : ""}>
                    {insumo.nombre}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {insumo.categoria}
                </div>
              </button>
            ))}
            {filteredInsumos.length === 0 && (
              <div className="text-center p-4 text-gray-500 text-sm">
                No se encontraron insumos
              </div>
            )}
          </div>
        </aside>

        {/* Panel Derecho: Calendario */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-4 md:p-8">
          <div className="max-w-5xl mx-auto">
            {!selectedInsumo ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 mt-20">
                <Calendar className="h-16 w-16 mb-4 text-gray-300" />
                <h2 className="text-xl font-medium text-gray-600">Selecciona un Insumo</h2>
                <p className="mt-2 text-sm max-w-md text-center">
                  Elige un insumo de la lista para configurar su disponibilidad, precio promedio y comentarios para cada mes del año.
                </p>
              </div>
            ) : (
              <div className="animate-in fade-in duration-300">
                {/* Cabecera del Insumo */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">
                      {selectedInsumo.nombre}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1 flex gap-4">
                      <span>Categoría: {selectedInsumo.categoria}</span>
                    </p>
                  </div>
                  <Button 
                    onClick={handleSave} 
                    disabled={saving || loading}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? "Guardando..." : "Guardar Calendario"}
                  </Button>
                </div>

                {loading ? (
                  <div className="flex justify-center p-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 bg-gray-50 border-b flex items-center gap-2 text-sm text-gray-600">
                      <AlertCircle className="w-4 h-4 text-blue-500" />
                      Configura la estacionalidad para cada mes. La temporada afectará las alertas de compra.
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left text-gray-600">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                          <tr>
                            <th className="px-6 py-4 rounded-tl-lg">Mes</th>
                            <th className="px-6 py-4">Tipo Temporada</th>
                            <th className="px-6 py-4">Precio Promedio (Bs.)</th>
                            <th className="px-6 py-4 rounded-tr-lg">Comentarios</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mesesData.map((data, idx) => (
                            <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                              <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                                {MESES[idx]}
                              </td>
                              <td className="px-6 py-4">
                                <Select
                                  value={data.tipo_temporada}
                                  onValueChange={(val) => handleChange(idx, "tipo_temporada", val)}
                                >
                                  <SelectTrigger className="w-[140px] bg-white">
                                    <SelectValue placeholder="Seleccionar" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Alta">Temporada Alta</SelectItem>
                                    <SelectItem value="Media">Temporada Media</SelectItem>
                                    <SelectItem value="Baja">Temporada Baja</SelectItem>
                                    <SelectItem value="Nula">Nula / Escasa</SelectItem>
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="px-6 py-4">
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  value={data.precio_prom || ""}
                                  onChange={(e) => handleChange(idx, "precio_prom", parseFloat(e.target.value) || 0)}
                                  className="w-[120px] bg-white"
                                  placeholder="Ej. 12.5"
                                />
                              </td>
                              <td className="px-6 py-4">
                                <Input
                                  type="text"
                                  value={data.comentarios || ""}
                                  onChange={(e) => handleChange(idx, "comentarios", e.target.value)}
                                  className="w-full min-w-[200px] bg-white"
                                  placeholder="Observaciones..."
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
