import { useState, useEffect } from "react";
import AppHeader from "@/components/AppHeader";
import { Input } from "@/components/ui/input";
import { crearSesionPago, crearOrdenPayPal, getSaldoPagos } from "@/services/pagoService";
import { CreditCard, DollarSign } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

type MetodoDeposito = "stripe" | "paypal";

export default function PagoDeposito() {
  const [monto, setMonto] = useState<string>("");
  const [descripcion, setDescripcion] = useState<string>("");
  const [metodo, setMetodo] = useState<MetodoDeposito>("stripe");
  const [saldo, setSaldo] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    cargarSaldo();
  }, []);

  const cargarSaldo = async () => {
    try {
      const data = await getSaldoPagos();
      setSaldo(data.saldo_total);
    } catch (error: any) {
      console.error(error);
    }
  };

  const handleDepositar = async (e: React.FormEvent) => {
    e.preventDefault();
    const numMonto = parseFloat(monto);
    if (isNaN(numMonto) || numMonto < 10) {
      toast({
        title: "Monto inválido",
        description: "El monto mínimo a depositar es de 10 Bs.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      if (metodo === "stripe") {
        const data = await crearSesionPago(numMonto, descripcion);
        window.location.href = data.url; // Redirigir a Stripe Checkout
      } else {
        // PayPal: el backend crea la orden; al volver, HistorialPagos captura.
        const origin = window.location.origin;
        const returnUrl = `${origin}/pagos/historial?paypal_capturar=1`;
        const cancelUrl = `${origin}/pagos/depositar`;
        const data = await crearOrdenPayPal(
          numMonto,
          descripcion || "Depósito al sistema",
          returnUrl,
          cancelUrl
        );
        if (!data.approve_url) throw new Error("PayPal no devolvió una URL de aprobación.");
        window.location.href = data.approve_url;
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo iniciar el pago.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-soft">
      <AppHeader />
      <main className="container px-4 py-6 md:py-8 max-w-3xl mx-auto">
        
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Depositar Fondos</h1>
            <p className="text-muted-foreground">Recarga el presupuesto del sistema mediante Stripe o PayPal</p>
          </div>
          <div className="bg-primary/10 text-primary px-4 py-3 rounded-xl border border-primary/20 flex flex-col items-end">
            <span className="text-xs uppercase font-bold tracking-wider opacity-80">Saldo Actual</span>
            <span className="text-xl font-bold">{saldo.toFixed(2)} Bs.</span>
          </div>
        </div>

        <div className="bg-card rounded-3xl shadow-card p-6 md:p-8">
          <form onSubmit={handleDepositar} className="flex flex-col gap-6">

            <div className="flex flex-col gap-2">
              <label className="font-semibold text-sm">Método de Pago</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMetodo("stripe")}
                  className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 font-semibold transition ${
                    metodo === "stripe"
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  <CreditCard size={18} /> Stripe
                </button>
                <button
                  type="button"
                  onClick={() => setMetodo("paypal")}
                  className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 font-semibold transition ${
                    metodo === "paypal"
                      ? "border-[#003087] bg-[#f5f7ff] text-[#003087]"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  Pay<span className="text-[#009cde]">Pal</span>
                </button>
              </div>
              {metodo === "paypal" && (
                <p className="text-xs text-amber-600">
                  PayPal (sandbox) procesa el pago en USD.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-semibold text-sm">Monto a Depositar (Bs.)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                <Input
                  type="number"
                  min="10"
                  step="0.01"
                  required
                  placeholder="Ej. 100.00"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  className="pl-10 text-lg"
                />
              </div>
              <p className="text-xs text-muted-foreground">Monto mínimo: 10 Bs.</p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-semibold text-sm">Descripción (Opcional)</label>
              <Input
                type="text"
                placeholder="Ej. Recarga mensual junio"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`mt-4 w-full text-white font-semibold py-3 px-6 rounded-xl flex justify-center items-center gap-2 transition disabled:opacity-50 ${
                metodo === "stripe" ? "bg-blue-600 hover:bg-blue-700" : "bg-[#003087] hover:bg-[#00256b]"
              }`}
            >
              {loading ? (
                <span className="animate-pulse">Procesando...</span>
              ) : (
                <>
                  <CreditCard size={20} />
                  Depositar con {metodo === "stripe" ? "Stripe" : "PayPal"}
                </>
              )}
            </button>
            <p className="text-center text-xs text-muted-foreground mt-2">
              Serás redirigido a la pasarela segura de {metodo === "stripe" ? "Stripe" : "PayPal"} para completar el pago.
            </p>
          </form>
        </div>

      </main>
    </div>
  );
}
