import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { RefreshCw, Search, CheckCircle2, XCircle } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { useAuth } from "@/context/AuthContext";
import {
  getHistorialPagos,
  capturarPayPal,
  obtenerEstadoPayPal,
  aprobarPagoManual,
  rechazarPagoManual,
  Pago,
} from "@/services/pagoService";

export default function HistorialPagos() {
  const { user } = useAuth();
  const esAdmin = user?.rol === "administrador";
  const [searchParams, setSearchParams] = useSearchParams();
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [verificandoId, setVerificandoId] = useState<number | null>(null);
  const [aprobandoId, setAprobandoId] = useState<number | null>(null);

  useEffect(() => {
    cargarPagos();
  }, []);

  // Retorno de PayPal: capturar la orden y marcar el pago como completado
  useEffect(() => {
    const capturar = searchParams.get("paypal_capturar");
    const orderId = searchParams.get("token"); // PayPal añade ?token=<order_id>
    if (capturar !== "1" || !orderId) return;

    (async () => {
      try {
        const res = await capturarPayPal(orderId);
        if (res.status === "COMPLETED") {
          toast.success("Depósito con PayPal completado.");
        } else {
          toast.warning(`El pago de PayPal quedó en estado: ${res.status}.`);
        }
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "No se pudo capturar el pago de PayPal.");
      } finally {
        setSearchParams({}, { replace: true });
        cargarPagos();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const cargarPagos = async () => {
    try {
      const data = await getHistorialPagos();
      setPagos(data);
    } catch (error) {
      console.error(error);
    }
  };

  // Verificación manual: útil cuando el webhook de PayPal (sandbox) no
  // confirma el pago solo, o el usuario cerró la pestaña antes de volver.
  async function handleVerificar(pago: Pago) {
    if (!pago.paypal_order_id) return;
    try {
      setVerificandoId(pago.id);
      const res = await capturarPayPal(pago.paypal_order_id);
      if (res.status === "COMPLETED") {
        toast.success("Pago confirmado: PayPal completó el depósito.");
      } else {
        toast.info(`El pago aún no está aprobado en PayPal (estado: ${res.status}).`);
      }
      await cargarPagos();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "No se pudo verificar el pago.");
    } finally {
      setVerificandoId(null);
    }
  }

  // Diagnóstico: consulta el estado REAL en PayPal sin capturar nada
  async function handleVerEstado(pago: Pago) {
    if (!pago.paypal_order_id) return;
    try {
      const res = await obtenerEstadoPayPal(pago.paypal_order_id);
      toast.info(`Estado real en PayPal: ${res.status} (orden ${res.order_id})`, {
        duration: 8000,
      });
      console.log("Estado completo de la orden PayPal:", res);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "No se pudo consultar el estado.");
    }
  }

  // Aprobación manual (solo admin): fallback cuando PayPal sandbox no
  // confirma el pago solo. Intenta capturar en PayPal primero.
  async function handleAprobar(pago: Pago) {
    try {
      setAprobandoId(pago.id);
      const res = await aprobarPagoManual(pago.id);
      if (res.confirmado_por_paypal) {
        toast.success("Pago confirmado por PayPal y aprobado.");
      } else {
        toast.success("Pago aprobado manualmente (no confirmado por PayPal).");
      }
      await cargarPagos();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "No se pudo aprobar el pago.");
    } finally {
      setAprobandoId(null);
    }
  }

  async function handleRechazar(pago: Pago) {
    try {
      setAprobandoId(pago.id);
      await rechazarPagoManual(pago.id);
      toast.info("Pago rechazado.");
      await cargarPagos();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "No se pudo rechazar el pago.");
    } finally {
      setAprobandoId(null);
    }
  }

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
                <th className="p-4 text-center">Acción</th>
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
                  <td className="p-4 text-center">
                    {pago.estado === "pendiente" && pago.metodo === "paypal" && pago.paypal_order_id && (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleVerificar(pago)}
                          disabled={verificandoId === pago.id}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition disabled:opacity-50"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${verificandoId === pago.id ? "animate-spin" : ""}`} />
                          Verificar pago
                        </button>
                        <button
                          onClick={() => handleVerEstado(pago)}
                          title="Consultar estado real en PayPal (sin capturar)"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 bg-gray-50 hover:bg-gray-100 transition"
                        >
                          <Search className="h-3.5 w-3.5" />
                          Ver estado
                        </button>
                      </div>
                    )}
                    {pago.estado === "pendiente" && esAdmin && (
                      <div className="flex items-center justify-center gap-2 mt-2">
                        <button
                          onClick={() => handleAprobar(pago)}
                          disabled={aprobandoId === pago.id}
                          title="Aprobación manual (fallback si PayPal sandbox no confirma)"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 transition disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Aprobar
                        </button>
                        <button
                          onClick={() => handleRechazar(pago)}
                          disabled={aprobandoId === pago.id}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 transition disabled:opacity-50"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Rechazar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
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
