/**
 * ============================================================
 * ARCHIVO: frontend/src/pages/Proveedores/ProveedorList.tsx
 * CASO DE USO: CU17 - Gestionar Proveedores
 * CICLO: 2
 * DESCRIPCIÓN: Vista principal del Catálogo de Proveedores.
 *   - Muestra la tabla de proveedores.
 *   - Incluye el buscador reactivo (filtra por nombre o insumo).
 *   - Maneja la apertura de los modales de Ver Detalles (Ojito) y Editar (Lápiz).
 * ============================================================
 */

import { useEffect, useState } from "react";
import AppHeader from "@/components/AppHeader";
import { Input } from "@/components/ui/input";
import { ProveedorService, Proveedor } from "@/services/proveedorService";
import { Eye, Search, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import ProveedorDetalleModal from "./ProveedorDetalleModal";
import ProveedorFormModal from "./ProveedorFormModal";

export default function ProveedorList() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [search, setSearch] = useState("");
  const [selectedProveedor, setSelectedProveedor] = useState<Proveedor | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    cargarProveedores();
  }, []);

  const cargarProveedores = async () => {
    try {
      const data = await ProveedorService.getAll();
      setProveedores(data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleOpenViewModal = (proveedor: Proveedor) => {
    setSelectedProveedor(proveedor);
    setIsViewModalOpen(true);
  };

  const handleOpenEditModal = (proveedor: Proveedor) => {
    setSelectedProveedor(proveedor);
    setIsEditModalOpen(true);
  };

  const handleCloseModals = () => {
    setSelectedProveedor(null);
    setIsViewModalOpen(false);
    setIsEditModalOpen(false);
  };

  const handleProveedorSaved = (updated: Proveedor) => {
    setProveedores((prev) => prev.map((p) => p.id === updated.id ? updated : p));
    handleCloseModals();
  };

  // Filtrado avanzado: Buscar por nombre del proveedor o por el nombre de algún insumo que proveen
  const filtered = proveedores.filter((p) => {
    const term = search.toLowerCase();
    
    // Coincidencia en el nombre del proveedor
    if (p.nombre.toLowerCase().includes(term)) return true;
    
    // Coincidencia en el nombre de algún insumo que proveen
    if (p.proveedor_insumo) {
      return p.proveedor_insumo.some((pi) => 
        pi.insumo?.nombre.toLowerCase().includes(term)
      );
    }
    
    return false;
  });

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader />
        <main className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h2 className="text-2xl font-bold text-gray-800">Catálogo de Proveedores</h2>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar proveedor o insumo (ej. Arroz)..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-white"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-600 font-medium border-b">
                    <tr>
                      <th className="p-4">Nombre</th>
                      <th className="p-4">Contacto</th>
                      <th className="p-4">Ubicación</th>
                      <th className="p-4">Insumos (Cant.)</th>
                      <th className="p-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-gray-500">
                          No se encontraron proveedores que coincidan con la búsqueda.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((proveedor) => (
                        <tr
                          key={proveedor.id}
                          className="hover:bg-gray-50/50 transition-colors"
                        >
                          <td className="p-4 font-medium text-gray-900">
                            {proveedor.nombre}
                          </td>
                          <td className="p-4 text-gray-600">
                            {proveedor.contacto || "-"}
                          </td>
                          <td className="p-4 text-gray-600">
                            {proveedor.ubicacion || "-"}
                          </td>
                          <td className="p-4 text-gray-600">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {proveedor.proveedor_insumo?.length || 0} items
                            </span>
                          </td>
                          <td className="p-4 flex justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              onClick={() => handleOpenViewModal(proveedor)}
                              title="Ver detalles"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => handleOpenEditModal(proveedor)}
                              title="Editar proveedor"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>

      <ProveedorDetalleModal
        isOpen={isViewModalOpen}
        onClose={handleCloseModals}
        proveedor={selectedProveedor}
      />
      
      <ProveedorFormModal
        isOpen={isEditModalOpen}
        onClose={handleCloseModals}
        proveedor={selectedProveedor}
        onSaved={handleProveedorSaved}
      />
    </div>
  );
}
