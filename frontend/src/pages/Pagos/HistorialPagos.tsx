import { useEffect, useState } from "react";
import AppHeader from "@/components/AppHeader";
import { getHistorialPagos, Pago } from "@/services/pagoService";

export default function HistorialPagos() {
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");

  useEffect(() => {
    cargarPagos();
  }, []);

  const cargarPagos = async () => {
    try {
      const data = await getHistorialPagos();
      setPagos(data);
    } catch (error) {
      console.error(error);
    }
  };

  const filtered = pagos.filter((p) => {
    if (filtroEstado === "todos") return true;
    return p.estado === filtroEstado;
  });

  const totalDepositado = pagos
    .filter(p => p.estado === "completado")
    .reduce((acc, p) => acc + parseFloat(p.monto.toString()), 0);

  const pagosCompletados = pagos.filter(p => p.estado === "completado").length;
  const pagosPendientes = pagos.filter(p => p.estado === "pendiente").length;

  return (
    <div className="min-h-screen bg-gradient-soft">
      <AppHeader />

      <main className="container px-4 py-6 md:py-8 max-w-7xl mx-auto">
        
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold">Historial de Pagos</h1>
          <p className="text-muted-foreground">Registro de todos los depósitos realizados</p>
        </div>

        {/* Tarjetas de Resumen */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-card rounded-2xl p-6 shadow-sm border border-black/5">
            <p className="text-sm text-muted-foreground font-semibold uppercase tracking-wider mb-1">Total Depositado</p>
            <p className="text-3xl font-bold text-green-600">{totalDepositado.toFixed(2)} Bs.</p>
          </div>
          <div className="bg-card rounded-2xl p-6 shadow-sm border border-black/5">
            <p className="text-sm text-muted-foreground font-semibold uppercase tracking-wider mb-1">Pagos Completados</p>
            <p className="text-3xl font-bold text-primary">{pagosCompletados}</p>
          </div>
          <div className="bg-card rounded-2xl p-6 shadow-sm border border-black/5">
            <p className="text-sm text-muted-foreground font-semibold uppercase tracking-wider mb-1">Pagos Pendientes</p>
            <p className="text-3xl font-bold text-yellow-600">{pagosPendientes}</p>
          </div>
        </div>

        <div className="mb-4">
          <select 
            className="border rounded-xl px-4 py-2 bg-background shadow-sm"
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
          >
            <option value="todos">Todos los estados</option>
            <option value="completado">Completados</option>
            <option value="pendiente">Pendientes</option>
          </select>
        </div>

        <div className="bg-card rounded-3xl shadow-card overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b bg-secondary/50">
                <th className="p-4 text-left">Fecha</th>
                <th className="p-4 text-left">Usuario</th>
                <th className="p-4 text-left">Descripción</th>
                <th className="p-4 text-right">Monto (Bs.)</th>
                <th className="p-4 text-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((pago) => (
                <tr key={pago.id} className="border-b hover:bg-muted/50 transition">
                  <td className="p-4">
                    {new Date(pago.fecha_creacion).toLocaleString()}
                  </td>
                  <td className="p-4">
                    {pago.usuario ? pago.usuario.nombre : pago.usuario_id}
                  </td>
                  <td className="p-4 text-muted-foreground">
                    {pago.descripcion || "-"}
                  </td>
                  <td className="p-4 text-right font-medium">
                    {parseFloat(pago.monto.toString()).toFixed(2)}
                  </td>
                  <td className="p-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      pago.estado === 'completado' ? 'bg-green-100 text-green-700' : 
                      pago.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-700' : 
                      'bg-red-100 text-red-700'
                    }`}>
                      {pago.estado}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    No se encontraron pagos con los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </main>
    </div>
  );
}
