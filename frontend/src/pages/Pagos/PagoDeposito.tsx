import { useState, useEffect } from "react";
import AppHeader from "@/components/AppHeader";
import { Input } from "@/components/ui/input";
import { crearSesionPago, getSaldoPagos } from "@/services/pagoService";
import { CreditCard, DollarSign } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function PagoDeposito() {
  const [monto, setMonto] = useState<string>("");
  const [descripcion, setDescripcion] = useState<string>("");
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
      const data = await crearSesionPago(numMonto, descripcion);
      // Redirigir a Stripe Checkout
      window.location.href = data.url;
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
            <p className="text-muted-foreground">Recarga el presupuesto del sistema mediante Stripe</p>
          </div>
          <div className="bg-primary/10 text-primary px-4 py-3 rounded-xl border border-primary/20 flex flex-col items-end">
            <span className="text-xs uppercase font-bold tracking-wider opacity-80">Saldo Actual</span>
            <span className="text-xl font-bold">{saldo.toFixed(2)} Bs.</span>
          </div>
        </div>

        <div className="bg-card rounded-3xl shadow-card p-6 md:p-8">
          <form onSubmit={handleDepositar} className="flex flex-col gap-6">
            
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
              className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl flex justify-center items-center gap-2 transition disabled:opacity-50"
            >
              {loading ? (
                <span className="animate-pulse">Procesando...</span>
              ) : (
                <>
                  <CreditCard size={20} />
                  Depositar con Stripe
                </>
              )}
            </button>
            <p className="text-center text-xs text-muted-foreground mt-2">
              Serás redirigido a la pasarela segura de Stripe para completar el pago.
            </p>
          </form>
        </div>

      </main>
    </div>
  );
}
