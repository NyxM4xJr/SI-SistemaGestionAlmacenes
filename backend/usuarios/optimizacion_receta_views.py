import logging

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from supabase import create_client
from django.conf import settings

from bitacora.utils import registrar_accion, obtener_ip_cliente
from nucleo.openai_utils import generar_json_ia, IANoDisponibleError
from .reporte_costos_views import _calcular_reporte_costos

logger = logging.getLogger(__name__)

ROLES_OPTIMIZACION = ['administrador', 'gerente', 'chef']

SYSTEM_PROMPT_OPTIMIZACION = (
    "Sos un chef asistente experto en costos de un restaurante. Te paso, en "
    "JSON, los ingredientes de una receta con su costo unitario actual, y una "
    "lista de insumos alternativos de la misma categoría con costo unitario "
    "más barato. Elegí SOLO las sustituciones que tengan sentido culinario "
    "(mismo tipo de ingrediente, no cambies el perfil del plato) y que "
    "efectivamente reduzcan el costo. No inventes insumos que no estén en la "
    "lista de alternativas. Si ninguna sustitución tiene sentido, devolvé una "
    "lista vacía.\n\n"
    "Respondé EXCLUSIVAMENTE con JSON válido, sin texto antes ni después, con "
    "esta forma exacta:\n"
    '{"sustituciones": [{"insumo_original": str, "insumo_sugerido": str, '
    '"motivo": str}], "resumen": str}\n'
    "'resumen': 1 o 2 frases directas (máx. 40 palabras) sobre el ahorro "
    "logrado. En español, texto plano sin Markdown."
)


def _sb():
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)


def _costo_min_por_insumo(supabase, insumo_ids):
    """insumo_id -> menor precio disponible en proveedor_insumo."""
    if not insumo_ids:
        return {}
    filas = supabase.table('proveedor_insumo').select(
        'insumo_id, precio'
    ).in_('insumo_id', insumo_ids).execute().data or []

    costo_min = {}
    for f in filas:
        iid = f['insumo_id']
        precio = float(f.get('precio') or 0)
        if precio <= 0:
            continue
        if iid not in costo_min or precio < costo_min[iid]:
            costo_min[iid] = precio
    return costo_min


def _alternativas_por_categoria(supabase, insumo_ids_excluir, categorias):
    """
    Para cada categoría, devuelve los insumos del catálogo (excluyendo los ya
    usados en la receta) junto con su costo unitario más barato disponible.
    """
    if not categorias:
        return {}

    catalogo = supabase.table('insumo').select(
        'id, nombre, categoria'
    ).in_('categoria', list(categorias)).execute().data or []
    catalogo = [c for c in catalogo if c['id'] not in insumo_ids_excluir]

    candidato_ids = [c['id'] for c in catalogo]
    costo_min = _costo_min_por_insumo(supabase, candidato_ids)

    alternativas_por_categoria = {}
    for c in catalogo:
        precio = costo_min.get(c['id'])
        if precio is None:
            continue
        alternativas_por_categoria.setdefault(c['categoria'], []).append({
            'insumo_id': c['id'],
            'nombre': c['nombre'],
            'costo_unitario': precio,
        })
    return alternativas_por_categoria


