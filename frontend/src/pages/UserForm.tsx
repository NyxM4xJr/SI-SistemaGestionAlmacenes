/**
 * ============================================================
 * ARCHIVO: frontend/src/pages/UserForm.tsx
 * CASO DE USO: CU05 - Gestionar Usuario
 * CICLO: 2
 * FECHA: 10/05/26
 * 
 * DESCRIPCIÓN: Formulario reutilizable para crear y editar
 * usuarios. Cambia entre modo "crear" y "editar" según la ruta.
 * 
 * Modos:
 * - /admin/usuarios/crear → Formulario vacío, crea nuevo usuario
 * - /admin/usuarios/:id/editar → Precarga datos, actualiza usuario
 * ============================================================
 */

import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth, Role } from "@/context/AuthContext";
import { toast } from "sonner";
import { ArrowLeft, Save, UserPlus } from "lucide-react";

export default function UserForm() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const { users } = useAuth();

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<Role>("usuario");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isEditing && id) {
      const user = users.find(u => u.id === id);
      if (user) {
        setNombre(user.nombre);
        setEmail(user.email);
        setRol(user.rol);
      }
    }
  }, [id, isEditing, users]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const token = localStorage.getItem("access_token");
    if (!token) {
      toast.error("No autenticado");
      setLoading(false);
      return;
    }

    const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";
    
    try {
      let response: Response;
      
      if (isEditing && id) {
        response = await fetch(`${API_URL}/auth/users/${id}/`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ nombre, email }),
        });
      } else {
        response = await fetch(`${API_URL}/auth/users/create/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ nombre, email, password, rol }),
        });
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Error al guardar");
      }

      toast.success(isEditing ? "Usuario actualizado" : "Usuario creado");
      navigate("/admin/usuarios");
    } catch (err: any) {
      toast.error(err.message || "Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-soft">
      <AppHeader />
      <main className="container py-8 max-w-2xl">
        <Button variant="ghost" onClick={() => navigate("/admin/usuarios")} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>

        <div className="flex items-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 grid place-items-center">
            {isEditing ? <Save className="h-6 w-6 text-primary" /> : <UserPlus className="h-6 w-6 text-primary" />}
          </div>
          <div>
            <h1 className="text-3xl font-bold">{isEditing ? "Editar Usuario" : "Crear Usuario"}</h1>
            <p className="text-muted-foreground">
              {isEditing ? "Modifica los datos del usuario" : "Registra un nuevo usuario en el sistema"}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-card rounded-3xl shadow-card p-8 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre Completo *</Label>
            <Input id="nombre" required value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Juan Pérez" disabled={loading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="juan@cocina.com" disabled={loading} />
          </div>
          {!isEditing && (
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña *</Label>
              <Input id="password" type="password" required={!isEditing} value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" disabled={loading} />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="rol">Rol *</Label>
            <Select value={rol} onValueChange={v => setRol(v as Role)} disabled={loading}>
              <SelectTrigger><SelectValue placeholder="Seleccionar rol" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="administrador">Administrador</SelectItem>
                <SelectItem value="chef">Chef</SelectItem>
                <SelectItem value="gerente">Gerente</SelectItem>
                <SelectItem value="usuario">Ayudante de Cocina</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" size="lg" className="w-full text-lg font-semibold shadow-soft" disabled={loading}>
            {loading ? "Guardando..." : isEditing ? "Guardar Cambios" : "Crear Usuario"}
          </Button>
        </form>
      </main>
    </div>
  );
}