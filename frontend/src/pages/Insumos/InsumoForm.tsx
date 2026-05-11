/**
 * ============================================================
 * ARCHIVO: frontend/src/pages/Insumos/InsumoForm.tsx
 * CASO DE USO: CU07 - Gestionar Insumos
 * CICLO: 2
 * FECHA: 09/05/26
 * AUTOR: Karen Ortega Mancilla
 * DESCRIPCIÓN: Formulario para crear/editar insumos.
 *   - Modo crear: Todos los campos editables
 *   - Modo editar: Precarga datos existentes
 *   - Secciones: Datos Básicos, Valores Nutricionales
 * ============================================================
 */

import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Save, PlusCircle } from "lucide-react";
import { insumoService, Insumo } from "@/services/insumoServices";

const CATEGORIAS = ["Verdura", "Tuberculo", "Carne", "Grano", "Endulzante", "Lacteo", "Condimento", "Liquido", "Proteina"];
const CONSERVACION = ["Refrigerado", "Seco", "Congelado", "Ambiente"];

export default function InsumoForm() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState<Insumo>({
    nombre: "",
    categoria: "",
    origen: "",
    conservado: "",
    vencimiento_dias: 0,
    proteinas: 0,
    calorias: 0,
    grasas: 0,
    calcio: 0,
    hierro: 0,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isEditing && id) {
      insumoService.getById(Number(id))
        .then(setForm)
        .catch(() => toast.error("Error al cargar insumo"));
    }
  }, [id, isEditing]);

  const handleChange = (field: keyof Insumo, value: string) => {
    // Si el campo es vencimiento_dias, convertir a entero
    if (field === "vencimiento_dias") {
      const intValue = parseInt(value) || 0;
      setForm(prev => ({ ...prev, [field]: intValue }));
      return;
    }
    
    // Para campos decimales, reemplazar coma por punto y convertir
    const numericFields = ["proteinas", "calorias", "grasas", "calcio", "hierro"];
    if (numericFields.includes(field)) {
      const cleaned = value.replace(",", ".");
      const numValue = cleaned === "" ? 0 : parseFloat(cleaned) || 0;
      setForm(prev => ({ ...prev, [field]: numValue }));
      return;
    }
    
    // Para campos de texto normales
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isEditing && id) {
        await insumoService.update(Number(id), form);
        toast.success("Insumo actualizado");
      } else {
        await insumoService.create(form);
        toast.success("Insumo creado");
      }
      navigate("/insumos");
    } catch (err: any) {
      toast.error(err.message || "Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-soft">
      <AppHeader />
      <main className="container py-8 px-4 max-w-2xl">
        <Button variant="ghost" onClick={() => navigate("/insumos")} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>

        <div className="flex items-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 grid place-items-center">
            {isEditing ? <Save className="h-6 w-6 text-primary" /> : <PlusCircle className="h-6 w-6 text-primary" />}
          </div>
          <div>
            <h1 className="text-3xl font-bold">{isEditing ? "Editar Insumo" : "Crear Insumo"}</h1>
            <p className="text-muted-foreground">
              {isEditing ? "Modifica los datos del insumo" : "Registra un nuevo insumo en el catálogo"}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-card rounded-3xl shadow-card p-8 space-y-6">
          {/* Datos Básicos */}
          <div className="space-y-4">
            <h3 className="font-bold text-lg border-b pb-2">Datos Básicos</h3>
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input id="nombre" required value={form.nombre} onChange={e => handleChange("nombre", e.target.value)} placeholder="Ej: Tomate" disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoría *</Label>
              <Select value={form.categoria} onValueChange={v => handleChange("categoria", v)} disabled={loading}>
                <SelectTrigger><SelectValue placeholder="Seleccionar categoría" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="origen">Origen *</Label>
              <Input id="origen" required value={form.origen} onChange={e => handleChange("origen", e.target.value)} placeholder="Ej: Bolivia" disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="conservado">Tipo de Conservación *</Label>
              <Select value={form.conservado} onValueChange={v => handleChange("conservado", v)} disabled={loading}>
                <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                <SelectContent>
                  {CONSERVACION.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vencimiento">Días para Vencimiento *</Label>
              <Input id="vencimiento" type="number" required min="1" value={form.vencimiento_dias} onChange={e => handleChange("vencimiento_dias", (e.target.value))} disabled={loading} />
            </div>
          </div>

          {/* Valores Nutricionales */}
          <div className="space-y-4">
            <h3 className="font-bold text-lg border-b pb-2">Valores Nutricionales (por 100g)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="proteinas">Proteínas (g)</Label>
                <Input id="proteinas" type="number" step="0.01" min="0" value={form.proteinas} onChange={e => handleChange("proteinas", (e.target.value))} disabled={loading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="calorias">Calorías (kcal)</Label>
                <Input id="calorias" type="number" step="0.01" min="0" value={form.calorias} onChange={e => handleChange("calorias", (e.target.value))} disabled={loading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="grasas">Grasas (g)</Label>
                <Input id="grasas" type="number" step="0.01" min="0" value={form.grasas} onChange={e => handleChange("grasas", (e.target.value))} disabled={loading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="calcio">Calcio (mg)</Label>
                <Input id="calcio" type="number" step="0.01" min="0" value={form.calcio} onChange={e => handleChange("calcio", (e.target.value))} disabled={loading} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="hierro">Hierro (mg)</Label>
                <Input id="hierro" type="number" step="0.01" min="0" value={form.hierro} onChange={e => handleChange("hierro", (e.target.value))} disabled={loading} />
              </div>
            </div>
          </div>

          <Button type="submit" size="lg" className="w-full text-lg font-semibold shadow-soft" disabled={loading}>
            {loading ? "Guardando..." : isEditing ? "Guardar Cambios" : "Crear Insumo"}
          </Button>
        </form>
      </main>
    </div>
  );
}