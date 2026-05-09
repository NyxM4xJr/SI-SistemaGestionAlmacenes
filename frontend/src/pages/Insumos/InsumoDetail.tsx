import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { insumoService, Insumo } from "@/services/insumoServices";

export default function InsumoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [insumo, setInsumo] = useState<Insumo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      insumoService.getById(Number(id))
        .then(setInsumo)
        .catch(() => toast.error("Error al cargar insumo"))
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) return <div className="min-h-screen bg-gradient-soft flex items-center justify-center">Cargando...</div>;
  if (!insumo) return <div className="min-h-screen bg-gradient-soft flex items-center justify-center">Insumo no encontrado</div>;

  return (
    <div className="min-h-screen bg-gradient-soft">
      <AppHeader />
      <main className="container py-8 max-w-2xl">
        <Button variant="ghost" onClick={() => navigate("/insumos")} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>

        <div className="bg-card rounded-3xl shadow-card p-8 space-y-6">
          <h1 className="text-3xl font-bold">{insumo.nombre}</h1>
          <p className="text-muted-foreground">Detalle del insumo</p>

          <div className="grid grid-cols-2 gap-4">
            <div><span className="font-bold">Categoría:</span> {insumo.categoria}</div>
            <div><span className="font-bold">Origen:</span> {insumo.origen}</div>
            <div><span className="font-bold">Conservación:</span> {insumo.conservado}</div>
            <div><span className="font-bold">Vencimiento:</span> {insumo.vencimiento_dias} días</div>
          </div>

          <h2 className="font-bold text-lg border-b pb-2">Valores Nutricionales (por 100g)</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><span className="font-bold">Proteínas:</span> {insumo.proteinas}g</div>
            <div><span className="font-bold">Calorías:</span> {insumo.calorias}kcal</div>
            <div><span className="font-bold">Grasas:</span> {insumo.grasas}g</div>
            <div><span className="font-bold">Calcio:</span> {insumo.calcio}mg</div>
            <div><span className="font-bold">Hierro:</span> {insumo.hierro}mg</div>
          </div>
        </div>
      </main>
    </div>
  );
}