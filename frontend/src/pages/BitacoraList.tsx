/**
 * ============================================================
 * ARCHIVO: frontend/src/pages/BitacoraList.tsx
 * CASO DE USO: CU30 - Consultar Detalle de Bitácora
 * CICLO: 2
 * FECHA: 11/05/26
 * AUTORES: Grupo 2
 * 
 * DESCRIPCIÓN: Consulta de registros de detalle_bitacora.
 * Muestra las acciones realizadas por los usuarios con filtros
 * por búsqueda textual.
 * ============================================================
 */

import { useState, useEffect } from "react";
import AppHeader from "@/components/AppHeader";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, ClipboardList } from "lucide-react";
import { toast } from "sonner";

interface BitacoraRow {
  id: string;
  origen: string;
  usuario: string;
  accion: string;
  descripcion: string;
  ip: string;
  fecha: string;
}

export default function BitacoraList() {
  const [datos, setDatos] = useState<BitacoraRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

  useEffect(() => {
    const cargar = async () => {
      try {
        const token = localStorage.getItem("access_token");
        const res = await fetch(`${API_URL}/bitacora/completa/`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          setDatos(await res.json());
        } else {
          toast.error("Error al cargar bitácora");
        }
      } catch {
        toast.error("Error de conexión");
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, []);

  const filtered = datos.filter(row =>
    row.accion?.toLowerCase().includes(search.toLowerCase()) ||
    row.descripcion?.toLowerCase().includes(search.toLowerCase()) ||
    row.ip?.includes(search)
  );

  return (
    <div className="min-h-screen bg-gradient-soft">
      <AppHeader />
      <main className="container py-8 px-4 max-w-6xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 grid place-items-center">
            <ClipboardList className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Bitácora del Sistema</h1>
            <p className="text-muted-foreground">Registro de acciones realizadas por los usuarios</p>
          </div>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por acción, descripción o IP..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>

        <div className="bg-card rounded-3xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50">
                  <TableHead>Fecha</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                      Cargando...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                      No se encontraron registros
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(row => (
                    <TableRow key={row.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {row.fecha ? row.fecha.substring(0, 19).replace('T', ' ') : 'Sin fecha'}
                      </TableCell>
                      <TableCell className="font-semibold text-sm max-w-[120px] truncate">
                        {row.usuario ? (row.usuario.includes('@') ? row.usuario.split('@')[0] : row.usuario.substring(0, 8) + '...') : 'Sistema'}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                          row.accion === 'LOGIN' ? 'bg-green-100 text-green-700' :
                          row.accion === 'LOGOUT' ? 'bg-orange-100 text-orange-700' :
                          row.accion?.includes('FALLIDO') ? 'bg-red-100 text-red-700' :
                          'bg-primary/10 text-primary'
                        }`}>
                          {row.accion}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                        {row.descripcion}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {row.ip || '-'}
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