import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, Role } from "@/context/AuthContext";
import { ChefHat, ShieldCheck, User,Briefcase, LogOut, Edit3, Save, X, Mail, User as UserIcon } from "lucide-react";
import { toast } from "sonner";


/**
 * Profile - Página de Perfil de Usuario.
 * 
 * Esta página muestra la información del usuario autenticado y permite
 * editar su nombre y email. También incluye un botón para cerrar sesión.
 * 
 * Características:
 * - Vista de perfil con nombre, email y rol.
 * - Icono representativo según el rol (chef, admin, usuario).
 * - Modo edición: Permite cambiar nombre y email.
 * - Botón "Cerrar Sesión" con confirmación.
 * - Diseño responsivo con gradiente de fondo.
 * 
 * Flujo de edición:
 * 1. Usuario hace clic en "Editar Perfil".
 * 2. Se muestran campos editables para nombre y email.
 * 3. Usuario modifica los campos y hace clic en "Guardar".
 * 4. Se llama a updateProfile() del AuthContext.
 * 5. Si es exitoso, se actualiza la vista y se recarga la página.
 * 
 * Fecha: 05/05/26
 */

const ROLE_META: Record<Role, { label: string; icon: React.ElementType; color: string }> = {
  chef: { label: "Chef", icon: ChefHat, color: "from-primary to-primary-glow" },
  administrador: { label: "Administrador", icon: ShieldCheck, color: "from-accent to-primary" },
  usuario: { label: "Ayudante de Cocina", icon: User, color: "from-primary-glow to-primary" },
  gerente:  { label: "Gerente", icon: Briefcase, color: "from-primary-glow to-primary" },
};

export default function Profile() {
  const { user, logout, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.nombre ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [loading, setLoading] = useState(false);

  if (!user) return null;
  
  const meta = ROLE_META[user.rol] || ROLE_META.usuario;
  const Icon = meta.icon;
  const isChef = user.rol === "chef";

  const save = async () => {
    // Validaciones básicas
    if (!name.trim()) {
      toast.error("El nombre no puede estar vacío");
      return;
    }
    if (!email.trim()) {
      toast.error("El email no puede estar vacío");
      return;
    }
    
    setLoading(true);
    
    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        toast.error("No se encontró la sesión. Inicia sesión nuevamente.");
        navigate("/login");
        return;
      }
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/profile/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          nombre: name,
          email: email
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al actualizar el perfil");
      }
      
      const updatedData = await response.json();
      
      // Actualizar el usuario en el contexto y en localStorage
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        userData.nombre = updatedData.nombre || name;
        userData.email = updatedData.email || email;
        localStorage.setItem("user", JSON.stringify(userData));
      }
      
      // Actualizar el estado local
      setName(updatedData.nombre || name);
      setEmail(updatedData.email || email);
      
      setEditing(false);
      toast.success("Perfil actualizado exitosamente");
      
      // Recargar la página para reflejar cambios en el header
      window.location.reload();
      
    } catch (error: any) {
      console.error("Error actualizando perfil:", error);
      toast.error(error.message || "Error al actualizar el perfil");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-soft">
      <AppHeader />
      <main className="container py-8 lg:py-14 max-w-3xl">
        <div className="bg-card rounded-3xl shadow-card overflow-hidden">
          {/* Banner */}
          <div className={`h-40 bg-gradient-to-br ${meta.color} relative`}>
            <div className="absolute -bottom-12 left-8 lg:left-12">
              <div className="h-24 w-24 lg:h-28 lg:w-28 rounded-3xl bg-card border-4 border-card shadow-soft grid place-items-center">
                <Icon className="h-12 w-12 lg:h-14 lg:w-14 text-primary" />
              </div>
            </div>
          </div>

          <div className="pt-16 lg:pt-20 px-6 lg:px-12 pb-8 lg:pb-12">
            {!editing ? (
              <>
                <div className="flex flex-wrap items-center gap-3 mb-1">
                  <h1 className="text-3xl lg:text-4xl font-bold">{user.nombre}</h1>
                  <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold">
                    {meta.label}
                  </span>
                </div>
                <p className="text-muted-foreground text-lg flex items-center gap-2 mb-8">
                  <Mail className="h-5 w-5" /> {user.email}
                </p>

                <div><span className="font-bold">Tipo:</span> {user.tipo || 'No especificado'}</div>

                <div className="grid sm:grid-cols-2 gap-3 max-w-xl">
                  <Button
                    size="lg"
                    onClick={() => setEditing(true)}
                    className={`${isChef ? "chef-touch text-lg" : ""} shadow-soft`}
                  >
                    <Edit3 className="mr-2 h-5 w-5" /> Editar Perfil
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={async () => { 
                      await logout(); 
                      navigate("/login"); 
                      toast.success("Sesión cerrada"); 
                    }}
                    className={isChef ? "chef-touch text-lg" : ""}
                  >
                    <LogOut className="mr-2 h-5 w-5" /> Cerrar Sesión
                  </Button>
                </div>

                {isChef && (
                  <div className="mt-10 p-6 rounded-2xl bg-secondary/50 border border-border">
                    <h3 className="font-bold text-lg mb-2">👨‍🍳 Bienvenido, Chef</h3>
                    <p className="text-muted-foreground">
                      Tu interfaz está pensada para uso rápido en cocina: botones grandes, contraste alto y navegación táctil.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-5 max-w-xl">
                <h2 className="text-2xl font-bold">Editar Perfil</h2>
                <div className="space-y-2">
                  <Label className="text-base">Nombre</Label>
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input value={name} onChange={(e) => setName(e.target.value)} className="chef-touch pl-12" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-base">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="chef-touch pl-12" />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button 
                    size="lg" 
                    onClick={save} 
                    className={`${isChef ? "chef-touch" : ""} flex-1 shadow-soft`}
                    disabled={loading}
                  >
                    <Save className="mr-2 h-5 w-5" /> 
                    {loading ? "Guardando..." : "Guardar"}
                  </Button>
                  <Button 
                    size="lg" 
                    variant="outline" 
                    onClick={() => { 
                      setEditing(false); 
                      setName(user.nombre); 
                      setEmail(user.email); 
                    }}
                    className={`${isChef ? "chef-touch" : ""} flex-1`}
                    disabled={loading}
                  >
                    <X className="mr-2 h-5 w-5" /> Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}