import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, TrendingDown, Sparkles, Truck, Replace, Mail } from "lucide-react";

import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { getCatalogos } from "@/services/recetaService";
import {
  optimizarReceta,
  enviarContrapropuesta,
  type OptimizacionRecetaResponse,
} from "@/services/optimizacionRecetaService";

export default function OptimizarReceta() {
  const navigate = useNavigate();

  const [platos, setPlatos] = useState<{ id: number; nombre: string }[]>([]);
  const [platoId, setPlatoId] = useState<string>("");
  const [resultado, setResultado] = useState<OptimizacionRecetaResponse | null>(null);
  const [cargando, setCargando] = useState(false);
  const [enviandoIdx, setEnviandoIdx] = useState<number | null>(null);

  useEffect(() => {
    getCatalogos()
      .then((data) => setPlatos(data.platos))
      .catch((error: unknown) => {
        console.error(error);
        toast.error("Error al cargar el catálogo de platos.");
      });
  }, []);

  const optimizar = async () => {
    if (!platoId) {
      toast.error("Seleccioná un plato primero.");
      return;
    }
    try {
      setCargando(true);
      setResultado(null);
      const data = await optimizarReceta(Number(platoId));
      setResultado(data);
    } catch (error: unknown) {
      console.error(error);
      toast.error((error as Error).message || "Error al optimizar la receta.");
    } finally {
      setCargando(false);
    }
  };

  const handleContrapropuesta = async (idx: number) => {
    const s = resultado?.sustituciones[idx];
    if (!s?.proveedor_actual) return;
    try {
      setEnviandoIdx(idx);
      const res = await enviarContrapropuesta(s.insumo_id, s.proveedor_actual.id);
      toast.success(`Contrapropuesta enviada a ${res.destinatario}.`);
    } catch (error: unknown) {
      console.error(error);
      toast.error((error as Error).message || "Error al enviar la contrapropuesta.");
    } finally {
      setEnviandoIdx(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <AppHeader />

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/recetas")}
          className="mb-6 -ml-4 text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a Recetas
        </Button>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Optimizar Receta con IA
              </h1>
              <p className="text-gray-500 mt-1">
                Busca insumos comprados a un proveedor más caro que el
                disponible, y sustituciones de insumo validadas por IA.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <Select value={platoId} onValueChange={setPlatoId}>
              <SelectTrigger className="rounded-xl h-11 sm:w-72">
                <SelectValue placeholder="Seleccioná un plato" />
              </SelectTrigger>
              <SelectContent>
                {platos.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={optimizar}
              disabled={cargando || !platoId}
              className="rounded-xl h-11 px-4"
            >
              {cargando ? "Optimizando..." : "Optimizar"}
            </Button>
          </div>
        </div>

        {cargando && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-500" />
            <p className="text-sm">Analizando proveedores y alternativas más baratas...</p>
          </div>
        )}

        {!cargando && resultado && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="rounded-2xl shadow-sm border border-gray-200">
                <CardContent className="p-5">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                    Costo actual
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {resultado.costo_actual.toFixed(2)} Bs
                  </p>
                </CardContent>
              </Card>
              <Card className="rounded-2xl shadow-sm border border-gray-200">
                <CardContent className="p-5">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                    Costo proyectado
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {resultado.costo_proyectado.toFixed(2)} Bs
                  </p>
                </CardContent>
              </Card>
              <Card className="rounded-2xl shadow-sm border border-green-200 bg-green-50">
                <CardContent className="p-5">
                  <p className="text-xs font-medium text-green-600 uppercase tracking-wide mb-1 flex items-center gap-1">
                    <TrendingDown className="w-3.5 h-3.5" />
                    Ahorro
                  </p>
                  <p className="text-2xl font-bold text-green-700">
                    {resultado.ahorro_total.toFixed(2)} Bs
                    <span className="text-sm font-medium ml-1">
                      ({resultado.ahorro_porcentaje.toFixed(1)}%)
                    </span>
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                Resumen
              </p>
              <p className="text-sm text-gray-700">{resultado.resumen}</p>
            </div>

            {resultado.sustituciones.length > 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-5 py-3">Tipo</th>
                      <th className="text-left px-5 py-3">Insumo original</th>
                      <th className="text-left px-5 py-3">Sugerido</th>
                      <th className="text-right px-5 py-3">Costo original</th>
                      <th className="text-right px-5 py-3">Costo sugerido</th>
                      <th className="text-right px-5 py-3">Impacto en el plato</th>
                      <th className="text-right px-5 py-3">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.sustituciones.map((s, idx) => (
                      <tr key={idx} className="border-t border-gray-100">
                        <td className="px-5 py-3">
                          {s.tipo === "proveedor" ? (
                            <Badge className="bg-blue-100 text-blue-700 border-0 gap-1">
                              <Truck className="w-3 h-3" />
                              Cambiar proveedor
                            </Badge>
                          ) : (
                            <Badge className="bg-indigo-100 text-indigo-700 border-0 gap-1">
                              <Replace className="w-3 h-3" />
                              Sustituir insumo
                            </Badge>
                          )}
                        </td>
                        <td className="px-5 py-3 text-gray-900">{s.insumo_original}</td>
                        <td className="px-5 py-3 text-gray-900">
                          {s.insumo_sugerido}
                          {s.proveedor_sugerido && (
                            <span className="block text-xs text-gray-400">
                              {s.proveedor_sugerido}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right text-gray-500">
                          {s.costo_original.toFixed(2)} Bs
                        </td>
                        <td className="px-5 py-3 text-right text-gray-500">
                          {s.costo_sugerido.toFixed(2)} Bs
                        </td>
                        <td className="px-5 py-3 text-right text-green-600 font-medium">
                          {s.ahorro_plato.toFixed(2)} Bs
                        </td>
                        <td className="px-5 py-3 text-right">
                          {s.tipo === "proveedor" && s.proveedor_actual?.email && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-lg h-8 gap-1.5 text-xs"
                              disabled={enviandoIdx === idx}
                              onClick={() => handleContrapropuesta(idx)}
                            >
                              <Mail className="w-3.5 h-3.5" />
                              {enviandoIdx === idx ? "Enviando..." : "Enviar contrapropuesta"}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-500">
                No se encontraron sustituciones que reduzcan el costo de esta receta.
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
