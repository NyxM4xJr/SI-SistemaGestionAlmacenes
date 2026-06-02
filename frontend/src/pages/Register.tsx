import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, Role } from "@/context/AuthContext";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

/**
 * Register - Página de Registro de Usuarios.
 *
 * Esta página muestra un formulario para que nuevos usuarios creen
 * una cuenta en el sistema. Todos los usuarios se registran con el
 * rol "usuario" por defecto (no pueden elegir rol).
 *
 * Validaciones implementadas:
 * - Nombre: Solo letras y espacios, 3-50 caracteres.
 * - Email: Formato de email válido.
 * - Contraseña: Mínimo 8 caracteres, debe contener al menos:
 *   una mayúscula, una minúscula, un número y un carácter especial.
 * - Confirmación de contraseña: Debe coincidir con la contraseña.
 *
 * Flujo:
 * 1. Usuario llena el formulario.
 * 2. Se validan los campos localmente.
 * 3. Se llama a la función register() del AuthContext.
 * 4. Si es exitoso, se muestra un mensaje de confirmación de email.
 * 5. Después de 3 segundos, se redirige automáticamente al login (/login).
 *
 * Fecha: 05/05/26
 */

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  // Toggle de visibilidad independiente para cada campo
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validación de nombre (sin números ni caracteres especiales)
    const nombreRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;
    if (!nombreRegex.test(name.trim())) {
      toast.error("El nombre solo puede contener letras y espacios.");
      return;
    }
    if (name.trim().length < 3) {
      toast.error("El nombre debe tener al menos 3 caracteres.");
      return;
    }
    if (name.trim().length > 50) {
      toast.error("El nombre no puede exceder los 50 caracteres.");
      return;
    }

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
    const result = await register({ nombre: name, email, password, rol: "usuario" });

    setLoading(false);

    if (!result.ok) {
      toast.error(result.error || "Error al registrar. Intenta con otro email.");
      return;
    }

    toast.success("¡Cuenta creada! Revisa tu correo electrónico para confirmarla.");
    setTimeout(() => {
      navigate("/login");
    }, 3000);
  };

  return (
    <AuthLayout title="Crear Cuenta" subtitle="Únete a la cocina digital">
      <form onSubmit={onSubmit} className="space-y-4">
        {/* Nombre */}
        <div className="space-y-2">
          <Label className="text-base">Nombre completo</Label>
          <Input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Carlos Pérez"
            className="chef-touch"
          />
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label className="text-base">Email</Label>
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@cocina.com"
            className="chef-touch"
          />
        </div>

        {/* Contraseña + Confirmar en grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Contraseña */}
          <div className="space-y-2">
            <Label className="text-base">Contraseña</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                className="chef-touch pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-200 focus:outline-none"
                tabIndex={-1}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword
                  ? <EyeOff className="h-4 w-4" />
                  : <Eye className="h-4 w-4" />
                }
              </button>
            </div>
          </div>

          {/* Confirmar contraseña */}
          <div className="space-y-2">
            <Label className="text-base">Confirmar</Label>
            <div className="relative">
              <Input
                type={showConfirm ? "text" : "password"}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••"
                className="chef-touch pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-200 focus:outline-none"
                tabIndex={-1}
                aria-label={showConfirm ? "Ocultar confirmación" : "Mostrar confirmación"}
              >
                {showConfirm
                  ? <EyeOff className="h-4 w-4" />
                  : <Eye className="h-4 w-4" />
                }
              </button>
            </div>
          </div>
        </div>

        <p className="text-sm text-muted-foreground text-center">
          Tu cuenta se creará con el rol de <strong>Usuario</strong>.
          Un administrador podrá asignarte más permisos si es necesario.
        </p>

        <Button
          type="submit"
          size="lg"
          className="w-full chef-touch text-lg font-semibold shadow-soft mt-2"
          disabled={loading}
        >
          {loading ? "Registrando..." : "Registrarse"}
        </Button>

        <p className="text-center text-sm text-muted-foreground pt-2">
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" className="text-primary font-semibold hover:underline">
            Inicia sesión
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}