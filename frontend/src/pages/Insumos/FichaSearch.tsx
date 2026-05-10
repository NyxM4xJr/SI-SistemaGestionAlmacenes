/**
 * ============================================================
 * ARCHIVO: frontend/src/pages/Insumos/FichaSearch.tsx
 * CASO DE USO: CU08 - Consultar Ficha Técnica Digital
 * CICLO: 2
 * FECHA: 10/05/26
 * AUTOR:....
 * 
 * DESCRIPCIÓN: Buscador de insumos para visualizar su ficha
 * técnica. Muestra una lista ultra simplificada con solo nombre
 * y categoría. Al seleccionar uno, muestra su detalle completo.
 * 
 * PENDIENTE: Realmentar darle el uso que corresponde a la ficha técnica..., 
 * mientras esto muestra informacion demasiado básica para considerarse
 * una ficha técnica.
 * ============================================================
 */

import { useState, useEffect } from "react";
import AppHeader from "@/components/AppHeader";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Search, FileText, X } from "lucide-react";
import { insumoService, Insumo } from "@/services/insumoServices";
import { useSearchParams } from "react-router-dom";

export default function FichaSearch() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("buscar") || "");
  const [selected, setSelected] = useState<Insumo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    insumoService.getAll()
      .then(setInsumos)
      .catch(() => toast.error("Error al cargar insumos"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = insumos.filter(i =>
    i.nombre.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-soft">
      <AppHeader />
      <main className="container py-8 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 grid place-items-center">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Ficha Técnica de Insumos</h1>
            <p className="text-muted-foreground">Busca un insumo para ver sus detalles técnicos</p>
          </div>
        </div>

        {!selected ? (
          <>
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Escribe el nombre del insumo..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10 text-lg py-6"
                autoFocus
              />
            </div>

            {loading ? (
              <p className="text-center text-muted-foreground">Cargando...</p>
            ) : (
              <div className="space-y-2">
                {filtered.map(i => (
                  <button
                    key={i.id}
                    onClick={() => setSelected(i)}
                    className="w-full text-left p-4 bg-card rounded-2xl shadow-card hover:shadow-md transition-shadow"
                  >
                    <span className="font-semibold">{i.nombre}</span>
                    <span className="text-muted-foreground ml-2 text-sm">{i.categoria}</span>
                  </button>
                ))}
                {filtered.length === 0 && search && (
                  <p className="text-center text-muted-foreground py-8">No se encontraron insumos</p>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="bg-card rounded-3xl shadow-card p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">{selected.nombre}</h2>
              <button onClick={() => setSelected(null)} className="p-2 hover:bg-secondary/30 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div><span className="font-bold">Categoría:</span> {selected.categoria}</div>
              <div><span className="font-bold">Origen:</span> {selected.origen}</div>
              <div><span className="font-bold">Conservación:</span> {selected.conservado}</div>
              <div><span className="font-bold">Vencimiento:</span> {selected.vencimiento_dias} días</div>
            </div>

            <h3 className="font-bold text-lg border-b pb-2 mb-4">Valores Nutricionales (por 100g)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><span className="font-bold">Proteínas:</span> {selected.proteinas}g</div>
              <div><span className="font-bold">Calorías:</span> {selected.calorias}kcal</div>
              <div><span className="font-bold">Grasas:</span> {selected.grasas}g</div>
              <div><span className="font-bold">Calcio:</span> {selected.calcio}mg</div>
              <div><span className="font-bold">Hierro:</span> {selected.hierro}mg</div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}