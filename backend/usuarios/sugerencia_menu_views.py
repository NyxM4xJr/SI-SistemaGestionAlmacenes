"""
============================================================
ARCHIVO: backend/usuarios/sugerencia_menu_views.py
CASO DE USO: CU24 - Consultar Sugerencia de Menú por Temporada
CICLO: 4
AUTOR: Karen Ortega
FECHA: 19/06/26
============================================================

DESCRIPCIÓN:
Sugiere platos del catálogo que conviene priorizar porque usan
insumos en temporada (POR_ESTACIONES, más baratos) o próximos a
vencer (DETALLE_LOTE.fecha_vencimiento <= hoy+7, con stock > 0).
El costo estimado del plato reutiliza la lógica de costo real de
CU27 (_calcular_reporte_costos), sustituyendo el costo_unitario
normal por POR_ESTACIONES.precio_prom SOLO para los insumos que
están en la temporada consultada.

"Agregar a Menú" NO se implementa aquí: el frontend reutiliza el
endpoint ya existente de CU23 (POST /api/menus/<id>/platos/).

No se crea ninguna tabla nueva. Solo lectura de POR_ESTACIONES,
DETALLE_LOTE, STOCK, PLATO, RECETA, DETALLE_RECETA, FICHA_TECNICA
— y un INSERT en DETALLE_BITACORA.
"""

import logging
from datetime import date, timedelta

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from supabase import create_client
from django.conf import settings

from bitacora.utils import registrar_accion, obtener_ip_cliente
from .reporte_costos_views import _calcular_reporte_costos

logger = logging.getLogger(__name__)

# Mapeo mes -> temporada (hemisferio sur, Bolivia)
MESES_POR_TEMPORADA = {
    "verano": [12, 1, 2],
    "otono": [3, 4, 5],
    "invierno": [6, 7, 8],
    "primavera": [9, 10, 11],
}


def _temporada_actual():
    """Determina la temporada según el mes actual (hemisferio sur)."""
    mes_actual = date.today().month
    for temporada, meses in MESES_POR_TEMPORADA.items():
        if mes_actual in meses:
            return temporada
    return "verano"  # fallback, no debería ocurrir


