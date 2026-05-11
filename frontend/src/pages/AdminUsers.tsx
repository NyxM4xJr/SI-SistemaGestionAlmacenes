import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { useAuth, Role } from "@/context/AuthContext";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Users, UserCheck, UserX, ChefHat, ShieldCheck, User, UserPlus , Briefcase, Pencil} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

// ✅ Roles actualizados
const ROLE_ICON: Record<Role, React.ElementType> = {
  chef: ChefHat,
  administrador: ShieldCheck,
  gerente: Briefcase,        // ← Usa Briefcase de lucide-react
  usuario: User,
};

const ROLE_LABEL: Record<Role, string> = {
  chef: "Chef",
  administrador: "Administrador",
  gerente: "Gerente",        // ← Agregar
  usuario: "Ayudante de Cocina",
};


export default function AdminUsers() {
  const { users, changeUserRole, toggleUserActive, user: me, refreshUsers } = useAuth();
  const navigate = useNavigate();

  // Forzar recarga al montar
  useEffect(() => {
    refreshUsers();
  }, []);  // ← Array vacío = solo al montar

  // ✅ Filtrar usuarios activos (simulado por ahora)
  const activeCount = users.length; // Cuando el backend tenga "activo", cambiar

  return (
    <div className="min-h-screen bg-gradient-soft">
      <AppHeader />
      <main className="container py-8 max-w-6xl">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 grid place-items-center">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Gestión de Usuarios</h1>
              <p className="text-muted-foreground">Administra roles y estado de las cuentas</p>
            </div>
          </div>
          
          <Button 
            size="lg" 
            className="shadow-soft"
            onClick={() => navigate("/admin/usuarios/crear")}
          >
            <UserPlus className="mr-2 h-5 w-5" /> Crear Usuario
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 my-6">
          <StatCard label="Total" value={users.length} />
          <StatCard label="Activos" value={activeCount} />
          <StatCard label="Chefs" value={users.filter((u) => u.rol === "chef").length} />
          <StatCard label="Admins" value={users.filter((u) => u.rol === "administrador").length} />
          <StatCard label="Gerentes" value={users.filter((u) => u.rol === "gerente").length} />
        </div>

        <div className="bg-card rounded-3xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50 hover:bg-secondary/50">
                  <TableHead className="font-bold">Nombre</TableHead>
                  <TableHead className="font-bold">Email</TableHead>
                  <TableHead className="font-bold">Rol</TableHead>
                  <TableHead className="font-bold">Estado</TableHead>
                  <TableHead className="font-bold text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => {
                  const Icon = ROLE_ICON[u.rol] || User;
                  const isMe = u.id === me?.id;
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-semibold">
                        {u.nombre} {isMe && <span className="text-xs text-primary ml-2">(tú)</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                          <Icon className="h-4 w-4" /> {ROLE_LABEL[u.rol] || u.rol}
                        </span>
                      </TableCell>
                      <TableCell>
                        {u.activo !== false ? (
                          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium bg-success/15 text-success">
                            <span className="h-2 w-2 rounded-full bg-success" />
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium bg-destructive/15 text-destructive">
                            <span className="h-2 w-2 rounded-full bg-destructive" />
                            Inactivo
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end items-center gap-1 flex-wrap">
                          {/* NUEVO: Botón Editar */}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/admin/usuarios/${u.id}/editar`)}
                            title="Editar usuario"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Select
                            value={u.rol}
                            onValueChange={(v: Role) => {
                              changeUserRole(u.id, v);
                              toast.success(`Rol actualizado a ${ROLE_LABEL[v]}`);
                            }}
                            disabled={isMe}
                          >
                            <SelectTrigger className="w-[160px]">
                              <SelectValue placeholder="Cambiar Rol" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="chef">Chef</SelectItem>
                              <SelectItem value="administrador">Administrador</SelectItem>
                              <SelectItem value="gerente">Gerente</SelectItem>
                              <SelectItem value="usuario">Usuario</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant={u.activo !== false ? "outline" : "default"}
                            size="sm"
                            disabled={isMe}
                            onClick={() => {
                              toggleUserActive(u.id);
                              toast.success(u.activo !== false ? "Usuario desactivado" : "Usuario activado");
                            }}
                          >
                            {u.activo !== false ? (
                              <><UserX className="mr-1 h-4 w-4" /> Desactivar</>
                            ) : (
                              <><UserCheck className="mr-1 h-4 w-4" /> Activar</>
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
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