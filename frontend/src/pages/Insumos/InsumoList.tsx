/**
 * ============================================================
 * ARCHIVO: frontend/src/pages/Insumos/InsumoList.tsx
 * CASO DE USO: CU07 - Gestionar Insumos
 * CICLO: 2
 * FECHA: 09/05/26
 * AUTOR: Karen Ortega Mancilla
 * DESCRIPCIÓN: Página de lista de insumos.
 *   - Tabla con columnas: Nombre, Categoría, Origen, Vencimiento, Acciones
 *   - Barra de búsqueda por nombre
 *   - Tarjetas de estadísticas (total, verduras, carnes, Bolivia)
 *   - Botones: Ver ficha técnica, Editar, Eliminar
 * ============================================================
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { PlusCircle, Pencil, Trash2, Eye, Search } from "lucide-react";
import { insumoService, Insumo } from "@/services/insumoServices";

const CATEGORY_BADGES: Record<string, string> = {
  Verdura: "bg-green-100 text-green-700",
  Tuberculo: "bg-yellow-100 text-yellow-700",
  Carne: "bg-red-100 text-red-700",
  Grano: "bg-amber-100 text-amber-700",
  Endulzante: "bg-pink-100 text-pink-700",
  Lacteo: "bg-blue-100 text-blue-700",
  Condimento: "bg-purple-100 text-purple-700",
  Liquido: "bg-cyan-100 text-cyan-700",
  Proteina: "bg-orange-100 text-orange-700",
};

export default function InsumoList() {
  const navigate = useNavigate();
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => { cargarInsumos(); }, []);

  const cargarInsumos = async () => {
    try {
      setLoading(true);
      setInsumos(await insumoService.getAll());
    } catch {
      toast.error("Error al cargar insumos");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number, nombre: string) => {
    if (!confirm(`¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await insumoService.delete(id);
      toast.success(`"${nombre}" eliminado`);
      cargarInsumos();
    } catch {
      toast.error("Error al eliminar. Puede estar siendo usado.");
    }
  };

  const filtered = insumos.filter(i =>
    i.nombre.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: insumos.length,
    verduras: insumos.filter(i => i.categoria === "Verdura").length,
    carnes: insumos.filter(i => i.categoria === "Carne").length,
    bolivia: insumos.filter(i => i.origen === "Bolivia").length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-soft flex items-center justify-center">
        <p className="text-muted-foreground text-lg">Cargando insumos...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-soft">
      <AppHeader />
      <main className="container py-8 max-w-6xl">
        {/* Encabezado */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-3xl font-bold">Gestión de Insumos</h1>
            <p className="text-muted-foreground">Catálogo de productos gastronómicos</p>
          </div>
          <Button size="lg" className="shadow-soft" onClick={() => navigate("/insumos/crear")}>
            <PlusCircle className="mr-2 h-5 w-5" /> Nuevo Insumo
          </Button>
        </div>

        {/* Tarjetas de estadísticas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-6">
          <StatCard label="Total" value={stats.total} />
          <StatCard label="Verduras" value={stats.verduras} />
          <StatCard label="Carnes" value={stats.carnes} />
          <StatCard label="Origen Bolivia" value={stats.bolivia} />
        </div>

        {/* Búsqueda */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tabla */}
        <div className="bg-card rounded-3xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                  <TableHead className="font-bold">Nombre</TableHead>
                  <TableHead className="font-bold">Categoría</TableHead>
                  <TableHead className="font-bold">Origen</TableHead>
                  <TableHead className="font-bold">Vencimiento</TableHead>
                  <TableHead className="font-bold text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      {search ? "No se encontraron insumos con ese nombre" : "No hay insumos registrados"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-semibold">{i.nombre}</TableCell>
                      <TableCell>
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${CATEGORY_BADGES[i.categoria] || "bg-gray-100 text-gray-700"}`}>
                          {i.categoria}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{i.origen}</TableCell>
                      <TableCell>{i.vencimiento_dias} días</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1 flex-wrap">
                          <Button variant="ghost" size="icon" onClick={() => navigate(`/insumos/ficha?buscar=${encodeURIComponent(i.nombre)}`)} title="Ver ficha técnica">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => navigate(`/insumos/${i.id}/editar`)} title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(i.id!, i.nombre)} title="Eliminar">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-card rounded-2xl p-4 shadow-card">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-3xl font-bold text-primary">{value}</div>
    </div>
  );
}