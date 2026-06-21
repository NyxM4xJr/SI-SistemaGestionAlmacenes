import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { insumoService, Insumo } from "@/services/insumoServices";
import { getReporteComparativa, descargarReportePDF, descargarReporteExcel, ReporteComparativaItem } from "@/services/reporteComparativaService";
import { FileText, Download, BarChart2, Loader2, FileDown } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import AppHeader from "@/components/AppHeader";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function ReporteComparativa() {
  const navigate = useNavigate();
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [datos, setDatos] = useState<ReporteComparativaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [generandoExcel, setGenerandoExcel] = useState(false);

  // Filtros
  const [insumoId, setInsumoId] = useState<string>("todos");
  const [temporada, setTemporada] = useState<string>("todo año");
  const [anio, setAnio] = useState<string>(new Date().getFullYear().toString());

  useEffect(() => {
    cargarInsumos();
  }, []);

  const cargarInsumos = async () => {
    try {
      const data = await insumoService.getAll();
      setInsumos(data);
    } catch (error) {
      toast.error("No se pudieron cargar los insumos");
    }
  };

  const generarReporte = async () => {
    setLoading(true);
    try {
      const reqInsumo = insumoId !== "todos" ? insumoId : undefined;
      const reqTemporada = temporada !== "todo año" ? temporada : undefined;
      const reqAnio = anio !== "todos" ? anio : undefined;
      
      const data = await getReporteComparativa(reqInsumo, reqTemporada, reqAnio);
      setDatos(data);
      if (data.length === 0) {
        toast.info("No se encontraron datos para los filtros seleccionados");
      }
    } catch (error) {
      toast.error("Error al generar el reporte");
    } finally {
      setLoading(false);
    }
  };

  const handleDescargarPDF = async () => {
    setGenerandoPdf(true);
    try {
      const reqInsumo = insumoId !== "todos" ? insumoId : undefined;
      const reqTemporada = temporada !== "todo año" ? temporada : undefined;
      const reqAnio = anio !== "todos" ? anio : undefined;
      await descargarReportePDF(reqInsumo, reqTemporada, reqAnio);
      toast.success("PDF descargado correctamente");
    } catch (error) {
      toast.error("Error al descargar PDF");
    } finally {
      setGenerandoPdf(false);
    }
  };

  const handleDescargarExcel = async () => {
    setGenerandoExcel(true);
    try {
      const reqInsumo = insumoId !== "todos" ? insumoId : undefined;
      const reqTemporada = temporada !== "todo año" ? temporada : undefined;
      const reqAnio = anio !== "todos" ? anio : undefined;
      await descargarReporteExcel(reqInsumo, reqTemporada, reqAnio);
      toast.success("Excel descargado correctamente");
    } catch (error) {
      toast.error("Error al descargar Excel");
    } finally {
      setGenerandoExcel(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
        <Button
          variant="ghost"
          className="mb-6 gap-2 text-gray-500 hover:text-gray-700 -ml-2"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Button>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <BarChart2 className="h-8 w-8 text-primary" />
            Comparativa de Precios por Temporada
          </h1>
          <p className="text-muted-foreground mt-1">
            Analiza y compara el costo histórico de los insumos entre distintos proveedores y estaciones del año.
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="destructive" 
            className="flex gap-2 bg-red-600 hover:bg-red-700"
            onClick={handleDescargarPDF}
            disabled={generandoPdf || datos.length === 0}
          >
            {generandoPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            PDF
          </Button>
          <Button 
            variant="default" 
            className="flex gap-2 bg-green-600 hover:bg-green-700 text-white"
            onClick={handleDescargarExcel}
            disabled={generandoExcel || datos.length === 0}
          >
            {generandoExcel ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            Excel
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="space-y-2">
          <label className="text-sm font-medium">Insumo</label>
          <Select value={insumoId} onValueChange={setInsumoId}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar insumo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los Insumos</SelectItem>
              {insumos.map((i) => (
                <SelectItem key={i.id} value={i.id.toString()}>{i.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium">Temporada</label>
          <Select value={temporada} onValueChange={setTemporada}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar temporada" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todo año">Todo el Año</SelectItem>
              <SelectItem value="verano">Verano</SelectItem>
              <SelectItem value="otoño">Otoño</SelectItem>
              <SelectItem value="invierno">Invierno</SelectItem>
              <SelectItem value="primavera">Primavera</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Año</label>
          <Select value={anio} onValueChange={setAnio}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar año" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los Años</SelectItem>
              <SelectItem value="2024">2024</SelectItem>
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2026">2026</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end justify-end">
          <Button onClick={generarReporte} disabled={loading} className="w-full md:w-auto px-8">
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Generar Reporte
          </Button>
        </div>
      </div>

      {datos.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm h-[400px]">
          <h3 className="text-lg font-semibold mb-4 text-center">Gráfico de Precios Promedio</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={datos} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="insumo" />
              <YAxis />
              <Tooltip formatter={(value) => [`${value} Bs`, 'Precio Promedio']} />
              <Legend />
              <Bar dataKey="precio_promedio" name="Precio Promedio (Bs)" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Insumo</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Temporada</TableHead>
                <TableHead>Mes</TableHead>
                <TableHead>Año</TableHead>
                <TableHead className="text-right">Precio Promedio (Bs)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {datos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    {loading ? "Cargando datos..." : "Usa los filtros de arriba para generar el reporte"}
                  </TableCell>
                </TableRow>
              ) : (
                datos.map((row, index) => (
                  <TableRow key={index} className="hover:bg-muted/50 transition-colors">
                    <TableCell className="font-medium">{row.insumo}</TableCell>
                    <TableCell>{row.proveedor}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium
                        ${row.temporada === 'Verano' ? 'bg-orange-100 text-orange-800' : ''}
                        ${row.temporada === 'Otoño' ? 'bg-yellow-100 text-yellow-800' : ''}
                        ${row.temporada === 'Invierno' ? 'bg-blue-100 text-blue-800' : ''}
                        ${row.temporada === 'Primavera' ? 'bg-green-100 text-green-800' : ''}
                      `}>
                        {row.temporada}
                      </span>
                    </TableCell>
                    <TableCell>{row.mes}</TableCell>
                    <TableCell>{row.anio}</TableCell>
                    <TableCell className="text-right font-medium">{row.precio_promedio.toFixed(2)} Bs</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      </main>
    </div>
  );
}
