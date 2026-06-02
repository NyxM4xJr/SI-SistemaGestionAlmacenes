/**
 * ============================================================
 * ARCHIVO: frontend/src/pages/HistorialPrecios/HistorialPrecios.tsx
 * CASO DE USO: CU10 - Historial de Precios
 * CICLO: 2
 * DESCRIPCIÓN: Vista de historial de precios de los insumos.
 *   - Diseño 'Split View' (Panel Izquierdo: Lista, Derecho: Detalles).
 *   - Implementa un buscador en tiempo real de insumos.
 *   - Usa Recharts (LineChart) para graficar la evolución
 *     de precios usando los datos de la tabla 'por_estaciones'.
 * ============================================================
 */

import { useEffect, useState, useMemo } from "react";
import AppHeader from "@/components/AppHeader";
import { Input } from "@/components/ui/input";
import { Insumo, insumoService, HistorialPrecio } from "@/services/insumoServices";
import { Search, Info, TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";

export default function HistorialPrecios() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [search, setSearch] = useState("");
  const [selectedInsumo, setSelectedInsumo] = useState<Insumo | null>(null);
  const [historial, setHistorial] = useState<HistorialPrecio[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    cargarInsumos();
  }, []);

  const cargarInsumos = async () => {
    try {
      const data = await insumoService.getAll();
      setInsumos(data);
    } catch (error) {
      console.error(error);
    }
  };

  const cargarHistorial = async (insumoId: number) => {
    setLoading(true);
    try {
      const data = await insumoService.getHistorialPrecios(insumoId);
      setHistorial(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectInsumo = (insumo: Insumo) => {
    if (selectedInsumo?.id !== insumo.id) {
      setSelectedInsumo(insumo);
      if (insumo.id) {
        cargarHistorial(insumo.id);
      }
    }
  };

  const filteredInsumos = useMemo(() => {
    const term = search.toLowerCase();
    return insumos.filter((i) => i.nombre.toLowerCase().includes(term));
  }, [insumos, search]);

  // Preparar datos para el gráfico (mapear número de mes a nombre)
  const chartData = useMemo(() => {
    const meses = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];
    return historial.map((h) => ({
      ...h,
      mesNombre: meses[h.mes - 1] || `Mes ${h.mes}`,
    }));
  }, [historial]);

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans">
      <AppHeader />
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Panel Izquierdo: Lista de Insumos */}
        <aside className="w-full md:w-80 bg-white border-b md:border-b-0 md:border-r flex flex-col shadow-sm z-10 md:h-full max-h-[40vh] md:max-h-full">
          <div className="p-4 border-b bg-gray-50/50 shrink-0">
            <h2 className="font-bold text-gray-800 mb-3">Buscar Insumo</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Ej. Papa, Zanahoria..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-white"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {filteredInsumos.length === 0 ? (
              <p className="p-4 text-center text-gray-500 text-sm">No se encontraron insumos.</p>
            ) : (
              <ul className="space-y-1">
                {filteredInsumos.map((insumo) => (
                  <li key={insumo.id}>
                    <button
                      onClick={() => handleSelectInsumo(insumo)}
                      className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                        selectedInsumo?.id === insumo.id
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : "text-gray-700 hover:bg-gray-100 border border-transparent"
                      }`}
                    >
                      <div className="font-bold">{insumo.nombre}</div>
                      <div className="text-xs text-gray-500 mt-0.5 font-normal">
                        Categoría: {insumo.categoria || "N/A"}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Panel Derecho: Historial y Gráficos */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 bg-gray-50/50">
          {!selectedInsumo ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center">
                <TrendingUp className="h-12 w-12 text-gray-300" />
              </div>
              <p className="text-lg">Selecciona un insumo para ver su historial de precios</p>
            </div>
          ) : (
            <div className="max-w-5xl mx-auto space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900">{selectedInsumo.nombre}</h2>
                    <p className="text-gray-500 mt-1 flex items-center gap-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {selectedInsumo.categoria}
                      </span>
                      <span>Origen: {selectedInsumo.origen}</span>
                    </p>
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="flex justify-center p-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : historial.length === 0 ? (
                <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center space-y-3">
                  <Info className="h-8 w-8 text-yellow-500 mx-auto" />
                  <p className="text-gray-600">No hay datos históricos registrados para este insumo en la tabla de estaciones.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Gráfico */}
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-blue-600" />
                      Evolución de Precios
                    </h3>
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={chartData}
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                          <XAxis dataKey="mesNombre" stroke="#6B7280" fontSize={12} tickLine={false} />
                          <YAxis 
                            stroke="#6B7280" 
                            fontSize={12} 
                            tickLine={false}
                            tickFormatter={(value) => `Bs. ${value}`}
                          />
                          <Tooltip 
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            formatter={(value: number) => [`Bs. ${value}`, "Precio Promedio"]}
                          />
                          <Legend />
                          <Line 
                            type="monotone" 
                            dataKey="precio_prom" 
                            name="Precio Promedio (Bs.)" 
                            stroke="#2563EB" 
                            strokeWidth={3}
                            dot={{ r: 4, strokeWidth: 2 }}
                            activeDot={{ r: 6, stroke: '#1E40AF', strokeWidth: 2 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Tabla de Datos */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b bg-gray-50">
                      <h3 className="font-bold text-gray-800">Detalle por Estación</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-white text-gray-500 font-medium border-b">
                          <tr>
                            <th className="p-4 font-semibold">Mes</th>
                            <th className="p-4 font-semibold">Temporada</th>
                            <th className="p-4 font-semibold">Precio Promedio</th>
                            <th className="p-4 font-semibold">Comentarios / Notas</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {chartData.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                              <td className="p-4 font-medium text-gray-900">{item.mesNombre}</td>
                              <td className="p-4">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium uppercase
                                  ${item.tipo_temporada.toLowerCase() === 'verano' ? 'bg-orange-100 text-orange-800' : 
                                    item.tipo_temporada.toLowerCase() === 'invierno' ? 'bg-blue-100 text-blue-800' : 
                                    'bg-gray-100 text-gray-800'}`}>
                                  {item.tipo_temporada}
                                </span>
                              </td>
                              <td className="p-4 font-bold text-green-600">
                                Bs. {item.precio_prom.toFixed(2)}
                              </td>
                              <td className="p-4 text-gray-600 italic">
                                {item.comentarios || "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
