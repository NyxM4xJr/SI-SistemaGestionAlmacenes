/**
 * ============================================================
 * ARCHIVO: frontend/src/pages/Ventas/CobrarVentaButton.tsx
 * CASO DE USO: CU35/CU36 - Cobro de una venta
 * CICLO: 5
 * FECHA: 03/07/26
 *
 * DESCRIPCIÓN: Botón desplegable para cobrar una venta.
 *  - Efectivo: marca la venta como pagada directamente.
 *  - PayPal: crea una orden y redirige a PayPal; al volver a
 *    /ventas la captura se completa (ver VentaList useEffect).
 * (Stripe sigue disponible para depósitos de fondos, CU31.)
 * ============================================================
 */

import { useState } from "react";
import { toast } from "sonner";
import { CreditCard, Banknote, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { type Venta, updateVenta } from "@/services/ventaService";
import { crearOrdenPayPal } from "@/services/pagoService";

interface Props {
  venta: Venta;
  onPagada: () => void;
}

export default function CobrarVentaButton({ venta, onPagada }: Props) {
  const [procesando, setProcesando] = useState(false);

  async function cobrarEfectivo() {
    try {
      setProcesando(true);
      await updateVenta(venta.id, { estado: "pagada", metodo_pago: "efectivo" });
      toast.success("Venta cobrada en efectivo.");
      onPagada();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al cobrar la venta.");
    } finally {
      setProcesando(false);
    }
  }

  async function cobrarPayPal() {
    try {
      setProcesando(true);
      const origin = window.location.origin;
      // Al volver de PayPal, VentaList detecta paypal_capturar y captura.
      const returnUrl = `${origin}/ventas?paypal_capturar=1&venta=${venta.id}`;
      const cancelUrl = `${origin}/ventas`;
      const { approve_url } = await crearOrdenPayPal(
        Number(venta.total),
        `Venta #${venta.id}`,
        returnUrl,
        cancelUrl
      );
      if (!approve_url) throw new Error("PayPal no devolvió una URL de aprobación.");
      window.location.href = approve_url;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al iniciar el pago con PayPal.");
      setProcesando(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={procesando}
          className="h-8 px-3 text-teal-700 hover:text-teal-900 hover:bg-teal-50 text-xs gap-1.5 rounded-lg"
        >
          <CreditCard className="h-3.5 w-3.5" /> Cobrar <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={cobrarEfectivo} className="gap-2 cursor-pointer">
          <Banknote className="h-4 w-4 text-green-600" /> Efectivo
        </DropdownMenuItem>
        <DropdownMenuItem onClick={cobrarPayPal} className="gap-2 cursor-pointer">
          <CreditCard className="h-4 w-4 text-blue-600" /> PayPal
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
