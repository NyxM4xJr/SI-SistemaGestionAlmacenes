# ============================================================
# ARCHIVO: backend/inventario/orden_compra_views.py
# CASO DE USO: CU37 - Órdenes de Compra Automáticas
# CICLO: 5
# FECHA: 03/07/26
#
# DESCRIPCIÓN:
#   Genera órdenes de compra a proveedores para los insumos cuyo
#   stock está en o por debajo del mínimo (stock.cantidad <= stock_min).
#   Por cada insumo se elige el proveedor de MENOR precio (tabla
#   proveedor_insumo.precio) y se agrupan los insumos por proveedor
#   en una orden. Al generarse, se notifica por email al proveedor.
#
# ENDPOINTS:
#   GET    /api/ordenes-compra/           → listar órdenes
#   POST   /api/ordenes-compra/           → crear orden manual
#   POST   /api/ordenes-compra/generar/   → generar automáticas
#   GET    /api/ordenes-compra/{id}/      → detalle
#   PATCH  /api/ordenes-compra/{id}/      → cambiar estado
#   DELETE /api/ordenes-compra/{id}/      → eliminar
#
# BITÁCORA:
#   GENERAR_ORDENES_COMPRA_AUTO, CREAR_ORDEN_COMPRA,
#   ACTUALIZAR_ORDEN_COMPRA, ELIMINAR_ORDEN_COMPRA
# ============================================================

import logging
from datetime import datetime

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from supabase import create_client
from django.conf import settings
from django.core.mail import send_mail
from bitacora.utils import registrar_accion, obtener_ip_cliente

logger = logging.getLogger(__name__)

ROLES_COMPRA = ['administrador', 'gerente']
ESTADOS_VALIDOS = ['generada', 'enviada', 'recibida', 'cancelada']
CANTIDAD_DEFAULT = 10  # cantidad a pedir si no hay stock_max definido


def _sb():
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)


