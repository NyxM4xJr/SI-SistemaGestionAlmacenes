/**
 * ============================================================
 * ARCHIVO: frontend/src/pages/Insumos/FichaSearch.tsx
 * CASO DE USO: CU08 - Consultar Ficha Técnica Digital
 *              CU22 - Configurar Porcentaje de Merma Técnica
 * CICLO: 2 / 3
 * FECHA: 01/06/26
 * AUTOR: Karen Ortega Mancilla
 * CAMBIO CU22: Muestra el campo porcentaje_merma en la sección
 *   de Ficha Técnica cuando está disponible.
 * ============================================================
 */

import { useState, useEffect } from "react";
import AppHeader from "@/components/AppHeader";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Search, FileText, X } from "lucide-react";
import { insumoService, Insumo, fichaTecnicaService, InsumoConFicha } from "@/services/insumoServices";
import { useSearchParams } from "react-router-dom";

export default function FichaSearch() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("buscar") || "");
  const [selected, setSelected] = useState<Insumo | null>(null);
  const [fichaData, setFichaData] = useState<InsumoConFicha | null>(null);
  const [loadingFicha, setLoadingFicha] = useState(false);
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

  const handleSelectInsumo = async (insumo: Insumo) => {
    setSelected(insumo);
    setLoadingFicha(true);
    setFichaData(null);

    try {
      if (!insumo.id) throw new Error("ID no disponible");
      const data = await fichaTecnicaService.getById(insumo.id);
      setFichaData(data);
    } catch {
      toast.error("No se pudo cargar la ficha técnica completa");
      setFichaData({ insumo: insumo, ficha_tecnica: null });
    } finally {
      setLoadingFicha(false);
    }
  };

  // ── Helper para badge de merma ────────────────────────────
  function getMermaBadge(porcentaje: number) {
    if (porcentaje <= 10) return { label: "Merma baja", color: "bg-green-50 text-green-700 border-green-200" };
    if (porcentaje <= 30) return { label: "Merma moderada", color: "bg-yellow-50 text-yellow-700 border-yellow-200" };
    return { label: "Merma alta", color: "bg-red-50 text-red-700 border-red-200" };
  }

  return (
    <div className="min-h-screen bg-gradient-soft">
      <AppHeader />
      <main className="container py-8 px-4 max-w-3xl">
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
                    onClick={() => handleSelectInsumo(i)}
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
              <button
                onClick={() => { setSelected(null); setFichaData(null); }}
                className="p-2 hover:bg-secondary/30 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {loadingFicha ? (
              <p className="text-center text-muted-foreground py-8">Cargando ficha técnica...</p>
            ) : (
              <>
                {/* DATOS GENERALES */}
                <h3 className="font-bold text-lg border-b pb-2 mb-4">Datos Generales</h3>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div><span className="font-bold">Categoría:</span> {fichaData?.insumo.categoria || selected.categoria}</div>
                  <div><span className="font-bold">Origen:</span> {fichaData?.insumo.origen || selected.origen}</div>
                  <div><span className="font-bold">Conservación:</span> {fichaData?.insumo.conservado || selected.conservado}</div>
                  <div><span className="font-bold">Vencimiento:</span> {fichaData?.insumo.vencimiento_dias ?? selected.vencimiento_dias} días</div>
                </div>

                {/* FICHA TÉCNICA */}
                <h3 className="font-bold text-lg border-b pb-2 mb-4">Ficha Técnica</h3>
                {fichaData?.ficha_tecnica ? (
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="col-span-2 bg-primary/5 p-4 rounded-xl">
                      <span className="font-bold">🌡️ Temperatura óptima:</span>{" "}
                      <span className="text-lg">{fichaData.ficha_tecnica.temperatura}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="font-bold">Indicadores de Madurez:</span>{" "}
                      {fichaData.ficha_tecnica.madurez}
                    </div>
                    <div className="col-span-2">
                      <span className="font-bold">Características clave:</span>{" "}
                      {fichaData.ficha_tecnica.caracteristicas}
                    </div>
                    <div className="col-span-2 text-sm text-muted-foreground">
                      <span className="font-bold">Referencias:</span>{" "}
                      {fichaData.ficha_tecnica.referencias}
                    </div>

                    {/* ── CU22: Porcentaje de Merma Técnica ── */}
                    {fichaData.ficha_tecnica.porcentaje_merma != null && (
                      <div className="col-span-2 mt-2">
                        <span className="font-bold">📉 Merma Técnica Esperada:</span>{" "}
                        <span className="text-lg font-semibold">
                          {fichaData.ficha_tecnica.porcentaje_merma}%
                        </span>
                        {(() => {
                          const badge = getMermaBadge(Number(fichaData.ficha_tecnica.porcentaje_merma));
                          return (
                            <span className={`ml-2 text-xs font-medium px-2.5 py-0.5 rounded-full border ${badge.color}`}>
                              {badge.label}
                            </span>
                          );
                        })()}
                        <p className="text-xs text-muted-foreground mt-1">
                          Pérdida esperada durante preparación o conservación del insumo.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-amber-600 bg-amber-50 p-4 rounded-xl mb-6">
                    ⚠️ Ficha técnica no disponible para este insumo.
                  </p>
                )}

                {/* VALORES NUTRICIONALES */}
                <h3 className="font-bold text-lg border-b pb-2 mb-4">Valores Nutricionales (por 100g)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div><span className="font-bold">Proteínas:</span> {fichaData?.insumo.proteinas ?? selected.proteinas}g</div>
                  <div><span className="font-bold">Calorías:</span> {fichaData?.insumo.calorias ?? selected.calorias}kcal</div>
                  <div><span className="font-bold">Grasas:</span> {fichaData?.insumo.grasas ?? selected.grasas}g</div>
                  <div><span className="font-bold">Calcio:</span> {fichaData?.insumo.calcio ?? selected.calcio}mg</div>
                  <div><span className="font-bold">Hierro:</span> {fichaData?.insumo.hierro ?? selected.hierro}mg</div>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}