class SugerirMenuView(APIView):
    """
    Endpoint para consultar sugerencias de menú por temporada.

    Método: GET
    URL: /api/sugerir-menu/
    Query params:
        - temporada (opcional): "verano" | "otono" | "invierno" | "primavera".
          Si no se indica, se usa la temporada actual según el mes.

    Respuesta exitosa (200):
    {
        "temporada": "invierno",
        "sin_datos_temporada": false,
        "platos_sugeridos": [
            {
                "plato_id": 10,
                "plato_nombre": "Hamburguesa",
                "en_temporada": true,
                "proximo_vencer": false,
                "costo_estimado": 11.20,
                "costo_normal": 13.75,
                "ahorro": 2.55,
                "insumos_en_temporada": ["Tomate"],
                "insumos_por_vencer": []
            }
        ]
    }
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        temporada = request.query_params.get('temporada')
        if not temporada:
            temporada = _temporada_actual()
        temporada = temporada.lower()

        if temporada not in MESES_POR_TEMPORADA:
            return Response(
                {'error': f'Temporada inválida. Debe ser una de: {", ".join(MESES_POR_TEMPORADA.keys())}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

            # 1) Insumos en temporada (POR_ESTACIONES)
            estaciones = supabase.table('por_estaciones') \
                .select('insumo_id, precio_prom') \
                .eq('tipo_temporada', temporada) \
                .execute().data or []

            sin_datos_temporada = len(estaciones) == 0
            precio_temporada_por_insumo = {
                e['insumo_id']: float(e['precio_prom']) for e in estaciones
            }
            insumos_en_temporada_ids = set(precio_temporada_por_insumo.keys())

            # 2) Insumos próximos a vencer (DETALLE_LOTE + STOCK > 0)
            hoy = date.today()
            limite = (hoy + timedelta(days=7)).isoformat()

            detalle_lotes_vencer = supabase.table('detalle_lote') \
                .select('insumo_id, stock_id, fecha_vencimiento') \
                .lte('fecha_vencimiento', limite) \
                .execute().data or []

            stock_ids = list({d['stock_id'] for d in detalle_lotes_vencer if d.get('stock_id')})
            stocks_con_cantidad = {}
            if stock_ids:
                stocks = supabase.table('stock') \
                    .select('id, cantidad') \
                    .in_('id', stock_ids) \
                    .execute().data or []
                stocks_con_cantidad = {s['id']: float(s['cantidad']) for s in stocks}

            insumos_por_vencer_ids = set()
            for d in detalle_lotes_vencer:
                cantidad_stock = stocks_con_cantidad.get(d.get('stock_id'), 0)
                if cantidad_stock > 0:
                    insumos_por_vencer_ids.add(d['insumo_id'])

            insumos_relevantes_ids = insumos_en_temporada_ids | insumos_por_vencer_ids

            if not insumos_relevantes_ids:
                return Response({
                    'temporada': temporada,
                    'sin_datos_temporada': sin_datos_temporada,
                    'platos_sugeridos': [],
                }, status=status.HTTP_200_OK)

            # 3) DETALLE_RECETA: platos que usan esos insumos
            detalles_relevantes = supabase.table('detalle_receta') \
                .select('receta_id, insumo_id, cantidad, insumo:insumo_id(nombre)') \
                .in_('insumo_id', list(insumos_relevantes_ids)) \
                .execute().data or []

            if not detalles_relevantes:
                return Response({
                    'temporada': temporada,
                    'sin_datos_temporada': sin_datos_temporada,
                    'platos_sugeridos': [],
                }, status=status.HTTP_200_OK)

            receta_ids_relevantes = list({d['receta_id'] for d in detalles_relevantes})

            recetas = supabase.table('receta') \
                .select('id, plato_id') \
                .in_('id', receta_ids_relevantes) \
                .execute().data or []
            receta_a_plato = {r['id']: r['plato_id'] for r in recetas}
            plato_ids_sugeridos = list({receta_a_plato[r['id']] for r in recetas})

            # Agrupar insumos relevantes por plato (para los badges/listas)
            insumos_temporada_por_plato = {}
            insumos_vencer_por_plato = {}
            for d in detalles_relevantes:
                p_id = receta_a_plato.get(d['receta_id'])
                if p_id is None:
                    continue
                nombre_insumo = (d.get('insumo') or {}).get('nombre', 'Desconocido')
                if d['insumo_id'] in insumos_en_temporada_ids:
                    insumos_temporada_por_plato.setdefault(p_id, set()).add(nombre_insumo)
                if d['insumo_id'] in insumos_por_vencer_ids:
                    insumos_vencer_por_plato.setdefault(p_id, set()).add(nombre_insumo)

            # 4) Costo NORMAL de cada plato sugerido (reutiliza CU27)
            reporte_normal = _calcular_reporte_costos(supabase)
            costo_normal_por_plato = {r['plato_id']: r['costo_real'] for r in reporte_normal}

            # 5) Costo ESTIMADO en temporada: mismo cálculo que CU27, pero
            #    sustituyendo costo_unitario por precio_prom SOLO para los
            #    insumos en temporada.
            costo_estimado_por_plato = _calcular_costo_estimado_temporada(
                supabase, plato_ids_sugeridos, precio_temporada_por_insumo
            )

            # 6) Armar respuesta final
            platos_response = supabase.table('plato') \
                .select('id, nombre') \
                .in_('id', plato_ids_sugeridos) \
                .execute().data or []
            nombres_plato = {p['id']: p['nombre'] for p in platos_response}

            platos_sugeridos = []
            for p_id in plato_ids_sugeridos:
                costo_normal = costo_normal_por_plato.get(p_id, 0.0)
                costo_estimado = costo_estimado_por_plato.get(p_id, costo_normal)
                ahorro = round(costo_normal - costo_estimado, 2)

                platos_sugeridos.append({
                    'plato_id': p_id,
                    'plato_nombre': nombres_plato.get(p_id, 'Desconocido'),
                    'en_temporada': p_id in insumos_temporada_por_plato,
                    'proximo_vencer': p_id in insumos_vencer_por_plato,
                    'costo_estimado': round(costo_estimado, 2),
                    'costo_normal': round(costo_normal, 2),
                    'ahorro': ahorro,
                    'insumos_en_temporada': sorted(insumos_temporada_por_plato.get(p_id, [])),
                    'insumos_por_vencer': sorted(insumos_vencer_por_plato.get(p_id, [])),
                })

            platos_sugeridos.sort(key=lambda x: x['ahorro'], reverse=True)

            ip_cliente = obtener_ip_cliente(request)
            registrar_accion(
                usuario_id=str(request.user.id),
                usuario_email=request.user.email,
                accion="CONSULTAR_SUGERENCIA_MENU",
                detalles={
                    "ip": ip_cliente,
                    "temporada": temporada,
                    "total_platos_sugeridos": len(platos_sugeridos),
                }
            )

            return Response({
                'temporada': temporada,
                'sin_datos_temporada': sin_datos_temporada,
                'platos_sugeridos': platos_sugeridos,
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error generando sugerencia de menú: {str(e)}")
            return Response(
                {'error': f'Error al generar la sugerencia: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


def _calcular_costo_estimado_temporada(supabase, plato_ids, precio_temporada_por_insumo):
    """
    Calcula el costo REAL de cada plato (mismo criterio de CU27: incluye
    merma técnica) pero sustituyendo el costo_unitario normal por
    POR_ESTACIONES.precio_prom para los insumos que están en temporada.
    Los insumos que no están en temporada siguen usando su costo_unitario
    vigente normal (lote más reciente), igual que en CU27.
    """
    if not plato_ids:
        return {}

    recetas = supabase.table('receta') \
        .select('id, plato_id') \
        .in_('plato_id', plato_ids) \
        .execute().data or []

    if not recetas:
        return {}

    receta_ids = [r['id'] for r in recetas]
    receta_a_plato = {r['id']: r['plato_id'] for r in recetas}

    detalles = supabase.table('detalle_receta') \
        .select('receta_id, insumo_id, cantidad') \
        .in_('receta_id', receta_ids) \
        .execute().data or []

    insumo_ids = list({d['insumo_id'] for d in detalles})

    # Costo unitario normal (lote más reciente) — mismo criterio de CU27
    costo_unitario_normal = {}
    if insumo_ids:
        detalle_lotes = supabase.table('detalle_lote') \
            .select('insumo_id, costo_unitario, lote:lote_id(created_at)') \
            .in_('insumo_id', insumo_ids) \
            .execute().data or []

        mas_reciente_por_insumo = {}
        for dl in detalle_lotes:
            insumo_id = dl['insumo_id']
            lote_info = dl.get('lote') or {}
            created_at = lote_info.get('created_at')
            if not created_at:
                continue
            if insumo_id not in mas_reciente_por_insumo or created_at > mas_reciente_por_insumo[insumo_id]:
                mas_reciente_por_insumo[insumo_id] = created_at
                costo_unitario_normal[insumo_id] = float(dl['costo_unitario'])

    # Merma técnica (CU22) — mismo criterio de CU27
    merma_por_insumo = {}
    if insumo_ids:
        fichas = supabase.table('ficha_tecnica') \
            .select('insumo_id, porcentaje_merma') \
            .in_('insumo_id', insumo_ids) \
            .execute().data or []
        for f in fichas:
            if f.get('porcentaje_merma') is not None:
                merma_por_insumo[f['insumo_id']] = float(f['porcentaje_merma'])

    detalles_por_plato = {}
    for d in detalles:
        p_id = receta_a_plato.get(d['receta_id'])
        detalles_por_plato.setdefault(p_id, []).append(d)

    costo_estimado_por_plato = {}
    for p_id, sus_detalles in detalles_por_plato.items():
        costo_real_estimado = 0.0
        for d in sus_detalles:
            insumo_id = d['insumo_id']
            cantidad = float(d['cantidad'])
            merma = merma_por_insumo.get(insumo_id, 0.0)

            # Usa precio de temporada SI el insumo está en temporada,
            # si no, usa el costo unitario normal de CU27.
            if insumo_id in precio_temporada_por_insumo:
                costo_unitario = precio_temporada_por_insumo[insumo_id]
            else:
                costo_unitario = costo_unitario_normal.get(insumo_id, 0.0)

            costo_real_estimado += cantidad * costo_unitario * (1 + merma / 100)

        costo_estimado_por_plato[p_id] = costo_real_estimado

    return costo_estimado_por_plato