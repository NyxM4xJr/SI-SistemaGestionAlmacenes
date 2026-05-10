/**
 * ============================================================
 * ARCHIVO: frontend/src/config/menuConfig.ts
 * CASOS DE USO: Todos (estructura global del sistema)
 * CICLO: 2
 * FECHA: 10/05/26
 * 
 * DESCRIPCIÓN: Configuración jerárquica del menú lateral basada
 * en los 6 paquetes del Análisis de Arquitectura (Capítulo 3.1.3).
 * 
 * Estructura:
 * - Nivel 1: Paquete (ej: "Administración de Usuarios")
 * - Nivel 2: Grupo funcional o CU directo
 * - Nivel 3: Subopciones de CU (ej: "Lista de Usuarios")
 * 
 * Cada nodo tiene una lista de roles permitidos. El menú se
 * filtra dinámicamente según el rol del usuario autenticado.
 * 
 * PUNTO DE CONTROL: 3.1.4 - App Web: Presentación de Paquetes y CU
 * ============================================================
 */

import { Role } from "@/context/AuthContext";

export interface MenuNode {
  id: string;
  label: string;
  path?: string;
  roles: Role[];
  children?: MenuNode[];
}

export const menuConfig: MenuNode[] = [
  // PAQUETE 1: Administración de Usuarios
  {
    id: "pkg-usuarios",
    label: "Administración de Usuarios",
    roles: ["administrador", "chef", "gerente", "usuario"],
    children: [
      {
        id: "cu04",
        label: "Administrar Perfil",
        path: "/perfil",
        roles: ["administrador", "chef", "gerente", "usuario"],
      },
      {
        id: "cu05",
        label: "Gestionar Usuarios",
        roles: ["administrador"],
        children: [
          { id: "cu05-list", label: "Lista de Usuarios", path: "/admin/usuarios", roles: ["administrador"] },
          { id: "cu05-create", label: "Crear Usuario", path: "/admin/usuarios/crear", roles: ["administrador"] },
        ],
      },
      {
        id: "cu02",
        label: "Administrar Usuarios y Permisos",
        path: "/admin/permisos",
        roles: ["administrador"],
      },
      {
        id: "cu06",
        label: "Asignar Roles",
        path: "/admin/roles",
        roles: ["administrador"],
      },
      {
        id: "cu30",
        label: "Bitácora del Sistema",
        path: "/bitacora",
        roles: ["administrador", "gerente"],
      },
    ],
  },

  // PAQUETE 2: Gestión de Insumos
  {
    id: "pkg-insumos",
    label: "Gestión de Insumos",
    roles: ["administrador", "chef", "gerente", "usuario"],
    children: [
      {
        id: "cu07",
        label: "Gestionar Insumos",
        roles: ["administrador", "chef"],
        children: [
          { id: "cu07-list", label: "Catálogo de Insumos", path: "/insumos", roles: ["administrador", "chef"] },
          { id: "cu07-create", label: "Registrar Insumo", path: "/insumos/crear", roles: ["administrador"] },
        ],
      },
      {
        id: "cu08",
        label: "Consultar Ficha Técnica",
        path: "/insumos/ficha",
        roles: ["administrador", "chef", "gerente", "usuario"],
      },
      {
        id: "cu09",
        label: "Calendario de Estacionalidad",
        path: "",
        roles: ["administrador", "gerente"],
      },
      {
        id: "cu10",
        label: "",
        path: "/historial-precios",
        roles: ["administrador", "gerente"],
      },
    ],
  },

  // PAQUETE 3: Inventario
  {
    id: "pkg-inventario",
    label: "Inventario",
    roles: ["administrador", "chef"],
    children: [
      {
        id: "cu11",
        label: "Gestionar Stock",
        roles: ["administrador", "chef"],
        children: [
          { id: "cu11-list", label: "Consulta de Stock", path: "/stock", roles: ["administrador", "chef"] },
          { id: "cu11-ajuste", label: "Ajuste Manual", path: "/stock/ajuste", roles: ["administrador", "chef"] },
        ],
      },
      {
        id: "cu12",
        label: "Gestionar Lotes",
        path: "/lotes",
        roles: ["administrador"],
      },
      {
        id: "cu14",
        label: "Movimientos de Inventario",
        path: "/movimientos",
        roles: ["administrador", "chef"],
      },
      {
        id: "cu13",
        label: "Alertas",
        path: "/alertas",
        roles: ["administrador", "chef"],
      },
      {
        id: "cu15",
        label: "Validar Cierre de Turno",
        path: "",
        roles: ["chef"],
      },
      {
        id: "cu16",
        label: "Descargo Automático",
        path: "",
        roles: ["administrador", "chef"],
      },
    ],
  },

  // PAQUETE 4: Menús y Recetas
  {
    id: "pkg-menus",
    label: "Menús y Recetas",
    roles: ["administrador", "chef", "gerente"],
    children: [
      {
        id: "cu20",
        label: "Gestionar Platos",
        path: "",
        roles: ["administrador", "chef"],
      },
      {
        id: "cu21",
        label: "Gestionar Recetas",
        path: "",
        roles: ["chef", "administrador"],
      },
      {
        id: "cu22",
        label: "Configurar Merma Técnica",
        path: "",
        roles: ["administrador", "chef"],
      },
      {
        id: "cu23",
        label: "Gestionar Menús",
        path: "",
        roles: ["chef", "gerente", "administrador"],
      },
      {
        id: "cu24",
        label: "Sugerir Menú por Temporada",
        path: "",
        roles: ["chef", "gerente"],
      },
    ],
  },

  // PAQUETE 5: Proveedores
  {
    id: "pkg-proveedores",
    label: "Proveedores",
    roles: ["administrador", "gerente"],
    children: [
      {
        id: "cu17",
        label: "Gestionar Proveedores",
        path: "",
        roles: ["administrador"],
      },
      {
        id: "cu18",
        label: "Asociar Insumos a Proveedores",
        path: "",
        roles: ["administrador"],
      },
      {
        id: "cu19",
        label: "Localizar Proveedores (Mapa)",
        path: "",
        roles: ["administrador", "gerente"],
      },
    ],
  },

  // PAQUETE 6: Reportes y Análisis
  {
    id: "pkg-reportes",
    label: "Reportes y Análisis",
    roles: ["administrador", "gerente"],
    children: [
      {
        id: "cu25",
        label: "Reporte de Valor Perdido",
        path: "",
        roles: ["administrador", "gerente"],
      },
      {
        id: "cu26",
        label: "Reporte de Rotación",
        path: "",
        roles: ["administrador", "gerente"],
      },
      {
        id: "cu27",
        label: "Reporte de Costos por Plato",
        path: "",
        roles: ["gerente", "chef", "administrador"],
      },
      {
        id: "cu28",
        label: "Comparativa de Precios",
        path: "",
        roles: ["gerente", "administrador"],
      },
      {
        id: "cu29",
        label: "Dashboard de KPIs",
        path: "",
        roles: ["administrador", "gerente"],
      },
    ],
  },
];

/**
 * Filtra recursivamente los nodos del menú según el rol del usuario.
 * Un nodo es visible si el rol está en su lista de roles.
 * Los paquetes sin hijos visibles se ocultan automáticamente.
 */
export function filterMenuByRole(nodes: MenuNode[], role: Role): MenuNode[] {
  return nodes
    .filter(node => node.roles.includes(role))
    .map(node => ({
      ...node,
      children: node.children ? filterMenuByRole(node.children, role) : undefined,
    }))
    .filter(node => {
      if (node.children) return node.children.length > 0;
      return true;
    });
}