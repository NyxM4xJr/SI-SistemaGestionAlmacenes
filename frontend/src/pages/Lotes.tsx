import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

interface DetalleLote {
  id: number;
  insumo_id: number;
  stock_id: number;
  cantidad: number;
  costo_unitario: number;
  fecha_vencimiento: string;
  subtotal: number;
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
  const [showForm, setShowForm] = useState(false);
  const [selectedLote, setSelectedLote] = useState<Lote | null>(null);
  
  const [fechaIng, setFechaIng] = useState(new Date().toISOString().split('T')[0]);
  const [proveedorId, setProveedorId] = useState('');
  const [detalles, setDetalles] = useState<any[]>([
    { insumo_id: '', stock_id: '', cantidad: '', costo_unitario: '' }
  ]);

  const [editingLote, setEditingLote] = useState<Lote | null>(null);

  useEffect(() => {
    cargarLotes();
  }, []);

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
      setLotes([]);
    } finally {
      setLoading(false);
    }
  };

  const editarLote = (lote: Lote) => {
    setEditingLote(lote);
    setFechaIng(lote.fecha_ing);
    setProveedorId(lote.proveedor_id?.toString() || '');
    
    const detallesForm = lote.detalles.map(d => ({
      insumo_id: d.insumo_id.toString(),
      stock_id: d.stock_id.toString(),
      cantidad: d.cantidad.toString(),
      costo_unitario: d.costo_unitario.toString()
    }));
    setDetalles(detallesForm);
    setShowForm(true);
  };

  const actualizarLote = async (e: React.FormEvent) => {
  e.preventDefault();
  
  if (!editingLote) return;
  
  // Limpiar y validar cada detalle
  const detallesLimpios = [];
  for (let i = 0; i < detalles.length; i++) {
    const d = detalles[i];
    
    // Limpiar espacios y caracteres extraños
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
    
    const detallesValidos = detalles.filter(d => 
      d.insumo_id && d.stock_id && d.cantidad && d.costo_unitario
    );
    
    const payload = {
    fecha_ing: fechaIng,
    proveedor_id: proveedorId ? parseInt(proveedorId) : null,
    detalles: detallesLimpios
  };
    
    console.log('Payload LIMPIO:', JSON.stringify(payload));
    
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
    console.log('Respuesta:', responseText);
    
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

  const actualizarDetalle = (index: number, campo: string, valor: string) => {
    const nuevosDetalles = [...detalles];
    nuevosDetalles[index][campo] = valor;
    setDetalles(nuevosDetalles);
  };

  const crearLote = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar que todos los detalles tengan campos completos
    for (let i = 0; i < detalles.length; i++) {
      const d = detalles[i];
      if (!d.insumo_id || !d.stock_id || !d.cantidad || !d.costo_unitario) {
        alert(`El detalle ${i + 1} tiene campos incompletos`);
        return;
      }
      
      const insumoId = Number(d.insumo_id);
      const stockId = Number(d.stock_id);
      const cantidad = Number(d.cantidad);
      const costo = Number(d.costo_unitario);
      
      if (isNaN(insumoId) || insumoId <= 0) {
        alert(`Insumo ID inválido: ${d.insumo_id}. Debe ser un número entero positivo.`);
        return;
      }
      if (isNaN(stockId) || stockId <= 0) {
        alert(`Stock ID inválido: ${d.stock_id}. Debe ser un número entero positivo.`);
        return;
      }
      if (isNaN(cantidad) || cantidad <= 0) {
        alert(`Cantidad inválida: ${d.cantidad}. Debe ser un número positivo.`);
        return;
      }
      if (isNaN(costo) || costo <= 0) {
        alert(`Costo unitario inválido: ${d.costo_unitario}. Debe ser un número positivo.`);
        return;
      }
    }
    
    const detallesValidos = detalles.filter(d => 
      d.insumo_id && d.stock_id && d.cantidad && d.costo_unitario
    );
    
    if (detallesValidos.length === 0) {
      alert('Debe agregar al menos un insumo válido');
      return;
    }
    
    const payload = {
      fecha_ing: fechaIng,
      proveedor_id: proveedorId ? parseInt(proveedorId) : null,
      detalles: detallesValidos.map(d => ({
        insumo_id: parseInt(d.insumo_id),
        stock_id: parseInt(d.stock_id),
        cantidad: parseFloat(d.cantidad),
        costo_unitario: parseFloat(d.costo_unitario)
      }))
    };
    
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const response = await fetch('http://127.0.0.1:8000/api/lotes/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        alert('Lote creado exitosamente');
        setShowForm(false);
        setEditingLote(null);
        setDetalles([{ insumo_id: '', stock_id: '', cantidad: '', costo_unitario: '' }]);
        cargarLotes();
      } else {
        const error = await response.json();
        alert(`Error: ${JSON.stringify(error)}`);
      }
    } catch (error) {
      console.error('Error creando lote:', error);
      alert('Error al crear lote');
    }
  };

  const eliminarLote = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este lote?')) return;
    
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const response = await fetch(`http://127.0.0.1:8000/api/lotes/${id}/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        alert('Lote eliminado');
        cargarLotes();
        if (selectedLote?.id === id) setSelectedLote(null);
      } else {
        alert('Error al eliminar');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingLote(null);
    setDetalles([{ insumo_id: '', stock_id: '', cantidad: '', costo_unitario: '' }]);
    setFechaIng(new Date().toISOString().split('T')[0]);
    setProveedorId('');
  };

  if (loading) {
    return <div className="p-8 text-center">Cargando lotes...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Gestión de Lotes</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          {showForm ? 'Cancelar' : '+ Nuevo Lote'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6 border">
          <h2 className="text-xl font-semibold mb-4">
            {editingLote ? 'Editar Lote' : 'Crear Nuevo Lote'}
          </h2>
          <form onSubmit={editingLote ? actualizarLote : crearLote}>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Fecha de Ingreso</label>
                <input
                  type="date"
                  value={fechaIng}
                  onChange={(e) => setFechaIng(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Proveedor ID (opcional)</label>
                <input
                  type="number"
                  value={proveedorId}
                  onChange={(e) => setProveedorId(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>

            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold">Insumos del Lote</h3>
                <button
                  type="button"
                  onClick={agregarDetalle}
                  className="text-blue-600 text-sm hover:underline"
                >
                  + Agregar Insumo
                </button>
              </div>
              
              <div className="space-y-3">
                {detalles.map((detalle, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-end border-b pb-3">
                    <div className="col-span-3">
                      <label className="block text-xs font-medium mb-1">Insumo ID</label>
                      <input
                        type="number"
                        step="1"
                        value={detalle.insumo_id}
                        onChange={(e) => actualizarDetalle(index, 'insumo_id', e.target.value)}
                        className="w-full border rounded px-2 py-1 text-sm"
                        placeholder="1,2,3..."
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="block text-xs font-medium mb-1">Stock ID</label>
                      <input
                        type="number"
                        step="1"
                        value={detalle.stock_id}
                        onChange={(e) => actualizarDetalle(index, 'stock_id', e.target.value)}
                        className="w-full border rounded px-2 py-1 text-sm"
                        placeholder="1,2,3..."
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium mb-1">Cantidad</label>
                      <input
                        type="number"
                        step="0.01"
                        value={detalle.cantidad}
                        onChange={(e) => actualizarDetalle(index, 'cantidad', e.target.value)}
                        className="w-full border rounded px-2 py-1 text-sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium mb-1">Costo Unitario</label>
                      <input
                        type="number"
                        step="0.01"
                        value={detalle.costo_unitario}
                        onChange={(e) => actualizarDetalle(index, 'costo_unitario', e.target.value)}
                        className="w-full border rounded px-2 py-1 text-sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <button
                        type="button"
                        onClick={() => eliminarDetalle(index)}
                        className="text-red-600 text-sm w-full"
                        disabled={detalles.length === 1}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 w-full"
            >
              {editingLote ? 'Actualizar Lote' : 'Guardar Lote'}
            </button>
          </form>
        </div>
      )}

      <div className="grid gap-4">
        {lotes.map((lote) => (
          <div key={lote.id} className="border rounded-lg bg-white shadow-sm overflow-hidden">
            <div
              className="p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 flex justify-between items-center"
              onClick={() => setSelectedLote(selectedLote?.id === lote.id ? null : lote)}
            >
              <div>
                <span className="font-bold">Lote #{lote.id}</span>
                <span className="ml-4 text-gray-600">Fecha: {lote.fecha_ing}</span>
                {lote.proveedor_nombre && (
                  <span className="ml-4 text-gray-600">Proveedor: {lote.proveedor_nombre}</span>
                )}
                {lote.proveedor_id && !lote.proveedor_nombre && (
                  <span className="ml-4 text-gray-600">Proveedor ID: {lote.proveedor_id}</span>
                )}
                <span className="ml-4 text-green-600 font-semibold">
                  Total: Bs. {lote.total_lote.toFixed(2)}
                </span>
              </div>
              <div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    editarLote(lote);
                  }}
                  className="bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600 mr-2"
                >
                  Editar
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    eliminarLote(lote.id);
                  }}
                  className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
                >
                  Eliminar
                </button>
              </div>
            </div>
            
            {selectedLote?.id === lote.id && (
              <div className="p-4 border-t">
                <h4 className="font-semibold mb-2">Detalles del Lote:</h4>
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-2 text-left">Insumo</th>
                      <th className="p-2 text-left">Insumo ID</th>
                      <th className="p-2 text-left">Ubicación</th>
                      <th className="p-2 text-left">Stock ID</th>
                      <th className="p-2 text-right">Cantidad</th>
                      <th className="p-2 text-right">Costo Unit.</th>
                      <th className="p-2 text-right">Subtotal</th>
                      <th className="p-2 text-left">Fecha Venc.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lote.detalles.map((detalle) => (
                      <tr key={detalle.id} className="border-b">
                        <td className="p-2">{detalle.insumo?.nombre || detalle.insumo_id}</td>
                        <td className="p-2">{detalle.insumo_id}</td>
                        <td className="p-2">{detalle.ubicacion || `Stock #${detalle.stock_id}`}</td>
                        <td className="p-2">{detalle.stock_id}</td>
                        <td className="p-2 text-right">{detalle.cantidad}</td>
                        <td className="p-2 text-right">Bs. {detalle.costo_unitario}</td>
                        <td className="p-2 text-right">Bs. {detalle.subtotal}</td>
                        <td className="p-2">{detalle.fecha_vencimiento}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
        
        {lotes.length === 0 && (
          <div className="text-center text-gray-500 py-8">No hay lotes registrados</div>
        )}
      </div>
    </div>
  );
}