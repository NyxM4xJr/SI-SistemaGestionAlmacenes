import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";

/**
 * Login - Página de Inicio de Sesión.
 *
 * Esta página muestra un formulario para que los usuarios ingresen
 * con su email y contraseña. Se comunica con el backend Django/Supabase
 * a través del contexto de autenticación (AuthContext).
 *
 * Características:
 * - Formulario con campos Email y Contraseña.
 * - Botón "Iniciar Sesión" con estado de carga.
 * - Toggle de visibilidad de contraseña (ojito).
 * - Enlace a "¿Olvidaste tu contraseña?" (ForgotPassword).
 * - Enlace a "¿No tienes cuenta? Regístrate" (Register).
 * - Manejo de errores con mensajes toast.
 *
 * Flujo:
 * 1. Usuario ingresa credenciales.
 * 2. Se llama a la función login() del AuthContext.
 * 3. Si es exitoso, se redirige al perfil (/perfil).
 * 4. Si falla, se muestra un mensaje de error.
 *
 * Fecha: 05/05/26
 */

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const res = await login(email, password);

    setLoading(false);

    if (!res.ok) {
      return toast.error(res.error || "Error al iniciar sesión");
    }

    toast.success("¡Bienvenido de vuelta!");
    navigate("/perfil");
  };

  return (
    <AuthLayout title="Iniciar Sesión" subtitle="Accede a tu almacén gastronómico">
      <form onSubmit={onSubmit} className="space-y-5">
        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email" className="text-base">Email</Label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@cocina.com"
              className="chef-touch pl-12"
              disabled={loading}
            />
          </div>
        </div>

        {/* Contraseña con toggle de visibilidad */}
        <div className="space-y-2">
          <Label htmlFor="password" className="text-base">Contraseña</Label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="chef-touch pl-12 pr-12"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-200 focus:outline-none"
              tabIndex={-1}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword
                ? <EyeOff className="h-5 w-5" />
                : <Eye className="h-5 w-5" />
              }
            </button>
          </div>
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full chef-touch text-lg font-semibold shadow-soft"
          disabled={loading}
        >
          {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
        </Button>

        <div className="flex flex-col items-center gap-3 pt-2 text-sm">
          <Link to="/recuperar" className="text-primary font-medium hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
          <p className="text-muted-foreground">
            ¿No tienes cuenta?{" "}
            <Link to="/registro" className="text-primary font-semibold hover:underline">Regístrate</Link>
          </p>
        </div>
      </form>
    </AuthLayout>
  );
}