import logging
from datetime import datetime

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from supabase import create_client
from django.conf import settings

from bitacora.utils import registrar_accion, obtener_ip_cliente
from nucleo.resend_utils import enviar_email

logger = logging.getLogger(__name__)

ROLES_CONTRAPROPUESTA = ['administrador', 'gerente']


def _sb():
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)


class EnviarContrapropuestaView(APIView):
    """POST /api/proveedores/contrapropuesta/ — pide al proveedor que iguale una cotización más barata de la competencia."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.rol not in ROLES_CONTRAPROPUESTA:
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)

        insumo_id = request.data.get('insumo_id')
        proveedor_destino_id = request.data.get('proveedor_destino_id')
        if not insumo_id or not proveedor_destino_id:
            return Response(
                {'error': 'insumo_id y proveedor_destino_id son obligatorios.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            supabase = _sb()

            insumo_res = supabase.table('insumo').select('id, nombre').eq('id', insumo_id).execute()
            if not insumo_res.data:
                return Response({'error': 'Insumo no encontrado'}, status=status.HTTP_404_NOT_FOUND)
            insumo = insumo_res.data[0]

            destino_res = supabase.table('proveedor').select('id, nombre, email').eq('id', proveedor_destino_id).execute()
            if not destino_res.data:
                return Response({'error': 'Proveedor no encontrado'}, status=status.HTTP_404_NOT_FOUND)
            destino = destino_res.data[0]
            if not destino.get('email'):
                return Response(
                    {'error': f"El proveedor '{destino['nombre']}' no tiene email configurado."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            precios_res = supabase.table('proveedor_insumo').select(
                'proveedor_id, precio, proveedor:proveedor_id(id, nombre)'
            ).eq('insumo_id', insumo_id).execute()
            precios = precios_res.data or []
        except Exception as e:
            logger.error(f"Error cargando datos para contrapropuesta: {str(e)}")
            return Response(
                {'error': 'Error al cargar los datos del proveedor o del insumo.', 'detalle': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        precio_actual = next(
            (float(p['precio']) for p in precios if p.get('proveedor_id') == destino['id']),
            None,
        )

        competencia = [
            {
                'proveedor_id': p['proveedor_id'],
                'proveedor_nombre': (p.get('proveedor') or {}).get('nombre'),
                'precio': float(p['precio']),
            }
            for p in precios
            if p.get('proveedor_id') != destino['id'] and p.get('precio') is not None
        ]
        if not competencia:
            return Response(
                {'error': 'No hay una cotización de otro proveedor para este insumo.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        mejor_competencia = min(competencia, key=lambda c: c['precio'])

        asunto = f"Solicitud de mejora de precio — {insumo['nombre']}"
        cuerpo_texto = self._cuerpo_email(destino, insumo, precio_actual, mejor_competencia)
        cuerpo_html = self._cuerpo_email_html(destino, insumo, precio_actual, mejor_competencia)

        resultado_envio = enviar_email([destino['email']], asunto, cuerpo_texto, cuerpo_html)
        enviado = destino['email'] in resultado_envio['enviados']
        if not enviado:
            logger.error(f"No se pudo enviar la contrapropuesta a {destino['email']}: {resultado_envio['fallidos']}")

        ip_cliente = obtener_ip_cliente(request)
        registrar_accion(
            usuario_id=str(request.user.id),
            usuario_email=request.user.email,
            accion='ENVIAR_CONTRAPROPUESTA',
            detalles={
                'ip': ip_cliente,
                'insumo_id': insumo_id,
                'proveedor_destino_id': destino['id'],
                'precio_actual': precio_actual,
                'precio_competencia': mejor_competencia['precio'],
                'enviado': enviado,
            },
        )

        if not enviado:
            return Response(
                {'error': 'No se pudo enviar el correo al proveedor.', 'detalle': resultado_envio['fallidos']},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response({
            'enviado': True,
            'destinatario': destino['email'],
            'competencia': mejor_competencia,
        }, status=status.HTTP_200_OK)

    def _cuerpo_email(self, destino, insumo, precio_actual, competencia):
        fecha = datetime.now().strftime('%d/%m/%Y')
        precio_actual_txt = f"{precio_actual:.2f} Bs" if precio_actual is not None else "no registrado"
        lineas = [
            f"Estimados de {destino['nombre']}:",
            "",
            f"Reciban un cordial saludo. Al día de hoy ({fecha}) contamos con una "
            f"cotización de otro proveedor para '{insumo['nombre']}' por "
            f"{competencia['precio']:.2f} Bs por unidad, por debajo del precio actual "
            f"que manejamos con ustedes ({precio_actual_txt}).",
            "",
            "Nos gustaría saber si pueden igualar o mejorar esta cotización para "
            "continuar priorizando nuestra relación comercial.",
            "",
            "Quedamos atentos a su respuesta.",
            "",
            "Atentamente, Gerente Pulso.",
        ]
        return "\n".join(lineas)

    def _cuerpo_email_html(self, destino, insumo, precio_actual, competencia):
        fecha = datetime.now().strftime('%d/%m/%Y')
        precio_actual_txt = f"{precio_actual:.2f} Bs" if precio_actual is not None else "no registrado"

        return f"""\
<!DOCTYPE html>
<html lang="es">
  <body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Segoe UI,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
            <tr>
              <td style="background-color:#4f46e5;padding:24px 32px;">
                <p style="margin:0;color:#ffffff;font-size:12px;letter-spacing:0.05em;text-transform:uppercase;opacity:0.85;">Sistema de Gestión de Inventario</p>
                <h1 style="margin:4px 0 0;color:#ffffff;font-size:20px;">Solicitud de mejora de precio</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;color:#1f2937;font-size:15px;line-height:1.6;">Estimados de {destino['nombre']}:</p>
                <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">
                  Reciban un cordial saludo. Al día de hoy ({fecha}) contamos con una cotización
                  de otro proveedor para <strong>{insumo['nombre']}</strong> por debajo del
                  precio que manejamos actualmente con ustedes.
                </p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin-bottom:20px;">
                  <tr>
                    <td style="padding:10px 12px;background-color:#f9fafb;border-radius:8px 0 0 8px;color:#6b7280;">Precio actual</td>
                    <td style="padding:10px 12px;background-color:#f9fafb;border-radius:0 8px 8px 0;text-align:right;color:#111827;font-weight:700;">{precio_actual_txt}</td>
                  </tr>
                  <tr><td colspan="2" style="height:8px;"></td></tr>
                  <tr>
                    <td style="padding:10px 12px;background-color:#ecfdf5;border-radius:8px 0 0 8px;color:#047857;">Cotización de la competencia</td>
                    <td style="padding:10px 12px;background-color:#ecfdf5;border-radius:0 8px 8px 0;text-align:right;color:#047857;font-weight:700;">{competencia['precio']:.2f} Bs</td>
                  </tr>
                </table>

                <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">
                  Nos gustaría saber si pueden igualar o mejorar esta cotización para
                  continuar priorizando nuestra relación comercial.
                </p>

                <p style="margin:0;color:#1f2937;font-size:15px;line-height:1.6;">Atentamente,<br/>Gerente Pulso.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
                <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
                  Este mensaje fue generado automáticamente por el Sistema de Información
                  para la Gestión de Almacenes Gastronómicos.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""
