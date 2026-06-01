from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from django.conf import settings
from supabase import create_client, Client
from datetime import date, timedelta
import json

class LoteViewSet(viewsets.ViewSet):
    """
    ViewSet para gestionar lotes (CU12)
    """
    permission_classes = [IsAuthenticated]
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.supabase: Client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_KEY
        )
    
    def list(self, request):
        try:
            lotes = self.supabase.table('lote').select('*').order('id', desc=True).execute()
            
            resultado = []
            for lote in lotes.data:
                proveedor_nombre = None
                if lote.get('proveedor_id'):
                    proveedor = self.supabase.table('proveedor').select('nombre').eq('id', lote['proveedor_id']).execute()
                    if proveedor.data:
                        proveedor_nombre = proveedor.data[0]['nombre']
                lote['proveedor_nombre'] = proveedor_nombre
                
                detalles = self.supabase.table('detalle_lote')\
                    .select('*, insumo:insumo_id (id, nombre), stock:stock_id (id, inventario_id)')\
                    .eq('lote_id', lote['id'])\
                    .execute()
                
                for detalle in detalles.data:
                    if detalle.get('stock') and detalle['stock'].get('inventario_id'):
                        inventario = self.supabase.table('inventario').select('ubicacion').eq('id', detalle['stock']['inventario_id']).execute()
                        if inventario.data:
                            detalle['ubicacion'] = inventario.data[0]['ubicacion']
                
                lote['detalles'] = detalles.data
                resultado.append(lote)
            
            return Response(resultado)
        except Exception as e:
            return Response({'error': str(e)}, status=500)
    
    def create(self, request):
        try:
            fecha_ing = request.data.get('fecha_ing', date.today().isoformat())
            proveedor_id = request.data.get('proveedor_id')
            detalles = request.data.get('detalles', [])
            
            if not detalles:
                return Response({'error': 'Debe incluir al menos un detalle'}, status=400)
            
            # Insertar lote
            lote_data = {'fecha_ing': fecha_ing}
            if proveedor_id:
                lote_data['proveedor_id'] = proveedor_id
            
            lote_response = self.supabase.table('lote').insert(lote_data).execute()
            lote_id = lote_response.data[0]['id']
            
            total_lote = 0
            for detalle in detalles:
                insumo_id = detalle.get('insumo_id')
                stock_id = detalle.get('stock_id')
                cantidad = detalle.get('cantidad')
                costo_unitario = detalle.get('costo_unitario')
                
                insumo = self.supabase.table('insumo').select('vencimiento_dias').eq('id', insumo_id).execute()
                vencimiento_dias = insumo.data[0]['vencimiento_dias']
                fecha_venc = date.fromisoformat(fecha_ing) + timedelta(days=vencimiento_dias)
                
                # Insertar detalle con SQL directo
                sql = f"""
                    INSERT INTO detalle_lote (lote_id, insumo_id, stock_id, cantidad, costo_unitario, fecha_vencimiento)
                    VALUES ({lote_id}, {insumo_id}, {stock_id}, {cantidad}, {costo_unitario}, '{fecha_venc.isoformat()}')
                """
                self.supabase.rpc('exec_sql', {'query': sql}).execute()
                
                # Actualizar stock con SQL directo
                sql_stock = f"UPDATE stock SET cantidad = cantidad + {cantidad} WHERE id = {stock_id}"
                self.supabase.rpc('exec_sql', {'query': sql_stock}).execute()
                
                total_lote += cantidad * costo_unitario
            
            # Actualizar total del lote
            sql_total = f"UPDATE lote SET total_lote = {total_lote} WHERE id = {lote_id}"
            self.supabase.rpc('exec_sql', {'query': sql_total}).execute()
            
            return Response({'id': lote_id, 'total_lote': total_lote}, status=201)
        except Exception as e:
            return Response({'error': str(e)}, status=500)
    
    def retrieve(self, request, pk=None):
        try:
            lote = self.supabase.table('lote').select('*').eq('id', pk).execute()
            if not lote.data:
                return Response({'error': 'Lote no encontrado'}, status=404)
            
            # Obtener detalles SOLO con insumo y stock (sin forzar ubicacion en stock)
            detalles = self.supabase.table('detalle_lote')\
                .select('*, insumo:insumo_id (id, nombre), stock:stock_id (id, inventario_id)')\
                .eq('lote_id', pk)\
                .execute()
            
            # Agregar ubicación manualmente desde inventario
            for detalle in detalles.data:
                if detalle.get('stock') and detalle['stock'].get('inventario_id'):
                    inventario = self.supabase.table('inventario')\
                        .select('ubicacion')\
                        .eq('id', detalle['stock']['inventario_id'])\
                        .execute()
                    if inventario.data:
                        detalle['ubicacion'] = inventario.data[0]['ubicacion']
            
            resultado = lote.data[0]
            resultado['detalles'] = detalles.data
            return Response(resultado)
        except Exception as e:
            return Response({'error': str(e)}, status=500)
    
    def update(self, request, pk=None):
        print(f"\n=== UPDATE {pk} ===")
        print(f"Data: {request.data}")
        
        try:
            data = request.data
            
            # Verificar existencia
            existe = self.supabase.table('lote').select('id').eq('id', pk).execute()
            if not existe.data:
                return Response({'error': 'Lote no encontrado'}, status=404)
            
            # 1. Actualizar cabecera
            lote_data = {}
            if 'fecha_ing' in data:
                lote_data['fecha_ing'] = f"'{data['fecha_ing']}'"
            if 'proveedor_id' in data:
                lote_data['proveedor_id'] = data['proveedor_id']
            
            if lote_data:
                updates = ', '.join([f"{k} = {v}" for k, v in lote_data.items()])
                sql = f"UPDATE lote SET {updates} WHERE id = {pk}"
                print(f"SQL: {sql}")
                self.supabase.rpc('exec_sql', {'query': sql}).execute()
            
            # 2. Actualizar detalles del Lote
            if 'detalles' in data and data['detalles']:
                # Regla de Negocio Crítica: Para actualizar un lote, primero revertimos 
                # las cantidades de stock que habían ingresado con los detalles antiguos.
                antiguos = self.supabase.table('detalle_lote').select('stock_id, cantidad').eq('lote_id', pk).execute()
                for a in antiguos.data:
                    sql_stock = f"UPDATE stock SET cantidad = cantidad - {a['cantidad']} WHERE id = {a['stock_id']}"
                    self.supabase.rpc('exec_sql', {'query': sql_stock}).execute()
                
                # Una vez revertido el stock, eliminamos los detalles antiguos de la base de datos
                sql_del = f"DELETE FROM detalle_lote WHERE lote_id = {pk}"
                self.supabase.rpc('exec_sql', {'query': sql_del}).execute()
                
                # Finalmente, procedemos a insertar los NUEVOS detalles enviados desde el frontend
                fecha_ing = data.get('fecha_ing', date.today().isoformat())
                total_lote = 0
                
                for detalle in data['detalles']:
                    insumo_id = detalle['insumo_id']
                    stock_id = detalle['stock_id']
                    cantidad = detalle['cantidad']
                    costo = detalle['costo_unitario']
                    
                    # Cálculo Automático de Vencimiento: Buscamos cuántos días de vida útil tiene el insumo
                    insumo = self.supabase.table('insumo').select('vencimiento_dias').eq('id', insumo_id).execute()
                    venc = insumo.data[0]['vencimiento_dias']
                    fecha_venc = date.fromisoformat(fecha_ing) + timedelta(days=venc)
                    
                    # Insertamos el detalle calculando su fecha de vencimiento exacta
                    sql = f"""
                        INSERT INTO detalle_lote (lote_id, insumo_id, stock_id, cantidad, costo_unitario, fecha_vencimiento)
                        VALUES ({pk}, {insumo_id}, {stock_id}, {cantidad}, {costo}, '{fecha_venc.isoformat()}')
                    """
                    print(f"SQL: {sql}")
                    self.supabase.rpc('exec_sql', {'query': sql}).execute()
                    
                    # Ingresamos la nueva cantidad de los detalles actuales al Stock físico
                    sql_stock = f"UPDATE stock SET cantidad = cantidad + {cantidad} WHERE id = {stock_id}"
                    self.supabase.rpc('exec_sql', {'query': sql_stock}).execute()
                    
                    total_lote += cantidad * costo
                
                # Actualizar total del lote
                sql_total = f"UPDATE lote SET total_lote = {total_lote} WHERE id = {pk}"
                self.supabase.rpc('exec_sql', {'query': sql_total}).execute()
            
            return self.retrieve(request, pk)
        except Exception as e:
            print(f"ERROR: {e}")
            return Response({'error': str(e)}, status=500)
    
    def destroy(self, request, pk=None):
        try:
            # Primero verificamos si el lote existe
            existe = self.supabase.table('lote').select('id').eq('id', pk).execute()
            if not existe.data:
                return Response({'error': 'Lote no encontrado'}, status=404)
            
            # Operación Crítica: Revertir Stock al eliminar un lote.
            # Buscamos todos los detalles de este lote y restamos su cantidad del stock físico.
            detalles = self.supabase.table('detalle_lote').select('stock_id, cantidad').eq('lote_id', pk).execute()
            for d in detalles.data:
                sql_stock = f"UPDATE stock SET cantidad = cantidad - {d['cantidad']} WHERE id = {d['stock_id']}"
                self.supabase.rpc('exec_sql', {'query': sql_stock}).execute()
            
            # Una vez revertido el inventario, eliminamos el lote (Sus detalles se eliminan por regla CASCADE en DB)
            sql_del = f"DELETE FROM lote WHERE id = {pk}"
            self.supabase.rpc('exec_sql', {'query': sql_del}).execute()
            
            return Response(status=204)
        except Exception as e:
            return Response({'error': str(e)}, status=500)