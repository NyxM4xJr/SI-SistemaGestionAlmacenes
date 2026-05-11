/**
 * ============================================================
 * ARCHIVO: frontend/src/pages/AdminRoles.tsx
 * CASO DE USO: CU06 - Asignar Roles a Usuario
 * CICLO: 2
 * FECHA: 10/05/26
 * 
 * DESCRIPCIÓN: Lista de usuarios con selector rápido de rol.
 * Permite cambiar el rol de cualquier usuario (excepto a sí mismo)
 * con un solo clic desde un menú desplegable.
 * ============================================================
 */

import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { useAuth, Role } from "@/context/AuthContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ShieldCheck, ChefHat, User as UserIcon, Briefcase } from "lucide-react";

const ROLE_ICON: Record<Role, React.ElementType> = {
  administrador: ShieldCheck,
  chef: ChefHat,
  gerente: Briefcase,
  usuario: UserIcon,
};

const ROLE_LABEL: Record<Role, string> = {
  administrador: "Administrador",
  chef: "Chef",
  gerente: "Gerente",
  usuario: "Ayudante de Cocina",
};

export default function AdminRoles() {
  const { users, changeUserRole, user: me } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-soft">
      <AppHeader />
      <main className="container py-8 px-4 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 grid place-items-center">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Asignar Roles</h1>
            <p className="text-muted-foreground">Cambia el rol de los usuarios del sistema</p>
          </div>
        </div>

        <div className="bg-card rounded-3xl shadow-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/50">
                <TableHead>Usuario</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol Actual</TableHead>
                <TableHead>Cambiar a</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(u => {
                const Icon = ROLE_ICON[u.rol] || UserIcon;
                const isMe = u.id === me?.id;
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-semibold">
                      {u.nombre} {isMe && <span className="text-xs text-primary ml-2">(tú)</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                        <Icon className="h-4 w-4" /> {ROLE_LABEL[u.rol]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={u.rol}
                        onValueChange={v => {
                          changeUserRole(u.id, v as Role);
                          toast.success(`Rol de ${u.nombre} cambiado a ${ROLE_LABEL[v as Role]}`);
                        }}
                        disabled={isMe}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Cambiar rol" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="administrador">Administrador</SelectItem>
                          <SelectItem value="chef">Chef</SelectItem>
                          <SelectItem value="gerente">Gerente</SelectItem>
                          <SelectItem value="usuario">Ayudante de Cocina</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
}