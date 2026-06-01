/**
 * ============================================================
 * ARCHIVO: frontend/src/pages/Insumos/InsumoForm.tsx
 * CASO DE USO: CU07 - Gestionar Insumos
 *              CU22 - Configurar Porcentaje de Merma Técnica
 * CICLO: 2 / 3
 * FECHA: 01/06/26
 * AUTOR: Karen Ortega Mancilla
 * CAMBIO CU22: Agrega campo "Porcentaje de Merma Técnica (%)"
 *   debajo de "Días para Vencimiento". El valor se envía junto
 *   con el PATCH del insumo y el backend lo guarda en FICHA_TECNICA.
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
import { insumoService, fichaTecnicaService, Insumo } from "@/services/insumoServices";

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

  // CU22 — campo de merma separado (viene de ficha_tecnica, no de insumo)
  const [porcentajeMerma, setPorcentajeMerma] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isEditing && id) {
      // Cargar datos del insumo
      insumoService.getById(Number(id))
        .then(setForm)
        .catch(() => toast.error("Error al cargar insumo"));

      // CU22: Cargar porcentaje_merma desde ficha_tecnica
      fichaTecnicaService.getById(Number(id))
        .then((data) => {
          if (data?.ficha_tecnica?.porcentaje_merma != null) {
            setPorcentajeMerma(String(data.ficha_tecnica.porcentaje_merma));
          }
        })
        .catch(() => {
          // Si no tiene ficha técnica, dejamos el campo vacío — no es error
        });
    }
  }, [id, isEditing]);

  const handleChange = (field: keyof Insumo, value: string) => {
    if (field === "vencimiento_dias") {
      setForm(prev => ({ ...prev, [field]: parseInt(value) || 0 }));
      return;
    }
    const numericFields = ["proteinas", "calorias", "grasas", "calcio", "hierro"];
    if (numericFields.includes(field)) {
      const cleaned = value.replace(",", ".");
      setForm(prev => ({ ...prev, [field]: cleaned === "" ? 0 : parseFloat(cleaned) || 0 }));
      return;
    }
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validar porcentaje_merma si se ingresó
    if (porcentajeMerma !== "") {
      const val = parseFloat(porcentajeMerma);
      if (isNaN(val) || val < 0 || val > 100) {
        toast.error("El porcentaje de merma debe estar entre 0 y 100.");
        return;
      }
    }

    setLoading(true);
    try {
      // Construir payload: datos del insumo + porcentaje_merma si se ingresó
      const payload: Insumo & { porcentaje_merma?: number } = { ...form };
      if (porcentajeMerma !== "") {
        payload.porcentaje_merma = parseFloat(porcentajeMerma);
      }

      if (isEditing && id) {
        await insumoService.update(Number(id), payload);
        toast.success("Insumo actualizado correctamente.");
      } else {
        await insumoService.create(payload);
        toast.success("Insumo creado correctamente.");
      }
      navigate("/insumos");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
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

          {/* ── Datos Básicos ── */}
          <div className="space-y-4">
            <h3 className="font-bold text-lg border-b pb-2">Datos Básicos</h3>

            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input id="nombre" required value={form.nombre}
                onChange={e => handleChange("nombre", e.target.value)}
                placeholder="Ej: Tomate" disabled={loading} />
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
              <Input id="origen" required value={form.origen}
                onChange={e => handleChange("origen", e.target.value)}
                placeholder="Ej: Bolivia" disabled={loading} />
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
              <Input id="vencimiento" type="number" required min="1"
                value={form.vencimiento_dias}
                onChange={e => handleChange("vencimiento_dias", e.target.value)}
                disabled={loading} />
            </div>

            {/* ── CU22: Porcentaje de Merma Técnica ── */}
            <div className="space-y-2">
              <Label htmlFor="porcentaje_merma">
                Porcentaje de Merma Técnica (%)
                <span className="text-muted-foreground font-normal ml-1">(opcional)</span>
              </Label>
              <div className="relative">
                <Input
                  id="porcentaje_merma"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="Ej: 15.00"
                  value={porcentajeMerma}
                  onChange={e => setPorcentajeMerma(e.target.value)}
                  disabled={loading}
                  className="pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                  %
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Pérdida esperada del insumo por preparación o conservación (0–100%).
                Se guarda en la ficha técnica del insumo.
              </p>
              {/* Indicador visual en tiempo real */}
              {porcentajeMerma !== "" && !isNaN(parseFloat(porcentajeMerma)) && (
                <div className={`text-xs font-medium px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 ${
                  parseFloat(porcentajeMerma) <= 10
                    ? "bg-green-50 text-green-700"
                    : parseFloat(porcentajeMerma) <= 30
                    ? "bg-yellow-50 text-yellow-700"
                    : "bg-red-50 text-red-700"
                }`}>
                  {parseFloat(porcentajeMerma) <= 10 && "🟢 Merma baja"}
                  {parseFloat(porcentajeMerma) > 10 && parseFloat(porcentajeMerma) <= 30 && "🟡 Merma moderada"}
                  {parseFloat(porcentajeMerma) > 30 && "🔴 Merma alta"}
                </div>
              )}
            </div>
          </div>

          {/* ── Valores Nutricionales ── */}
          <div className="space-y-4">
            <h3 className="font-bold text-lg border-b pb-2">Valores Nutricionales (por 100g)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="proteinas">Proteínas (g)</Label>
                <Input id="proteinas" type="number" step="0.01" min="0"
                  value={form.proteinas}
                  onChange={e => handleChange("proteinas", e.target.value)}
                  disabled={loading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="calorias">Calorías (kcal)</Label>
                <Input id="calorias" type="number" step="0.01" min="0"
                  value={form.calorias}
                  onChange={e => handleChange("calorias", e.target.value)}
                  disabled={loading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="grasas">Grasas (g)</Label>
                <Input id="grasas" type="number" step="0.01" min="0"
                  value={form.grasas}
                  onChange={e => handleChange("grasas", e.target.value)}
                  disabled={loading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="calcio">Calcio (mg)</Label>
                <Input id="calcio" type="number" step="0.01" min="0"
                  value={form.calcio}
                  onChange={e => handleChange("calcio", e.target.value)}
                  disabled={loading} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="hierro">Hierro (mg)</Label>
                <Input id="hierro" type="number" step="0.01" min="0"
                  value={form.hierro}
                  onChange={e => handleChange("hierro", e.target.value)}
                  disabled={loading} />
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