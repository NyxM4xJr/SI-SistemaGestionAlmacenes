/**
 * ============================================================
 * ARCHIVO: frontend/src/pages/BitacoraList.tsx
 * CASO DE USO: CU30 - Consultar Detalle de Bitácora
 * CICLO: 2
 * FECHA: 10/05/26
 * AUTORES: .....
 * 
 * DESCRIPCIÓN: Consulta de registros de bitácora del sistema.
 * Muestra las acciones realizadas por los usuarios con filtros
 * por fecha, tipo de acción y usuario.
 * 
 * PENDIENTE: Conectar con el endpoint real de bitácora.
 * Actualmente muestra datos simulados como placeholder.
 * ============================================================
 */

import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, ClipboardList } from "lucide-react";

// Datos placeholder hasta conectar con el backend
const PLACEHOLDER_DATA = [
  { id: 1, fecha: "2026-05-10 14:30", usuario: "Juan Perez", accion: "CREAR_INSUMO", detalle: "Creó insumo 'Tomate'", ip: "192.168.1.1" },
  { id: 2, fecha: "2026-05-10 14:25", usuario: "Maria Lopez", accion: "LOGIN", detalle: "Inicio de sesión exitoso", ip: "192.168.1.2" },
  { id: 3, fecha: "2026-05-09 18:00", usuario: "Juan Perez", accion: "EDITAR_INSUMO", detalle: "Editó insumo 'Cebolla'", ip: "192.168.1.1" },
  { id: 4, fecha: "2026-05-09 17:45", usuario: "Carlos Rojas", accion: "LOGOUT", detalle: "Cierre de sesión", ip: "192.168.1.3" },
  { id: 5, fecha: "2026-05-09 16:00", usuario: "Ana Torres", accion: "LISTAR_INSUMOS", detalle: "Consultó lista de insumos", ip: "192.168.1.4" },
];

export default function BitacoraList() {
  const [search, setSearch] = useState("");

  const filtered = PLACEHOLDER_DATA.filter(row =>
    row.usuario.toLowerCase().includes(search.toLowerCase()) ||
    row.accion.toLowerCase().includes(search.toLowerCase()) ||
    row.detalle.toLowerCase().includes(search.toLowerCase())
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
          <Input placeholder="Buscar por usuario, acción o detalle..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>

        <div className="bg-card rounded-3xl shadow-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/50">
                <TableHead>Fecha</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead>Detalle</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    No se encontraron registros
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(row => (
                  <TableRow key={row.id}>
                    <TableCell className="text-sm">{row.fecha}</TableCell>
                    <TableCell className="font-semibold">{row.usuario}</TableCell>
                    <TableCell>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        {row.accion}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.detalle}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.ip}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
}