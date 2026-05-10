/**
 * ============================================================
 * ARCHIVO: frontend/src/pages/AdminPermisos.tsx
 * CASO DE USO: CU02 - Administrar Usuarios y Permisos
 * CICLO: 2
 * FECHA: 10/05/26
 * 
 * DESCRIPCIÓN: Lista simplificada de usuarios con filtros
 * por nombre, email, rol y estado. Permite ordenación por
 * columnas. No permite edición directa (solo visualización).
 * ============================================================
 */

import { useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Users } from "lucide-react";

type SortKey = "nombre" | "email" | "rol";
type SortDir = "asc" | "desc";

export default function AdminPermisos() {
  const { users } = useAuth();
  const [search, setSearch] = useState("");
  const [filterRol, setFilterRol] = useState<string>("todos");
  const [filterActivo, setFilterActivo] = useState<string>("todos");
  const [sortKey, setSortKey] = useState<SortKey>("nombre");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    let result = [...users];
    
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(u => u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    if (filterRol !== "todos") {
      result = result.filter(u => u.rol === filterRol);
    }
    if (filterActivo !== "todos") {
      const activo = filterActivo === "activo";
      result = result.filter(u => (u.activo !== false) === activo);
    }
    
    result.sort((a, b) => {
      const valA = a[sortKey]?.toLowerCase?.() || "";
      const valB = b[sortKey]?.toLowerCase?.() || "";
      return sortDir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
    
    return result;
  }, [users, search, filterRol, filterActivo, sortKey, sortDir]);

  return (
    <div className="min-h-screen bg-gradient-soft">
      <AppHeader />
      <main className="container py-8 max-w-6xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 grid place-items-center">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Administrar Usuarios y Permisos</h1>
            <p className="text-muted-foreground">Visualización y ordenación de usuarios registrados</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nombre o email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={filterRol} onValueChange={setFilterRol}>
            <SelectTrigger><SelectValue placeholder="Filtrar por rol" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los roles</SelectItem>
              <SelectItem value="administrador">Administrador</SelectItem>
              <SelectItem value="chef">Chef</SelectItem>
              <SelectItem value="gerente">Gerente</SelectItem>
              <SelectItem value="usuario">Ayudante de Cocina</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterActivo} onValueChange={setFilterActivo}>
            <SelectTrigger><SelectValue placeholder="Filtrar por estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              <SelectItem value="activo">Activos</SelectItem>
              <SelectItem value="inactivo">Inactivos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabla */}
        <div className="bg-card rounded-3xl shadow-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/50">
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("nombre")}>
                  Nombre {sortKey === "nombre" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("email")}>
                  Email {sortKey === "email" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("rol")}>
                  Rol {sortKey === "rol" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                </TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                    No se encontraron usuarios
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(u => (
                  <TableRow key={u.id}>
                    <TableCell className="font-semibold">{u.nombre}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell className="capitalize">{u.rol}</TableCell>
                    <TableCell>
                      {u.activo !== false ? (
                        <span className="inline-flex items-center gap-2 text-sm font-medium text-green-600">
                          <span className="h-2 w-2 rounded-full bg-green-500" /> Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2 text-sm font-medium text-destructive">
                          <span className="h-2 w-2 rounded-full bg-destructive" /> Inactivo
                        </span>
                      )}
                    </TableCell>
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