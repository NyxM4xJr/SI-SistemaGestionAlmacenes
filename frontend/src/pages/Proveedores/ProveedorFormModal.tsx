/**
 * ============================================================
 * ARCHIVO: frontend/src/pages/Proveedores/ProveedorFormModal.tsx
 * CASO DE USO: CU17 - Gestionar Proveedores
 * CICLO: 2
 * DESCRIPCIÓN: Formulario Modal para Editar Proveedores.
 *   - Utiliza react-hook-form para el manejo del estado.
 *   - Permite editar los datos generales del proveedor.
 *   - Permite modificar dinámicamente los precios, notas y
 *     calificaciones de los insumos que provee (proveedor_insumo).
 * ============================================================
 */

import React, { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Proveedor, ProveedorService } from "@/services/proveedorService";
import { useForm, useFieldArray } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Save } from "lucide-react";

interface ProveedorFormModalProps {
  proveedor: Proveedor | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (updatedProveedor: Proveedor) => void;
}

interface FormValues {
  nombre: string;
  contacto: string;
  email: string;
  ubicacion: string;
  tipo_pago: string;
  proveedor_insumo: {
    id: number;
    insumo_nombre: string;
    precio: number;
    calificacion: string;
    nota: string;
  }[];
}

const ProveedorFormModal: React.FC<ProveedorFormModalProps> = ({
  proveedor,
  isOpen,
  onClose,
  onSaved,
}) => {
  const { register, control, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: {
      nombre: "",
      contacto: "",
      email: "",
      ubicacion: "",
      tipo_pago: "",
      proveedor_insumo: [],
    },
  });

  const { fields } = useFieldArray({
    control,
    name: "proveedor_insumo",
  });

  useEffect(() => {
    if (proveedor && isOpen) {
      reset({
        nombre: proveedor.nombre || "",
        contacto: proveedor.contacto || "",
        email: proveedor.email || "",
        ubicacion: proveedor.ubicacion || "",
        tipo_pago: proveedor.tipo_pago || "",
        proveedor_insumo: proveedor.proveedor_insumo?.map((pi) => ({
          id: pi.id,
          insumo_nombre: pi.insumo?.nombre || "Desconocido",
          precio: pi.precio || 0,
          calificacion: pi.calificacion || "",
          nota: pi.nota || "",
        })) || [],
      });
    }
  }, [proveedor, isOpen, reset]);

  const onSubmit = async (data: FormValues) => {
    if (!proveedor?.id) return;
    
    try {
      // Mapeamos los datos de vuelta al formato de la API
      const payload = {
        nombre: data.nombre,
        contacto: data.contacto,
        email: data.email,
        ubicacion: data.ubicacion,
        tipo_pago: data.tipo_pago,
        proveedor_insumo: data.proveedor_insumo.map((pi) => ({
          id: pi.id,
          precio: pi.precio,
          calificacion: pi.calificacion,
          nota: pi.nota,
        })),
      };

      const updated = await ProveedorService.update(proveedor.id, payload);
      toast.success("Proveedor actualizado exitosamente");
      onSaved(updated);
    } catch (error) {
      toast.error("Error al actualizar el proveedor");
      console.error(error);
    }
  };

  if (!proveedor) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl bg-white text-gray-800 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900 border-b pb-4">
            Editar Proveedor
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 mt-4">
          {/* Sección 1: Datos Generales */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-4">
            <h3 className="font-semibold text-gray-700">Datos Generales</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre</Label>
                <Input id="nombre" {...register("nombre", { required: true })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contacto">Contacto (Teléfono)</Label>
                <Input id="contacto" {...register("contacto")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...register("email")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ubicacion">Ubicación</Label>
                <Input id="ubicacion" {...register("ubicacion")} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="tipo_pago">Tipo de Pago (Ej. Efectivo, Transferencia)</Label>
                <Input id="tipo_pago" {...register("tipo_pago")} />
              </div>
            </div>
          </div>

          {/* Sección 2: Insumos Suministrados */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-700 border-b pb-2">
              Insumos Suministrados
            </h3>
            {fields.length === 0 ? (
              <p className="text-sm text-gray-500 italic">
                Este proveedor no tiene insumos registrados.
              </p>
            ) : (
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-12 gap-4 items-center bg-white border p-4 rounded-lg shadow-sm">
                    <div className="col-span-12 sm:col-span-3">
                      <Label className="text-xs text-gray-500 block mb-1">Insumo</Label>
                      <p className="font-medium text-sm">{field.insumo_nombre}</p>
                    </div>
                    
                    <div className="col-span-12 sm:col-span-2 space-y-1">
                      <Label className="text-xs">Precio (Bs.)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        {...register(`proveedor_insumo.${index}.precio`, { valueAsNumber: true })}
                        className="h-8 text-sm"
                      />
                    </div>
                    
                    <div className="col-span-12 sm:col-span-3 space-y-1">
                      <Label className="text-xs">Calificación</Label>
                      <select
                        {...register(`proveedor_insumo.${index}.calificacion`)}
                        className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">(Ninguna)</option>
                        <option value="excelente">Excelente</option>
                        <option value="bueno">Bueno</option>
                        <option value="regular">Regular</option>
                        <option value="malo">Malo</option>
                      </select>
                    </div>

                    <div className="col-span-12 sm:col-span-4 space-y-1">
                      <Label className="text-xs">Nota (Opcional)</Label>
                      <Input
                        {...register(`proveedor_insumo.${index}.nota`)}
                        placeholder="Ej. Entrega rápida"
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
              <Save className="w-4 h-4 mr-2" />
              Guardar Cambios
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ProveedorFormModal;
