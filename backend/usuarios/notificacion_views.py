# ============================================================
# ARCHIVO: backend/usuarios/notificacion_views.py
# CASO DE USO: CU33 - Notificaciones de Alertas por Email
# CICLO: 5
# FECHA: 03/07/26
#
# DESCRIPCIÓN:
#   Revisa las alertas de stock pendientes (alertas_stock.leida=False)
#   y los lotes próximos a vencer (detalle_lote.fecha_vencimiento dentro
#   de una ventana de N días) y envía un correo resumen (SMTP) a los
#   usuarios con rol administrador/gerente/chef.
#
#   Se dispara BAJO DEMANDA desde el panel de alertas del frontend
#   (botón "Revisar y notificar por email"). No hay cron/scheduler.
#
# ENDPOINTS:
#   POST /api/notificaciones/revisar/ → revisa y envía el resumen
#
# BITÁCORA:
#   ENVIAR_NOTIFICACION_ALERTAS → cuando se envía el correo
# ============================================================

import logging
from datetime import date, timedelta

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.conf import settings
from django.core.mail import send_mail
from supabase import create_client
from bitacora.utils import registrar_accion, obtener_ip_cliente

logger = logging.getLogger(__name__)

# Roles que reciben las notificaciones por correo
ROLES_DESTINATARIOS = ['administrador', 'gerente', 'chef']
# Ventana por defecto (días) para considerar un lote "próximo a vencer"
DIAS_VENTANA_DEFAULT = 7


class RevisarNotificarView(APIView):
    """
    POST /api/notificaciones/revisar/

    Body opcional: { "dias": 7 }  -> ventana de próximos a vencer.

    Solo administrador/gerente pueden disparar el envío.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Restricción por rol (patrón manual del proyecto)
        if request.user.rol not in ['administrador', 'gerente']:
            return Response(
                {'error': 'No autorizado'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Ventana de días para lotes próximos a vencer
        try:
            dias = int(request.data.get('dias', DIAS_VENTANA_DEFAULT))
            if dias < 0:
                dias = DIAS_VENTANA_DEFAULT
        except (TypeError, ValueError):
            dias = DIAS_VENTANA_DEFAULT

        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

            # 1) Alertas de stock pendientes (no leídas)
            alertas_res = supabase.table('alertas_stock').select(
                'id, mensaje, fecha, stock:stock_id(cantidad, stock_min, insumo:insumo_id(nombre))'
            ).eq('leida', False).order('fecha', desc=True).execute()
            alertas = alertas_res.data or []

            # 2) Lotes próximos a vencer (o ya vencidos) dentro de la ventana
            hoy = date.today()
            limite = (hoy + timedelta(days=dias)).isoformat()
            lotes_res = supabase.table('detalle_lote').select(
                'id, fecha_vencimiento, cantidad, insumo:insumo_id(nombre)'
            ).lte('fecha_vencimiento', limite).order(
                'fecha_vencimiento', desc=False
            ).execute()
            lotes = lotes_res.data or []

            # Si no hay nada que notificar, no enviamos correo
            if not alertas and not lotes:
                return Response(
                    {
                        'enviado': False,
                        'motivo': 'No hay alertas pendientes ni lotes por vencer.',
                        'alertas': 0,
                        'lotes_por_vencer': 0,
                        'destinatarios': 0,
                    },
                    status=status.HTTP_200_OK
                )

            # 3) Destinatarios: usuarios con rol relevante y email válido
            usuarios_res = supabase.table('usuario').select(
                'email, nombre, rol'
            ).in_('rol', ROLES_DESTINATARIOS).execute()
            destinatarios = [
                u['email'] for u in (usuarios_res.data or [])
                if u.get('email')
            ]

            if not destinatarios:
                return Response(
                    {'error': 'No hay destinatarios con email configurado.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # 4) Armar el cuerpo del correo
            asunto = f"[Inventario] {len(alertas)} alerta(s) y {len(lotes)} lote(s) por vencer"
            cuerpo = self._construir_cuerpo(alertas, lotes, dias, hoy)

            # 5) Enviar
            enviados = send_mail(
                subject=asunto,
                message=cuerpo,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=destinatarios,
                fail_silently=False,
            )

            # 6) Bitácora
            ip_cliente = obtener_ip_cliente(request)
            registrar_accion(
                usuario_id=str(request.user.id),
                usuario_email=request.user.email,
                accion='ENVIAR_NOTIFICACION_ALERTAS',
                detalles={
                    'ip': ip_cliente,
                    'alertas': len(alertas),
                    'lotes_por_vencer': len(lotes),
                    'destinatarios': len(destinatarios),
                }
            )

            return Response(
                {
                    'enviado': enviados > 0,
                    'alertas': len(alertas),
                    'lotes_por_vencer': len(lotes),
                    'destinatarios': len(destinatarios),
                },
                status=status.HTTP_200_OK
            )

        except Exception as e:
            logger.error(f"Error en RevisarNotificarView: {str(e)}")
            return Response(
                {'error': 'No se pudo enviar la notificación por correo.', 'detalle': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def _construir_cuerpo(self, alertas, lotes, dias, hoy):
        """Genera el texto plano del correo resumen."""
        lineas = []
        lineas.append("Resumen de alertas del sistema de inventario")
        lineas.append(f"Fecha: {hoy.isoformat()}")
        lineas.append("")

        lineas.append(f"== ALERTAS DE STOCK PENDIENTES ({len(alertas)}) ==")
        if alertas:
            for a in alertas:
                stock = a.get('stock') or {}
                insumo = (stock.get('insumo') or {}).get('nombre', 'insumo')
                lineas.append(f"  - [{insumo}] {a.get('mensaje', '')}")
        else:
            lineas.append("  (sin alertas pendientes)")
        lineas.append("")

        lineas.append(f"== LOTES POR VENCER (ventana {dias} días) ({len(lotes)}) ==")
        if lotes:
            for l in lotes:
                insumo = (l.get('insumo') or {}).get('nombre', 'insumo')
                fv = l.get('fecha_vencimiento', '')
                estado = 'VENCIDO' if fv and fv < hoy.isoformat() else 'por vencer'
                lineas.append(
                    f"  - [{insumo}] vence {fv} ({estado}) - cantidad {l.get('cantidad', '')}"
                )
        else:
            lineas.append("  (sin lotes por vencer)")
        lineas.append("")
        lineas.append("Este es un mensaje automático. No responder.")

        return "\n".join(lineas)
