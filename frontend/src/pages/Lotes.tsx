/**
 * ============================================================
 * ARCHIVO: frontend/src/pages/Lotes.tsx
 * CASO DE USO: CU12 - Gestionar Lotes (Refactorizado)
 * DESCRIPCIÓN: Interfaz para el registro de ingreso de lotes 
 * al almacén. Incluye selección inteligente de insumos y filtrado 
 * automático de ubicaciones de stock.
 * ============================================================
 */
import React, { useState, useEffect, useMemo } from 'react';
import AppHeader from '@/components/AppHeader';
import { supabase } from '../lib/supabase';
import { Proveedor, ProveedorService } from '@/services/proveedorService';
import { Insumo, insumoService } from '@/services/insumoServices';
import { Stock, StockService } from '@/services/StockServices';
import { 
  PlusCircle, Search, Package, Calendar, MapPin, Building2, Trash2, 
  ArrowLeft, Save, AlertCircle, FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

interface DetalleLote {
  id?: number;
  insumo_id: number | '';
  stock_id: number | '';
  cantidad: number | '';
  costo_unitario: number | '';
  fecha_vencimiento?: string;
  subtotal?: number;
  insumo?: { id: number; nombre: string };
  stock?: { id: number; inventario_id: number };
  ubicacion?: string;
}

interface Lote {
  id: number;
  fecha_ing: string;
  proveedor_id: number | null;
  proveedor_nombre?: string | null;
  total_lote: number;
  created_at: string;
  detalles: DetalleLote[];
}

export default function Lotes() {
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Data for selects
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [editingLote, setEditingLote] = useState<Lote | null>(null);
  
  const [fechaIng, setFechaIng] = useState(new Date().toISOString().split('T')[0]);
  const [proveedorId, setProveedorId] = useState<string>('none');
  const [detalles, setDetalles] = useState<DetalleLote[]>([
    { insumo_id: '', stock_id: '', cantidad: '', costo_unitario: '' }
  ]);
  const [saving, setSaving] = useState(false);

  // List State
  const [expandedLoteId, setExpandedLoteId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    cargarDatosGenerales();
    cargarLotes();
  }, []);

  const cargarDatosGenerales = async () => {
    try {
      const [provData, insData, stockData] = await Promise.all([
        ProveedorService.getAll(),
        insumoService.getAll(),
        StockService.getAll()
      ]);
      setProveedores(provData);
      setInsumos(insData);
      setStocks(stockData);
    } catch (error) {
      console.error(error);
      toast.error("Error cargando los catálogos base");
    }
  };

  const cargarLotes = async () => {
    setLoading(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const response = await fetch(`${API_URL}/lotes/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      setLotes(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error cargando lotes:', error);
      toast.error("Error al cargar los lotes de inventario");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenForm = (lote?: Lote) => {
    if (lote) {
      setEditingLote(lote);
      setFechaIng(lote.fecha_ing);
      setProveedorId(lote.proveedor_id ? lote.proveedor_id.toString() : 'none');
      
      const detallesForm = lote.detalles.map(d => ({
        ...d,
        cantidad: d.cantidad,
        costo_unitario: d.costo_unitario
      }));
      setDetalles(detallesForm);
    } else {
      setEditingLote(null);
      setFechaIng(new Date().toISOString().split('T')[0]);
      setProveedorId('none');
      setDetalles([{ insumo_id: '', stock_id: '', cantidad: '', costo_unitario: '' }]);
    }
    setShowForm(true);
  };

  const actualizarLote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLote) return;

    const detallesLimpios = [];
    for (let i = 0; i < detalles.length; i++) {
      const d = detalles[i];
      const insumoIdStr = String(d.insumo_id || '').trim().replace(/[^\d]/g, '');
      const stockIdStr = String(d.stock_id || '').trim().replace(/[^\d]/g, '');
      const cantidadStr = String(d.cantidad || '').trim().replace(/[^\d.]/g, '');
      const costoStr = String(d.costo_unitario || '').trim().replace(/[^\d.]/g, '');
      
      if (!insumoIdStr || !stockIdStr || !cantidadStr || !costoStr) {
        alert(`El detalle ${i + 1} tiene campos incompletos o inválidos`);
        return;
      }
      
      const insumoId = parseInt(insumoIdStr);
      const stockId = parseInt(stockIdStr);
      const cantidad = parseFloat(cantidadStr);
      const costo = parseFloat(costoStr);
      
      if (isNaN(insumoId) || insumoId <= 0) {
        alert(`Insumo ID inválido: ${d.insumo_id}`);
        return;
      }
      if (isNaN(stockId) || stockId <= 0) {
        alert(`Stock ID inválido: ${d.stock_id}`);
        return;
      }
      if (isNaN(cantidad) || cantidad <= 0) {
        alert(`Cantidad inválida: ${d.cantidad}`);
        return;
      }
      if (isNaN(costo) || costo <= 0) {
        alert(`Costo unitario inválido: ${d.costo_unitario}`);
        return;
      }
      
      detallesLimpios.push({
        insumo_id: insumoId,
        stock_id: stockId,
        cantidad: cantidad,
        costo_unitario: costo
      });
    }
    
    const payload = {
      fecha_ing: fechaIng,
      proveedor_id: proveedorId ? parseInt(proveedorId) : null,
      detalles: detallesLimpios
    };
    
    try {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    const response = await fetch(`${API_URL}/lotes/${editingLote.id}/`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
      
      const responseText = await response.text();
      if (response.ok) {
        alert('Lote actualizado exitosamente');
        setShowForm(false);
        setEditingLote(null);
        setDetalles([{ insumo_id: '', stock_id: '', cantidad: '', costo_unitario: '' }]);
        cargarLotes();
      } else {
        alert(`Error: ${responseText}`);
      }
    } catch (error) {
      console.error('Error actualizando lote:', error);
      alert('Error al actualizar lote');
    }
  };

  const agregarDetalle = () => {
    setDetalles([...detalles, { insumo_id: '', stock_id: '', cantidad: '', costo_unitario: '' }]);
  };

  const eliminarDetalle = (index: number) => {
    const nuevosDetalles = [...detalles];
    nuevosDetalles.splice(index, 1);
    setDetalles(nuevosDetalles);
  };

  const actualizarDetalle = (index: number, campo: keyof DetalleLote, valor: string | number) => {
    const nuevosDetalles = [...detalles];
    nuevosDetalles[index] = { ...nuevosDetalles[index], [campo]: valor };
    
    // Si cambia el insumo, resetear el stock_id para obligar a elegir uno válido
    if (campo === 'insumo_id') {
      nuevosDetalles[index].stock_id = '';
      
      // Auto-completar costo_unitario base si existe (como sugerencia)
      const insumoInfo = insumos.find(i => i.id?.toString() === valor.toString());
      if (insumoInfo && !nuevosDetalles[index].costo_unitario) {
         // Opcional: poner un costo por defecto
      }
    }
    
    setDetalles(nuevosDetalles);
  };

  const calcularTotalLote = () => {
    return detalles.reduce((acc, curr) => {
      const q = parseFloat(curr.cantidad.toString()) || 0;
      const p = parseFloat(curr.costo_unitario.toString()) || 0;
      return acc + (q * p);
    }, 0);
  };

  const guardarLote = async () => {
    // Validación
    if (detalles.length === 0) {
      toast.error("El lote debe tener al menos un insumo");
      return;
    }

    const detallesValidos = [];
    for (let i = 0; i < detalles.length; i++) {
      const d = detalles[i];
      if (d.insumo_id === '' || d.stock_id === '' || d.cantidad === '' || d.costo_unitario === '') {
        toast.error(`La fila ${i + 1} tiene campos incompletos`);
        return;
      }
      
      const cantidad = parseFloat(d.cantidad.toString());
      const costo = parseFloat(d.costo_unitario.toString());
      
      if (cantidad <= 0 || costo <= 0) {
        toast.error(`La cantidad y costo de la fila ${i + 1} deben ser mayores a 0`);
        return;
      }
      
      detallesValidos.push({
        insumo_id: parseInt(d.insumo_id.toString()),
        stock_id: parseInt(d.stock_id.toString()),
        cantidad,
        costo_unitario: costo
      });
    }

    const payload = {
      fecha_ing: fechaIng,
      proveedor_id: proveedorId === 'none' ? null : parseInt(proveedorId),
      detalles: detallesValidos
    };

    setSaving(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      
      const url = editingLote 
        ? `${API_URL}/lotes/${editingLote.id}/` 
        : `${API_URL}/lotes/`;
        
      const response = await fetch(url, {
        method: editingLote ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Error al procesar el lote");
      }
      
      toast.success(`Lote ${editingLote ? 'actualizado' : 'registrado'} exitosamente`);
      handleCloseForm();
      cargarLotes();
    } catch (error: unknown) {
      console.error(error);
      toast.error((error as Error).message || "Error al guardar el lote");
    } finally {
      setSaving(false);
    }
  };

  const eliminarLote = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm('¿Estás seguro de eliminar este lote de inventario? Esta acción puede afectar el stock actual.')) return;
    
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const response = await fetch(`${API_URL}/lotes/${id}/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        toast.success("Lote eliminado y stock revertido");
        setLotes(prev => prev.filter(l => l.id !== id));
      } else {
        toast.error('Error al eliminar el lote');
      }
    } catch (error) {
      console.error(error);
      toast.error("Ocurrió un error inesperado");
    }
  };

  const filteredLotes = useMemo(() => {
    if (!searchTerm) return lotes;
    const term = searchTerm.toLowerCase();
    return lotes.filter(l => 
      l.id.toString().includes(term) || 
      (l.proveedor_nombre && l.proveedor_nombre.toLowerCase().includes(term))
    );
  }, [lotes, searchTerm]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <AppHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        
        {/* Cabecera Principal */}
        {!showForm && (
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Package className="w-8 h-8 text-blue-600" />
                Recepción de Lotes
              </h1>
              <p className="text-gray-500 mt-1">
                Registra la entrada de insumos al almacén y asigna las ubicaciones de stock.
              </p>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar lote o proveedor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button 
                onClick={() => handleOpenForm()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <PlusCircle className="w-4 h-4 mr-2" />
                Nuevo Lote
              </Button>
            </div>
          </div>
        )}

        {/* Formulario (Vista Detallada) */}
        {showForm ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
              <div>
                <Button variant="ghost" onClick={handleCloseForm} className="-ml-4 mb-2 text-gray-500">
                  <ArrowLeft className="w-4 h-4 mr-2" /> Volver
                </Button>
                <h2 className="text-2xl font-bold text-gray-800">
                  {editingLote ? `Editando Lote #${editingLote.id}` : 'Registrar Nuevo Lote'}
                </h2>
              </div>
            </div>
            
            <div className="p-6 lg:p-8 space-y-8">
              {/* Info General */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-blue-50/50 p-6 rounded-xl border border-blue-100">
                <div className="space-y-2">
                  <Label>Fecha de Ingreso <span className="text-red-500">*</span></Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <Input
                      type="date"
                      value={fechaIng}
                      onChange={(e) => setFechaIng(e.target.value)}
                      className="pl-9 bg-white"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Proveedor (Opcional)</Label>
                  <Select value={proveedorId} onValueChange={setProveedorId}>
                    <SelectTrigger className="bg-white">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-500" />
                        <SelectValue placeholder="Seleccionar proveedor" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin proveedor específico</SelectItem>
                      {proveedores.map(p => (
                        <SelectItem key={p.id} value={p.id.toString()}>{p.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Detalles de Insumos */}
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-gray-500" />
                    Insumos del Lote
                  </h3>
                </div>

                <div className="space-y-4">
                  {detalles.map((detalle, index) => {
                    // Filtrar stocks válidos para el insumo seleccionado en esta fila
                    const validStocks = detalle.insumo_id 
                      ? stocks.filter(s => s.insumo_id.toString() === detalle.insumo_id.toString())
                      : [];

                    const q = parseFloat(detalle.cantidad.toString()) || 0;
                    const c = parseFloat(detalle.costo_unitario.toString()) || 0;
                    const sub = q * c;

                    return (
                      <div key={index} className="grid grid-cols-12 gap-4 items-end bg-gray-50 p-4 rounded-xl border border-gray-100 relative group">
                        
                        <div className="col-span-12 md:col-span-3">
                          <Label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Insumo</Label>
                          <Select 
                            value={detalle.insumo_id.toString()} 
                            onValueChange={(val) => actualizarDetalle(index, 'insumo_id', val)}
                          >
                            <SelectTrigger className="bg-white border-gray-300">
                              <SelectValue placeholder="Seleccionar insumo" />
                            </SelectTrigger>
                            <SelectContent>
                              {insumos.map(ins => (
                                <SelectItem key={ins.id} value={ins.id!.toString()}>{ins.nombre}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="col-span-12 md:col-span-3">
                          <Label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Ubicación de Stock</Label>
                          <Select 
                            value={detalle.stock_id.toString()} 
                            onValueChange={(val) => actualizarDetalle(index, 'stock_id', val)}
                            disabled={!detalle.insumo_id}
                          >
                            <SelectTrigger className={`bg-white ${!detalle.insumo_id ? 'opacity-50' : ''}`}>
                              <SelectValue placeholder={!detalle.insumo_id ? "Elige un insumo" : "Ubicación"} />
                            </SelectTrigger>
                            <SelectContent>
                              {validStocks.length === 0 && detalle.insumo_id ? (
                                <SelectItem value="none" disabled>No hay stock creado para este insumo</SelectItem>
                              ) : (
                                validStocks.map(stk => (
                                  <SelectItem key={stk.id} value={stk.id!.toString()}>
                                    Stock #{stk.id} (Disp: {stk.cantidad})
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          {validStocks.length === 0 && detalle.insumo_id && (
                            <p className="text-[10px] text-orange-600 mt-1 leading-tight flex items-start">
                              <AlertCircle className="w-3 h-3 mr-1 shrink-0" />
                              Debe existir un registro en Stock para poder almacenar este lote.
                            </p>
                          )}
                        </div>

                        <div className="col-span-6 md:col-span-2">
                          <Label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Cantidad</Label>
                          <Input
                            type="number"
                            min="0.1" step="any"
                            value={detalle.cantidad}
                            onChange={(e) => actualizarDetalle(index, 'cantidad', e.target.value)}
                            className="bg-white"
                          />
                        </div>

                        <div className="col-span-6 md:col-span-2">
                          <Label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Costo Unit. (Bs)</Label>
                          <Input
                            type="number"
                            min="0.1" step="any"
                            value={detalle.costo_unitario}
                            onChange={(e) => actualizarDetalle(index, 'costo_unitario', e.target.value)}
                            className="bg-white"
                          />
                        </div>

                        <div className="col-span-10 md:col-span-1 text-right">
                          <Label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">Subtotal</Label>
                          <div className="font-bold text-gray-900 py-2">
                            {sub > 0 ? `Bs. ${sub.toFixed(2)}` : '---'}
                          </div>
                        </div>

                        <div className="col-span-2 md:col-span-1 flex justify-end pb-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => eliminarDetalle(index)}
                            disabled={detalles.length === 1}
                            className="text-red-400 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-5 h-5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between items-center mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={agregarDetalle}
                    className="text-blue-600 border-blue-200 hover:bg-blue-50"
                  >
                    <PlusCircle className="w-4 h-4 mr-2" />
                    Agregar otra fila
                  </Button>

                  <div className="bg-gray-900 text-white px-6 py-4 rounded-xl shadow-lg flex items-center gap-6">
                    <span className="text-gray-300 font-medium">TOTAL DEL LOTE</span>
                    <span className="text-3xl font-bold text-green-400">
                      Bs. {calcularTotalLote().toFixed(2)}
                    </span>
                  </div>
                </div>

              </div>
              
              <div className="border-t pt-6 flex justify-end gap-4">
                <Button variant="outline" onClick={handleCloseForm} className="w-32">
                  Cancelar
                </Button>
                <Button 
                  onClick={guardarLote} 
                  disabled={saving || calcularTotalLote() === 0}
                  className="bg-green-600 hover:bg-green-700 w-48 text-lg"
                >
                  <Save className="w-5 h-5 mr-2" />
                  {saving ? 'Guardando...' : 'Guardar Lote'}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* Lista de Lotes */
          loading ? (
            <div className="flex justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredLotes.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center flex flex-col items-center">
              <Package className="w-16 h-16 text-gray-300 mb-4" />
              <h2 className="text-xl font-bold text-gray-600 mb-2">No hay lotes registrados</h2>
              <p className="text-gray-500 max-w-md">No se encontraron lotes de inventario. Haz clic en "Nuevo Lote" para registrar el ingreso de mercancía.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredLotes.map(lote => (
                <div key={lote.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all hover:shadow-md">
                  <div 
                    className="p-5 flex flex-wrap sm:flex-nowrap justify-between items-center cursor-pointer group"
                    onClick={() => setExpandedLoteId(expandedLoteId === lote.id ? null : lote.id)}
                  >
                    <div className="flex items-center gap-6">
                      <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold text-lg shrink-0">
                        #{lote.id}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
                          <Calendar className="w-4 h-4" />
                          Ingreso: {lote.fecha_ing}
                        </div>
                        <div className="font-semibold text-gray-800 flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          {lote.proveedor_nombre || "Proveedor no especificado"}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6 mt-4 sm:mt-0 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="text-right">
                        <p className="text-sm text-gray-500 font-medium">Costo Total</p>
                        <p className="text-xl font-bold text-green-600">Bs. {lote.total_lote.toFixed(2)}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={(e) => { e.stopPropagation(); handleOpenForm(lote); }}
                          className="text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={(e) => eliminarLote(e, lote.id)}
                          className="text-red-400 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Detail View */}
                  {expandedLoteId === lote.id && (
                    <div className="bg-gray-50 border-t border-gray-100 p-5 animate-in slide-in-from-top-2 duration-200">
                      <h4 className="font-bold text-gray-700 mb-4 text-sm uppercase tracking-wider">Desglose de Insumos</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="text-gray-500 bg-gray-200/50 rounded-lg">
                            <tr>
                              <th className="px-4 py-3 rounded-l-lg">Insumo</th>
                              <th className="px-4 py-3">Ubicación / Inv.</th>
                              <th className="px-4 py-3 text-right">Cantidad</th>
                              <th className="px-4 py-3 text-right">Costo Unit.</th>
                              <th className="px-4 py-3 text-right">Subtotal</th>
                              <th className="px-4 py-3 rounded-r-lg">Vencimiento</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lote.detalles.map(d => (
                              <tr key={d.id} className="border-b border-gray-200 last:border-0 hover:bg-white transition-colors">
                                <td className="px-4 py-3 font-medium text-gray-900">{d.insumo?.nombre || `Insumo #${d.insumo_id}`}</td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-1 text-gray-600">
                                    <MapPin className="w-3 h-3" />
                                    {d.ubicacion || `Stock #${d.stock_id}`}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right font-medium">{d.cantidad}</td>
                                <td className="px-4 py-3 text-right text-gray-600">Bs. {d.costo_unitario}</td>
                                <td className="px-4 py-3 text-right font-semibold text-gray-900">Bs. {d.subtotal}</td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    new Date(d.fecha_vencimiento || '') < new Date() 
                                      ? 'bg-red-100 text-red-800' 
                                      : 'bg-green-100 text-green-800'
                                  }`}>
                                    {d.fecha_vencimiento || 'N/A'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </main>
    </div>
  );
}