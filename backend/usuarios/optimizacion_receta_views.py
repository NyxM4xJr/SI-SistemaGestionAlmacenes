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

# Solo se consideran ahorros que reduzcan el costo del insumo al menos este %.
# Evita mostrar sugerencias triviales (ej. 0.20 ctvs sobre un insumo de 5 Bs).
AHORRO_MIN_PORCENTAJE = 5.0

SYSTEM_PROMPT_OPTIMIZACION = (
    "Sos un chef asistente experto en costos de un restaurante. Te paso, en "
    "JSON, ingredientes de una receta con su costo unitario actual y una lista "
    "de insumos alternativos de la misma categoría más baratos (ya filtrados "
    "por ahorro relevante). Elegí SOLO las sustituciones que tengan sentido "
    "culinario (mismo tipo de ingrediente, no cambies el perfil del plato). No "
    "inventes insumos que no estén en la lista de alternativas. Si ninguna "
    "sustitución tiene sentido culinario, devolvé una lista vacía.\n\n"
    "Respondé EXCLUSIVAMENTE con JSON válido, sin texto antes ni después, con "
    "esta forma exacta:\n"
    '{"sustituciones": [{"insumo_original": str, "insumo_sugerido": str, '
    '"motivo": str}]}'
)


def _sb():
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)


def _costo_vigente_por_insumo(supabase, insumo_ids):
    """
    insumo_id -> costo unitario del lote más reciente (misma lógica que CU27).
    Es lo que la cocina realmente paga hoy por el insumo.
    """
    if not insumo_ids:
        return {}
    detalle_lotes = supabase.table('detalle_lote') \
        .select('insumo_id, costo_unitario, lote:lote_id(created_at)') \
        .in_('insumo_id', insumo_ids) \
        .execute().data or []

    mas_reciente_por_insumo = {}
    costo_por_insumo = {}
    for dl in detalle_lotes:
        iid = dl['insumo_id']
        created_at = (dl.get('lote') or {}).get('created_at')
        if not created_at:
            continue
        if iid not in mas_reciente_por_insumo or created_at > mas_reciente_por_insumo[iid]:
            mas_reciente_por_insumo[iid] = created_at
            costo_por_insumo[iid] = float(dl['costo_unitario'])
    return costo_por_insumo


def _mejor_proveedor_por_insumo(supabase, insumo_ids):
    """insumo_id -> {precio, proveedor_id, proveedor_nombre} del proveedor más barato."""
    if not insumo_ids:
        return {}
    filas = supabase.table('proveedor_insumo').select(
        'insumo_id, precio, proveedor_id, proveedor:proveedor_id(nombre)'
    ).in_('insumo_id', insumo_ids).execute().data or []

    mejor = {}
    for f in filas:
        iid = f['insumo_id']
        precio = float(f.get('precio') or 0)
        if precio <= 0:
            continue
        if iid not in mejor or precio < mejor[iid]['precio']:
            mejor[iid] = {
                'precio': precio,
                'proveedor_id': f.get('proveedor_id'),
                'proveedor_nombre': (f.get('proveedor') or {}).get('nombre'),
            }
    return mejor


def _merma_por_insumo(supabase, insumo_ids):
    """insumo_id -> porcentaje de merma (ficha_tecnica, CU22)."""
    if not insumo_ids:
        return {}
    fichas = supabase.table('ficha_tecnica').select(
        'insumo_id, porcentaje_merma'
    ).in_('insumo_id', insumo_ids).execute().data or []
    return {
        f['insumo_id']: float(f['porcentaje_merma'])
        for f in fichas if f.get('porcentaje_merma') is not None
    }


