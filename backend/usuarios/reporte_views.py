import io
import datetime
from django.http import HttpResponse, JsonResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors
import openpyxl
import logging

from .pago_services import get_supabase_client
from bitacora.utils import registrar_accion, obtener_ip_cliente

logger = logging.getLogger(__name__)

def obtener_temporada(mes):
    if mes in [12, 1, 2]: return 'verano'
    elif mes in [3, 4, 5]: return 'otoño'
    elif mes in [6, 7, 8]: return 'invierno'
    else: return 'primavera'

def obtener_nombre_mes(mes):
    nombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    return nombres[mes-1]

def generar_datos_reporte(insumo_id=None, temporada=None, anio=None):
    try:
        supabase = get_supabase_client()
        query = supabase.table('proveedor_insumo').select('precio, fecha, insumo:insumo_id(id, nombre), proveedor:proveedor_id(id, nombre)')
        if insumo_id:
            query = query.eq('insumo_id', insumo_id)
            
        result = query.execute()
        datos = result.data or []
        
        # Procesar y agrupar en memoria
        agrupado = {}
        for row in datos:
            if not row.get('fecha') or not row.get('precio'): continue
            
            try:
                dt = datetime.datetime.strptime(row['fecha'].split('T')[0], '%Y-%m-%d')
            except:
                continue
                
            row_anio = dt.year
            row_mes = dt.month
            row_temporada = obtener_temporada(row_mes)
            
            if anio and str(row_anio) != str(anio): continue
            if temporada and temporada.lower() != 'todo año' and row_temporada != temporada.lower(): continue
            
            insumo_nombre = row.get('insumo', {}).get('nombre', 'Desconocido')
            prov_nombre = row.get('proveedor', {}).get('nombre', 'Desconocido')
            
            clave = (insumo_nombre, prov_nombre, row_temporada, row_mes, row_anio)
            if clave not in agrupado:
                agrupado[clave] = {'suma': 0, 'cantidad': 0}
            
            agrupado[clave]['suma'] += float(row['precio'])
            agrupado[clave]['cantidad'] += 1
            
        # Formatear el resultado
        resultado = []
        for clave, vals in agrupado.items():
            promedio = vals['suma'] / vals['cantidad']
            resultado.append({
                'insumo': clave[0],
                'proveedor': clave[1],
                'temporada': clave[2].capitalize(),
                'mes': obtener_nombre_mes(clave[3]),
                'anio': clave[4],
                'precio_promedio': round(promedio, 2)
            })
            
        # Ordenar por Insumo, Año, Mes
        resultado.sort(key=lambda x: (x['insumo'], x['anio'], x['mes']))
        return resultado
    except Exception as e:
        logger.error(f"Error generando datos reporte: {str(e)}")
        return []


class ReporteComparativaPreciosView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        insumo_id = request.query_params.get('insumo_id')
        temporada = request.query_params.get('temporada')
        anio = request.query_params.get('anio')
        
        datos = generar_datos_reporte(insumo_id, temporada, anio)
        
        # Bitacora
        registrar_accion(
            usuario_id=str(request.user.id),
            usuario_email=request.user.email,
            accion="GENERAR_REPORTE_COMPARATIVA",
            detalles={"ip": obtener_ip_cliente(request), "formato": "JSON"}
        )
        
        return Response(datos, status=status.HTTP_200_OK)


class ReporteComparativaPDFView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        insumo_id = request.query_params.get('insumo_id')
        temporada = request.query_params.get('temporada')
        anio = request.query_params.get('anio')
        
        datos = generar_datos_reporte(insumo_id, temporada, anio)
        
        # Bitacora
        registrar_accion(
            usuario_id=str(request.user.id),
            usuario_email=request.user.email,
            accion="GENERAR_REPORTE_COMPARATIVA",
            detalles={"ip": obtener_ip_cliente(request), "formato": "PDF"}
        )
        
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        elements = []
        
        styles = getSampleStyleSheet()
        elements.append(Paragraph("Reporte Comparativa de Precios por Temporada", styles['Title']))
        elements.append(Spacer(1, 12))
        
        # Tabla
        table_data = [['Insumo', 'Proveedor', 'Temporada', 'Mes', 'Año', 'Precio Promedio (Bs)']]
        for row in datos:
            table_data.append([
                row['insumo'], row['proveedor'], row['temporada'], row['mes'], str(row['anio']), str(row['precio_promedio'])
            ])
            
        t = Table(table_data)
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1f2937')),
            ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,0), 12),
            ('BOTTOMPADDING', (0,0), (-1,0), 12),
            ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#f9fafb')),
            ('TEXTCOLOR', (0,1), (-1,-1), colors.black),
            ('GRID', (0,0), (-1,-1), 1, colors.black)
        ]))
        
        elements.append(t)
        doc.build(elements)
        
        buffer.seek(0)
        response = HttpResponse(buffer, content_type='application/pdf')
        response['Content-Disposition'] = 'attachment; filename="Reporte_Comparativa_Precios.pdf"'
        return response


class ReporteComparativaExcelView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        insumo_id = request.query_params.get('insumo_id')
        temporada = request.query_params.get('temporada')
        anio = request.query_params.get('anio')
        
        datos = generar_datos_reporte(insumo_id, temporada, anio)
        
        # Bitacora
        registrar_accion(
            usuario_id=str(request.user.id),
            usuario_email=request.user.email,
            accion="GENERAR_REPORTE_COMPARATIVA",
            detalles={"ip": obtener_ip_cliente(request), "formato": "Excel"}
        )
        
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Reporte Precios"
        
        # Headers
        headers = ['Insumo', 'Proveedor', 'Temporada', 'Mes', 'Año', 'Precio Promedio (Bs)']
        ws.append(headers)
        
        for row in datos:
            ws.append([
                row['insumo'], row['proveedor'], row['temporada'], row['mes'], row['anio'], row['precio_promedio']
            ])
            
        buffer = io.BytesIO()
        wb.save(buffer)
        buffer.seek(0)
        
        response = HttpResponse(buffer, content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = 'attachment; filename="Reporte_Comparativa_Precios.xlsx"'
        return response