class OrdenCompraListView(APIView):
    """
    GET  /api/ordenes-compra/  → Lista las órdenes de compra.
    POST /api/ordenes-compra/  → Crea una orden manual.

    Body POST:
    {
      "proveedor_id": int,
      "items": [ {"insumo_id": int, "cantidad": int, "precio_unitario": float}, ... ]
    }
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.rol not in ROLES_COMPRA:
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)
        try:
            supabase = _sb()
            response = (
                supabase.table('orden_compra')
                .select('*, proveedor:proveedor_id(nombre, email), '
                        'detalle_orden_compra(*, insumo:insumo_id(nombre))')
                .order('created_at', desc=True)
                .execute()
            )
            return Response(response.data or [], status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error listando órdenes de compra: {str(e)}")
            return Response(
                {'error': 'Error al obtener las órdenes de compra.', 'detalle': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def post(self, request):
        if request.user.rol not in ROLES_COMPRA:
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)

        proveedor_id = request.data.get('proveedor_id')
        items = request.data.get('items')

        if not proveedor_id:
            return Response({'error': 'proveedor_id es obligatorio.'}, status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(items, list) or not items:
            return Response({'error': 'Debe incluir al menos un insumo.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            supabase = _sb()
            total = 0.0
            detalle_rows = []
            for it in items:
                cantidad = int(it.get('cantidad', 0))
                precio = float(it.get('precio_unitario', 0) or 0)
                if not it.get('insumo_id') or cantidad <= 0:
                    return Response(
                        {'error': 'Cada item requiere insumo_id y cantidad > 0.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                subtotal = round(precio * cantidad, 2)
                total += subtotal
                detalle_rows.append({
                    'insumo_id': int(it['insumo_id']),
                    'cantidad': cantidad,
                    'precio_unitario': precio,
                    'subtotal': subtotal,
                })
            total = round(total, 2)

            orden_res = supabase.table('orden_compra').insert({
                'fecha': datetime.now().strftime('%Y-%m-%d'),
                'proveedor_id': int(proveedor_id),
                'estado': 'generada',
                'total': total,
                'generada_auto': False,
            }).execute()
            orden = orden_res.data[0]
            for row in detalle_rows:
                row['orden_id'] = orden['id']
            supabase.table('detalle_orden_compra').insert(detalle_rows).execute()

            ip_cliente = obtener_ip_cliente(request)
            registrar_accion(
                usuario_id=str(request.user.id),
                usuario_email=request.user.email,
                accion='CREAR_ORDEN_COMPRA',
                detalles={'ip': ip_cliente, 'orden_id': orden['id'], 'total': total}
            )
            return Response({**orden, 'detalle_orden_compra': detalle_rows}, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f"Error creando orden de compra: {str(e)}")
            return Response(
                {'error': 'Error al crear la orden de compra.', 'detalle': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class GenerarOrdenesAutomaticasView(APIView):
    """
    POST /api/ordenes-compra/generar/

    Genera órdenes de compra automáticas para los insumos con
    stock <= stock_min, eligiendo el proveedor de menor precio y
    notificando por email a cada proveedor.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.rol not in ROLES_COMPRA:
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)

        try:
            supabase = _sb()

            # 1) Stock bajo mínimo (comparación columna-columna se hace en Python)
            stock_res = supabase.table('stock').select(
                'id, insumo_id, cantidad, stock_min, stock_max, insumo:insumo_id(nombre)'
            ).execute()
            stock_rows = stock_res.data or []
            bajos = [
                s for s in stock_rows
                if s.get('stock_min') is not None
                and float(s.get('cantidad', 0)) <= float(s.get('stock_min'))
            ]

            if not bajos:
                return Response(
                    {'mensaje': 'No hay insumos en o por debajo del stock mínimo.', 'ordenes': []},
                    status=status.HTTP_200_OK
                )

            insumo_ids = list({s['insumo_id'] for s in bajos})

            # 2) proveedor_insumo de esos insumos, con datos del proveedor
            pi_res = supabase.table('proveedor_insumo').select(
                'insumo_id, precio, proveedor_id, proveedor:proveedor_id(id, nombre, email)'
            ).in_('insumo_id', insumo_ids).execute()
            pi_rows = pi_res.data or []

            # Elegir, por insumo, el proveedor de MENOR precio
            mejor_por_insumo = {}  # insumo_id -> {proveedor, precio}
            for pi in pi_rows:
                iid = pi['insumo_id']
                precio = float(pi.get('precio') or 0)
                if iid not in mejor_por_insumo or precio < mejor_por_insumo[iid]['precio']:
                    mejor_por_insumo[iid] = {
                        'precio': precio,
                        'proveedor_id': pi.get('proveedor_id'),
                        'proveedor': pi.get('proveedor') or {},
                    }

            # Mapa auxiliares insumo -> nombre / stock info
            nombre_insumo = {}
            stock_por_insumo = {}
            for s in bajos:
                nombre_insumo[s['insumo_id']] = (s.get('insumo') or {}).get('nombre', f"Insumo #{s['insumo_id']}")
                # Si un insumo tiene varias filas, se toma la primera bajo mínimo
                stock_por_insumo.setdefault(s['insumo_id'], s)

            # 3) Agrupar por proveedor
            por_proveedor = {}   # proveedor_id -> {proveedor, items:[...]}
            sin_proveedor = []   # insumos bajos sin proveedor asociado
            for iid in insumo_ids:
                mejor = mejor_por_insumo.get(iid)
                if not mejor or not mejor.get('proveedor_id'):
                    sin_proveedor.append(nombre_insumo.get(iid, f"Insumo #{iid}"))
                    continue

                s = stock_por_insumo[iid]
                cantidad_actual = float(s.get('cantidad', 0))
                stock_max = s.get('stock_max')
                if stock_max is not None and float(stock_max) > cantidad_actual:
                    cantidad = int(round(float(stock_max) - cantidad_actual))
                else:
                    cantidad = CANTIDAD_DEFAULT
                cantidad = max(cantidad, 1)

                precio = mejor['precio']
                pid = mejor['proveedor_id']
                por_proveedor.setdefault(pid, {'proveedor': mejor['proveedor'], 'items': []})
                por_proveedor[pid]['items'].append({
                    'insumo_id': iid,
                    'insumo_nombre': nombre_insumo.get(iid),
                    'cantidad': cantidad,
                    'precio_unitario': precio,
                    'subtotal': round(precio * cantidad, 2),
                })

            # 4) Crear una orden por proveedor + notificar por email
            ordenes_creadas = []
            for pid, grupo in por_proveedor.items():
                items = grupo['items']
                total = round(sum(i['subtotal'] for i in items), 2)

                orden_res = supabase.table('orden_compra').insert({
                    'fecha': datetime.now().strftime('%Y-%m-%d'),
                    'proveedor_id': pid,
                    'estado': 'generada',
                    'total': total,
                    'generada_auto': True,
                }).execute()
                orden = orden_res.data[0]

                detalle_rows = [{
                    'orden_id': orden['id'],
                    'insumo_id': i['insumo_id'],
                    'cantidad': i['cantidad'],
                    'precio_unitario': i['precio_unitario'],
                    'subtotal': i['subtotal'],
                } for i in items]
                supabase.table('detalle_orden_compra').insert(detalle_rows).execute()

                # Notificar al proveedor por email (si tiene email configurado)
                email_proveedor = (grupo['proveedor'] or {}).get('email')
                email_enviado = False
                if email_proveedor:
                    try:
                        send_mail(
                            subject=f"Orden de compra #{orden['id']}",
                            message=self._cuerpo_email(orden['id'], grupo['proveedor'], items, total),
                            from_email=settings.DEFAULT_FROM_EMAIL,
                            recipient_list=[email_proveedor],
                            fail_silently=False,
                        )
                        email_enviado = True
                        supabase.table('orden_compra').update(
                            {'estado': 'enviada'}
                        ).eq('id', orden['id']).execute()
                    except Exception as mail_err:
                        logger.error(f"Error enviando email orden {orden['id']}: {str(mail_err)}")

                ordenes_creadas.append({
                    'orden_id': orden['id'],
                    'proveedor': (grupo['proveedor'] or {}).get('nombre'),
                    'total': total,
                    'items': len(items),
                    'email_enviado': email_enviado,
                    'estado': 'enviada' if email_enviado else 'generada',
                })

            # 5) Bitácora
            ip_cliente = obtener_ip_cliente(request)
            registrar_accion(
                usuario_id=str(request.user.id),
                usuario_email=request.user.email,
                accion='GENERAR_ORDENES_COMPRA_AUTO',
                detalles={
                    'ip': ip_cliente,
                    'ordenes_generadas': len(ordenes_creadas),
                    'insumos_sin_proveedor': sin_proveedor,
                }
            )

            return Response({
                'ordenes': ordenes_creadas,
                'insumos_sin_proveedor': sin_proveedor,
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(f"Error generando órdenes automáticas: {str(e)}")
            return Response(
                {'error': 'Error al generar las órdenes de compra.', 'detalle': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def _cuerpo_email(self, orden_id, proveedor, items, total):
        lineas = [
            f"Estimado proveedor {proveedor.get('nombre', '')}:",
            "",
            f"Se ha generado la orden de compra #{orden_id} con el siguiente detalle:",
            "",
        ]
        for i in items:
            lineas.append(
                f"  - {i['insumo_nombre']}: {i['cantidad']} unidad(es) "
                f"x {i['precio_unitario']} Bs = {i['subtotal']} Bs"
            )
        lineas.append("")
        lineas.append(f"TOTAL: {total} Bs")
        lineas.append("")
        lineas.append("Este es un mensaje automático del sistema de inventario.")
        return "\n".join(lineas)


class OrdenCompraDetailView(APIView):
    """
    GET    /api/ordenes-compra/{id}/  → Detalle de una orden.
    PATCH  /api/ordenes-compra/{id}/  → Cambia el estado.
    DELETE /api/ordenes-compra/{id}/  → Elimina una orden.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, orden_id):
        try:
            supabase = _sb()
            res = (
                supabase.table('orden_compra')
                .select('*, proveedor:proveedor_id(nombre, email), '
                        'detalle_orden_compra(*, insumo:insumo_id(nombre))')
                .eq('id', orden_id)
                .execute()
            )
            if not res.data:
                return Response({'error': 'Orden no encontrada'}, status=status.HTTP_404_NOT_FOUND)
            return Response(res.data[0], status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error obteniendo orden {orden_id}: {str(e)}")
            return Response({'error': 'Error al obtener la orden.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def patch(self, request, orden_id):
        if request.user.rol not in ROLES_COMPRA:
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)

        estado = request.data.get('estado')
        if estado not in ESTADOS_VALIDOS:
            return Response(
                {'error': f'Estado inválido. Válidos: {ESTADOS_VALIDOS}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            supabase = _sb()
            check = supabase.table('orden_compra').select('id').eq('id', orden_id).execute()
            if not check.data:
                return Response({'error': 'Orden no encontrada'}, status=status.HTTP_404_NOT_FOUND)

            supabase.table('orden_compra').update({'estado': estado}).eq('id', orden_id).execute()

            ip_cliente = obtener_ip_cliente(request)
            registrar_accion(
                usuario_id=str(request.user.id),
                usuario_email=request.user.email,
                accion='ACTUALIZAR_ORDEN_COMPRA',
                detalles={'ip': ip_cliente, 'orden_id': orden_id, 'estado': estado}
            )
            return Response({'id': orden_id, 'estado': estado}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error actualizando orden {orden_id}: {str(e)}")
            return Response({'error': 'Error al actualizar la orden.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def delete(self, request, orden_id):
        if request.user.rol not in ROLES_COMPRA:
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)
        try:
            supabase = _sb()
            check = supabase.table('orden_compra').select('id').eq('id', orden_id).execute()
            if not check.data:
                return Response({'error': 'Orden no encontrada'}, status=status.HTTP_404_NOT_FOUND)

            # detalle_orden_compra se elimina en cascada (FK on delete cascade)
            supabase.table('orden_compra').delete().eq('id', orden_id).execute()

            ip_cliente = obtener_ip_cliente(request)
            registrar_accion(
                usuario_id=str(request.user.id),
                usuario_email=request.user.email,
                accion='ELIMINAR_ORDEN_COMPRA',
                detalles={'ip': ip_cliente, 'orden_id': orden_id}
            )
            return Response({'mensaje': 'Orden eliminada'}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error eliminando orden {orden_id}: {str(e)}")
            return Response({'error': 'Error al eliminar la orden.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
