/**
 * ============================================================
 * ARCHIVO: frontend/src/pages/Proveedores/ProveedorDetalleModal.tsx
 * CASO DE USO: CU17 - Gestionar Proveedores
 * CICLO: 2
 * DESCRIPCIÓN: Modal de "Solo Lectura" (Ojito) para Proveedores.
 *   - Muestra la información de contacto completa.
 *   - Despliega tarjetas individuales para cada insumo que suministra
 *     el proveedor (con precio, calificación y notas).
 * ============================================================
 */

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Proveedor } from "@/services/proveedorService";

interface ProveedorDetalleModalProps {
  proveedor: Proveedor | null;
  isOpen: boolean;
  onClose: () => void;
}

const ProveedorDetalleModal: React.FC<ProveedorDetalleModalProps> = ({
  proveedor,
  isOpen,
  onClose,
}) => {
  if (!proveedor) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-white text-gray-800">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900 border-b pb-4">
            Detalles del Proveedor
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
            <div>
              <p className="text-sm font-semibold text-gray-500">Nombre</p>
              <p className="text-lg font-medium">{proveedor.nombre}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-500">Ubicación</p>
              <p className="text-lg">{proveedor.ubicacion || "No especificada"}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-500">Contacto</p>
              <p className="text-lg">{proveedor.contacto || "No especificado"}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-500">Email</p>
              <p className="text-lg">{proveedor.email || "No especificado"}</p>
            </div>
            <div className="col-span-2">
              <p className="text-sm font-semibold text-gray-500">Tipo de Pago</p>
              <p className="text-lg">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  {proveedor.tipo_pago || "No especificado"}
                </span>
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold text-gray-900 border-b pb-2 mb-4">
              Insumos Suministrados
            </h3>
            {!proveedor.proveedor_insumo || proveedor.proveedor_insumo.length === 0 ? (
              <p className="text-gray-500 italic bg-gray-50 p-4 rounded text-center">
                Este proveedor aún no tiene insumos registrados.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {proveedor.proveedor_insumo.map((pi) => (
                  <div key={pi.id} className="bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                    <h4 className="font-bold text-gray-800">
                      {pi.insumo?.nombre || "Insumo desconocido"}
                    </h4>
                    <div className="mt-2 text-sm text-gray-600 flex justify-between">
                      <span>Precio: <span className="font-semibold text-green-600">Bs. {pi.precio}</span></span>
                      <span>Calificación: <span className="capitalize text-yellow-600 font-medium">{pi.calificacion || "N/A"}</span></span>
                    </div>
                    {pi.nota && (
                      <p className="mt-2 text-xs text-gray-500 italic bg-gray-50 p-2 rounded">
                        Nota: {pi.nota}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProveedorDetalleModal;
