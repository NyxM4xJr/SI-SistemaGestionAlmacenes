import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Eye, EyeOff } from "lucide-react";

/**
 * UpdatePassword - Página de Cambio de Contraseña.
 *
 * Esta página es accedida a través del enlace enviado por correo
 * electrónico cuando un usuario solicita recuperar su contraseña.
 *
 * Características:
 * - Captura el token de recuperación de la URL (query string).
 * - Verifica el token OTP con Supabase Auth.
 * - Muestra el email del usuario para confirmación visual.
 * - Formulario con campos: Nueva Contraseña y Confirmar Contraseña.
 * - Toggle de visibilidad de contraseña (ojito) en ambos campos.
 * - Validaciones de contraseña fuerte implementadas.
 * - Limpieza de sesión anterior (localStorage/sessionStorage).
 * - Cierre de sesión automático después del cambio.
 * - Redirección al login después de 2 segundos.
 *
 * Validaciones de contraseña:
 * - Mínimo 8 caracteres.
 * - Al menos una letra mayúscula.
 * - Al menos una letra minúscula.
 * - Al menos un número.
 * - Al menos un carácter especial (!@#$%^&*...).
 *
 * Fecha: 05/05/26
 */

export default function UpdatePassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  // Toggle de visibilidad independiente para cada campo
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const search = location.search;

    if (search) {
      const params = new URLSearchParams(search);
      const tokenHash = params.get("token_hash");
      const type = params.get("type");

      if (tokenHash && type === "recovery") {
        supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        }).then(({ data, error }) => {
          if (error) {
            console.error("Error verificando OTP:", error);
            toast.error("El enlace de recuperación no es válido o ha expirado.");
            navigate("/login");
          } else {
            if (data.session?.access_token) {
              localStorage.setItem("access_token", data.session.access_token);
              localStorage.setItem("refresh_token", data.session.refresh_token || "");
            }
            if (data.user?.email) {
              setEmail(data.user.email);
            }
            toast.success(`Restableciendo contraseña para ${data.user?.email || "tu cuenta"}`);
          }
        });
      } else {
        toast.error("El enlace de recuperación no es válido o ha expirado.");
        navigate("/login");
      }
    }
  }, [location, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validación de contraseña fuerte
    if (password.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (!/[A-Z]/.test(password)) {
      toast.error("La contraseña debe contener al menos una letra mayúscula.");
      return;
    }
    if (!/[a-z]/.test(password)) {
      toast.error("La contraseña debe contener al menos una letra minúscula.");
      return;
    }
    if (!/[0-9]/.test(password)) {
      toast.error("La contraseña debe contener al menos un número.");
      return;
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      toast.error("La contraseña debe contener al menos un carácter especial (!@#$%^&*...).");
      return;
    }
    if (password !== confirm) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      console.error("Error updating password:", error);
      toast.error(error.message);
      setLoading(false);
    } else {
      // Registrar en bitácora
      try {
        const token = localStorage.getItem("access_token");
        if (token) {
          await fetch(`${import.meta.env.VITE_API_URL}/auth/log-password-reset/`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      } catch (e) {
        console.warn("No se pudo registrar en bitácora:", e);
      }

      toast.success(`¡Contraseña actualizada con éxito para ${email || "tu cuenta"}!`);

      await supabase.auth.signOut();

      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("user");

      setTimeout(() => {
        navigate("/login");
      }, 2000);

      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-soft p-4">
      <div className="w-full max-w-md">
        <form onSubmit={handleSubmit} className="bg-card p-8 rounded-3xl shadow-card space-y-5">
          <h2 className="text-2xl font-bold text-center">Crear Nueva Contraseña</h2>

          {email && (
            <p className="text-sm text-center bg-primary/10 text-primary py-2 px-4 rounded-full">
              Para: <strong>{email}</strong>
            </p>
          )}

          <p className="text-sm text-muted-foreground text-center">
            Ingresa y confirma tu nueva contraseña.
          </p>

          {/* Nueva contraseña */}
          <div className="space-y-2">
            <Label>Nueva Contraseña</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="chef-touch pr-12"
                autoComplete="new-password"
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

          {/* Confirmar contraseña */}
          <div className="space-y-2">
            <Label>Confirmar Contraseña</Label>
            <div className="relative">
              <Input
                type={showConfirm ? "text" : "password"}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className="chef-touch pr-12"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((prev) => !prev)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-200 focus:outline-none"
                tabIndex={-1}
                aria-label={showConfirm ? "Ocultar confirmación" : "Mostrar confirmación"}
              >
                {showConfirm
                  ? <EyeOff className="h-5 w-5" />
                  : <Eye className="h-5 w-5" />
                }
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full chef-touch text-lg" disabled={loading}>
            {loading ? "Actualizando..." : "Actualizar Contraseña"}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Al actualizar, se cerrará tu sesión y deberás iniciar sesión nuevamente.
          </p>
        </form>
      </div>
    </div>
  );
}