/**
 * ============================================================
 * ARCHIVO: frontend/src/components/Sidebar.tsx
 * CASOS DE USO: Todos (navegación global)
 * CICLO: 2
 * FECHA: 10/05/26
 * 
 * DESCRIPCIÓN: Menú lateral desplegable (drawer) con 3 niveles
 * de anidamiento basado en los 6 paquetes del Análisis de
 * Arquitectura. Se desplaza desde la izquierda sobre el contenido.
 * 
 * Características:
 * - Filtrado dinámico por rol del usuario
 * - Animación de expansión/colapso por nivel
 * - Resalta la página activa
 * - Cierra automáticamente al navegar
 * 
 * PUNTO DE CONTROL: 3.1.4 - App Web: Presentación de Paquetes y CU
 * ============================================================
 */

import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { menuConfig, filterMenuByRole, MenuNode } from "@/config/menuConfig";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, ChevronRight, Menu } from "lucide-react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { toast } from "sonner";

export default function Sidebar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  
  // Controla qué nodos están expandidos (por ID)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  if (!user) return null;

  // Obtener menú filtrado por rol
  const menu = filterMenuByRole(menuConfig, user.rol);

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleNavigate = (path: string) => {
    if (!path) {
      toast.info("Funcionalidad próxima a implementarse");
      return;
    }
    navigate(path);
    setOpen(false);
  };

  const isActive = (path: string) => {
    if (path.includes(":id")) return false;
    return pathname === path || pathname.startsWith(path + "/");
  };

  /**
   * Renderiza recursivamente un nodo del menú.
   * Si tiene hijos, muestra un botón expandible.
   * Si no, muestra un enlace directo.
   */
  const renderNode = (node: MenuNode, depth: number) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;

    if (hasChildren) {
      return (
        <div key={node.id}>
          <button
            onClick={() => toggleNode(node.id)}
            className={`w-full flex items-center justify-between p-2 rounded-lg text-sm transition-colors ${
              depth === 0
                ? "font-semibold hover:bg-primary/10"
                : "hover:bg-secondary/30"
            }`}
          >
            <span>{node.label}</span>
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 flex-shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 flex-shrink-0" />
            )}
          </button>
          {isExpanded && (
            <div className={`${depth === 0 ? "ml-3 border-l-2 border-primary/20 pl-3" : "ml-4"}`}>
              {node.children!.map(child => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    // Nodo hoja (página directa)
    return (
      <button
        key={node.id}
        onClick={() => node.path && handleNavigate(node.path)}
        className={`w-full text-left p-2 rounded-lg text-sm transition-colors truncate ${
          node.path && isActive(node.path)
            ? "bg-primary/10 text-primary font-medium"
            : "hover:bg-secondary/30 text-foreground"
        }`}
      >
        {node.label}
      </button>
    );
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="chef-touch" title="Menú">
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[85vw] max-w-sm sm:w-80 md:w-96 p-0">
        <SheetTitle>
          <VisuallyHidden>Menú de Navegación</VisuallyHidden>
        </SheetTitle>
        <SheetDescription>
          <VisuallyHidden>Navegación principal con los 6 paquetes del sistema</VisuallyHidden>
        </SheetDescription>
        
        {/* Cabecera */}
        <div className="p-4 border-b bg-primary/5">
          <h2 className="text-lg font-bold">Menú Principal</h2>
          <p className="text-sm text-muted-foreground capitalize">
            {user.nombre} · {user.rol}
          </p>
        </div>

        {/* Contenido del menú */}
        <ScrollArea className="h-[calc(100vh-80px)]">
          <div className="p-3 space-y-1">
            {menu.map(group => renderNode(group, 0))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}