class OptimizarRecetaIAView(APIView):
    """GET /api/recetas-ia/optimizar/?plato_id=N — sugiere sustituciones de insumos más baratas para una receta."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.rol not in ROLES_OPTIMIZACION:
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)

        plato_id = request.query_params.get('plato_id')
        if not plato_id:
            return Response({'error': 'plato_id es obligatorio.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            plato_id = int(plato_id)
        except (TypeError, ValueError):
            return Response({'error': 'plato_id debe ser un entero.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            supabase = _sb()
            reporte = _calcular_reporte_costos(supabase, plato_id=plato_id)
        except Exception as e:
            logger.error(f"Error calculando costo base para CU45: {str(e)}")
            return Response(
                {'error': 'Error al calcular el costo de la receta.', 'detalle': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        if not reporte:
            return Response(
                {'error': 'El plato no tiene una receta asociada o no existe.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        info_plato = reporte[0]

        try:
            receta_res = supabase.table('receta').select('id').eq('plato_id', plato_id).execute()
            if not receta_res.data:
                return Response({'error': 'El plato no tiene receta asociada.'}, status=status.HTTP_404_NOT_FOUND)
            receta_id = receta_res.data[0]['id']

            detalles = supabase.table('detalle_receta').select(
                'insumo_id, cantidad, insumo:insumo_id(nombre, categoria)'
            ).eq('receta_id', receta_id).execute().data or []
        except Exception as e:
            logger.error(f"Error obteniendo ingredientes de receta para CU45: {str(e)}")
            return Response(
                {'error': 'Error al obtener los ingredientes de la receta.', 'detalle': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        insumo_ids = [d['insumo_id'] for d in detalles]
        costo_actual_por_insumo = _costo_min_por_insumo(supabase, insumo_ids)
        categorias = {(d.get('insumo') or {}).get('categoria') for d in detalles if (d.get('insumo') or {}).get('categoria')}
        alternativas = _alternativas_por_categoria(supabase, set(insumo_ids), categorias)

        ingredientes = []
        candidatos_ia = []
        for d in detalles:
            iid = d['insumo_id']
            info = d.get('insumo') or {}
            categoria = info.get('categoria')
            costo_actual = costo_actual_por_insumo.get(iid, 0.0)
            cantidad = float(d.get('cantidad') or 0)
            opciones = [
                a for a in alternativas.get(categoria, [])
                if a['costo_unitario'] < costo_actual
            ]
            ingredientes.append({
                'insumo_id': iid,
                'insumo': info.get('nombre', f'Insumo #{iid}'),
                'categoria': categoria,
                'cantidad': cantidad,
                'costo_unitario': costo_actual,
            })
            if opciones:
                candidatos_ia.append({
                    'insumo_original': info.get('nombre', f'Insumo #{iid}'),
                    'costo_unitario_original': costo_actual,
                    'categoria': categoria,
                    'alternativas': sorted(opciones, key=lambda x: x['costo_unitario'])[:5],
                })

        if not candidatos_ia:
            return Response({
                'plato': {'id': plato_id, 'nombre': info_plato['plato_nombre']},
                'costo_actual': info_plato['costo_real'],
                'margen_actual': info_plato['margen'],
                'sustituciones': [],
                'costo_proyectado': info_plato['costo_real'],
                'margen_proyectado': info_plato['margen'],
                'ahorro_total': 0.0,
                'ahorro_porcentaje': 0.0,
                'resumen': 'No hay insumos alternativos más baratos disponibles para esta receta.',
            }, status=status.HTTP_200_OK)

        try:
            resultado = generar_json_ia(
                SYSTEM_PROMPT_OPTIMIZACION,
                f"Ingredientes con alternativas más baratas:\n{candidatos_ia}",
                max_tokens=800,
            )
        except IANoDisponibleError as e:
            logger.error(f"IA no disponible para CU45: {str(e)}")
            return Response(
                {'error': f'El agente de IA no está disponible: {str(e)}'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        sugeridas = resultado.get('sustituciones', []) if isinstance(resultado, dict) else []
        resumen = (resultado.get('resumen') or '').strip() if isinstance(resultado, dict) else ''

        nombre_a_ingrediente = {i['insumo']: i for i in ingredientes}
        alternativa_por_nombre = {}
        for lista in alternativas.values():
            for a in lista:
                alternativa_por_nombre[a['nombre']] = a

        sustituciones = []
        ahorro_total_unitario = 0.0
        for s in sugeridas:
            original = nombre_a_ingrediente.get(s.get('insumo_original'))
            sugerido = alternativa_por_nombre.get(s.get('insumo_sugerido'))
            if not original or not sugerido or sugerido['costo_unitario'] >= original['costo_unitario']:
                continue
            ahorro_unitario = round(original['costo_unitario'] - sugerido['costo_unitario'], 2)
            ahorro_total_unitario += ahorro_unitario * original['cantidad']
            sustituciones.append({
                'insumo_original': original['insumo'],
                'insumo_sugerido': sugerido['nombre'],
                'costo_original': original['costo_unitario'],
                'costo_sugerido': sugerido['costo_unitario'],
                'ahorro_unitario': ahorro_unitario,
                'motivo': s.get('motivo', ''),
            })

        costo_actual = info_plato['costo_real']
        costo_proyectado = round(max(costo_actual - ahorro_total_unitario, 0.0), 2)
        ahorro_total = round(costo_actual - costo_proyectado, 2)
        ahorro_porcentaje = round((ahorro_total / costo_actual) * 100, 2) if costo_actual else 0.0

        margen_proyectado = None
        if info_plato['precio_venta']:
            margen_proyectado = round(
                ((info_plato['precio_venta'] - costo_proyectado) / info_plato['precio_venta']) * 100, 2
            )

        ip_cliente = obtener_ip_cliente(request)
        registrar_accion(
            usuario_id=str(request.user.id),
            usuario_email=request.user.email,
            accion='OPTIMIZAR_RECETA_IA',
            detalles={
                'ip': ip_cliente,
                'plato_id': plato_id,
                'sustituciones_sugeridas': len(sustituciones),
                'ahorro_total': ahorro_total,
            },
        )

        return Response({
            'plato': {'id': plato_id, 'nombre': info_plato['plato_nombre']},
            'costo_actual': costo_actual,
            'margen_actual': info_plato['margen'],
            'sustituciones': sustituciones,
            'costo_proyectado': costo_proyectado,
            'margen_proyectado': margen_proyectado,
            'ahorro_total': ahorro_total,
            'ahorro_porcentaje': ahorro_porcentaje,
            'resumen': resumen or 'Se encontraron oportunidades de ahorro en esta receta.',
        }, status=status.HTTP_200_OK)