def _alternativas_por_categoria(supabase, insumo_ids_excluir, categorias):
    """
    Por categoría, insumos del catálogo (excluyendo los de la receta) con su
    precio más barato de proveedor.
    """
    if not categorias:
        return {}

    catalogo = supabase.table('insumo').select(
        'id, nombre, categoria'
    ).in_('categoria', list(categorias)).execute().data or []
    catalogo = [c for c in catalogo if c['id'] not in insumo_ids_excluir]

    mejor = _mejor_proveedor_por_insumo(supabase, [c['id'] for c in catalogo])

    por_categoria = {}
    for c in catalogo:
        info = mejor.get(c['id'])
        if not info:
            continue
        por_categoria.setdefault(c['categoria'], []).append({
            'insumo_id': c['id'],
            'nombre': c['nombre'],
            'costo_unitario': info['precio'],
            'proveedor_nombre': info['proveedor_nombre'],
        })
    return por_categoria


def _ahorro_significativo(costo_actual, costo_nuevo):
    """True si el ahorro relativo supera el umbral mínimo."""
    if costo_actual <= 0 or costo_nuevo >= costo_actual:
        return False
    return ((costo_actual - costo_nuevo) / costo_actual) * 100 >= AHORRO_MIN_PORCENTAJE


class OptimizarRecetaIAView(APIView):
    """GET /api/recetas-ia/optimizar/?plato_id=N — sugiere cambio de proveedor o sustitución de insumo para abaratar una receta."""
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
            logger.error(f"Error calculando costo base para optimización: {str(e)}")
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
            logger.error(f"Error obteniendo ingredientes de receta: {str(e)}")
            return Response(
                {'error': 'Error al obtener los ingredientes de la receta.', 'detalle': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        insumo_ids = [d['insumo_id'] for d in detalles]
        costo_vigente = _costo_vigente_por_insumo(supabase, insumo_ids)
        mejor_proveedor = _mejor_proveedor_por_insumo(supabase, insumo_ids)
        merma = _merma_por_insumo(supabase, insumo_ids)
        categorias = {(d.get('insumo') or {}).get('categoria') for d in detalles if (d.get('insumo') or {}).get('categoria')}
        alternativas = _alternativas_por_categoria(supabase, set(insumo_ids), categorias)

        ingredientes = {}
        for d in detalles:
            iid = d['insumo_id']
            info = d.get('insumo') or {}
            ingredientes[iid] = {
                'insumo_id': iid,
                'insumo': info.get('nombre', f'Insumo #{iid}'),
                'categoria': info.get('categoria'),
                'cantidad': float(d.get('cantidad') or 0),
                'costo_actual': costo_vigente.get(iid, 0.0),
                'merma': merma.get(iid, 0.0),
            }

        # ── Palanca A: cambiar de proveedor (mismo insumo, más barato) ──
        sustituciones = []
        for ing in ingredientes.values():
            prov = mejor_proveedor.get(ing['insumo_id'])
            if not prov or ing['costo_actual'] <= 0:
                continue
            if _ahorro_significativo(ing['costo_actual'], prov['precio']):
                sustituciones.append(self._armar_sustitucion(
                    tipo='proveedor',
                    ing=ing,
                    nombre_sugerido=ing['insumo'],
                    costo_sugerido=prov['precio'],
                    proveedor_sugerido=prov['proveedor_nombre'],
                    motivo=f"El proveedor {prov['proveedor_nombre'] or 'alternativo'} "
                           f"ofrece este insumo más barato que el costo actual.",
                ))

        # ── Palanca B: sustituir insumo (misma categoría, más barato, validado por IA) ──
        candidatos_ia = []
        for ing in ingredientes.values():
            if ing['costo_actual'] <= 0:
                continue
            opciones = [
                a for a in alternativas.get(ing['categoria'], [])
                if _ahorro_significativo(ing['costo_actual'], a['costo_unitario'])
            ]
            if opciones:
                candidatos_ia.append({
                    'insumo_original': ing['insumo'],
                    'costo_unitario_original': ing['costo_actual'],
                    'categoria': ing['categoria'],
                    'alternativas': sorted(opciones, key=lambda x: x['costo_unitario'])[:5],
                })

        if candidatos_ia:
            sugeridas = self._sustituciones_ia(candidatos_ia)
            nombre_a_ing = {i['insumo']: i for i in ingredientes.values()}
            alt_por_nombre = {a['nombre']: a for lista in alternativas.values() for a in lista}
            for s in sugeridas:
                original = nombre_a_ing.get(s.get('insumo_original'))
                sugerido = alt_por_nombre.get(s.get('insumo_sugerido'))
                if not original or not sugerido:
                    continue
                if not _ahorro_significativo(original['costo_actual'], sugerido['costo_unitario']):
                    continue
                sustituciones.append(self._armar_sustitucion(
                    tipo='insumo',
                    ing=original,
                    nombre_sugerido=sugerido['nombre'],
                    costo_sugerido=sugerido['costo_unitario'],
                    proveedor_sugerido=sugerido.get('proveedor_nombre'),
                    motivo=s.get('motivo', ''),
                ))

        # Ranking por impacto real en el plato (no por el ahorro por unidad).
        sustituciones.sort(key=lambda x: x['ahorro_plato'], reverse=True)

        costo_actual = info_plato['costo_real']
        ahorro_total = round(sum(s['ahorro_plato'] for s in sustituciones), 2)
        costo_proyectado = round(max(costo_actual - ahorro_total, 0.0), 2)
        ahorro_porcentaje = round((ahorro_total / costo_actual) * 100, 2) if costo_actual else 0.0

        margen_proyectado = None
        if info_plato['precio_venta']:
            margen_proyectado = round(
                ((info_plato['precio_venta'] - costo_proyectado) / info_plato['precio_venta']) * 100, 2
            )

        if sustituciones:
            resumen = (f"Se identificaron {len(sustituciones)} oportunidad(es) de ahorro "
                       f"por un total de {ahorro_total} Bs por porción "
                       f"({ahorro_porcentaje}% del costo).")
        else:
            resumen = ("Ya estás comprando estos insumos al mejor precio disponible: "
                       "no se encontraron ahorros significativos.")

        ip_cliente = obtener_ip_cliente(request)
        registrar_accion(
            usuario_id=str(request.user.id),
            usuario_email=request.user.email,
            accion='OPTIMIZAR_RECETA_IA',
            detalles={
                'ip': ip_cliente,
                'plato_id': plato_id,
                'sustituciones_proveedor': sum(1 for s in sustituciones if s['tipo'] == 'proveedor'),
                'sustituciones_insumo': sum(1 for s in sustituciones if s['tipo'] == 'insumo'),
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
            'resumen': resumen,
        }, status=status.HTTP_200_OK)

    def _armar_sustitucion(self, tipo, ing, nombre_sugerido, costo_sugerido,
                           proveedor_sugerido, motivo):
        """Construye una sustitución con su impacto en el plato (aplica merma, como CU27)."""
        ahorro_unitario = round(ing['costo_actual'] - costo_sugerido, 2)
        factor_merma = 1 + ing['merma'] / 100
        ahorro_plato = round(ahorro_unitario * ing['cantidad'] * factor_merma, 2)
        return {
            'tipo': tipo,
            'insumo_original': ing['insumo'],
            'insumo_sugerido': nombre_sugerido,
            'proveedor_sugerido': proveedor_sugerido,
            'costo_original': round(ing['costo_actual'], 2),
            'costo_sugerido': round(costo_sugerido, 2),
            'ahorro_unitario': ahorro_unitario,
            'ahorro_plato': ahorro_plato,
            'motivo': motivo,
        }

    def _sustituciones_ia(self, candidatos_ia):
        """Llama a la IA para validar sustituciones de insumo. Si falla, no corta el flujo."""
        try:
            resultado = generar_json_ia(
                SYSTEM_PROMPT_OPTIMIZACION,
                f"Ingredientes con alternativas más baratas:\n{candidatos_ia}",
                max_tokens=800,
            )
        except IANoDisponibleError as e:
            logger.warning(f"IA no disponible para sustituciones de insumo: {str(e)}")
            return []
        return resultado.get('sustituciones', []) if isinstance(resultado, dict) else []
