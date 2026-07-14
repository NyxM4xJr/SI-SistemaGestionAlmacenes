# ============================================================
# ARCHIVO: backend/usuarios/management/commands/seed_pronostico_demo.py
# CASO DE USO: CU44 - Pronóstico de Demanda
# CICLO: 6
#
# DESCRIPCIÓN:
#   Siembra movimientos de tipo 'salida' variados sobre 4 insumos, para
#   que el Pronóstico de Demanda muestre un análisis completo: 2 insumos
#   URGENTES (pocos días de cobertura → rojo), 1 medio y 1 cómodo.
#
#   OJO con los triggers de la BD: al insertar una 'salida' se descuenta
#   el stock automáticamente y se rechaza si no alcanza. Por eso el seeder
#   fija primero un stock alto de arranque (S0) y luego descuenta las
#   salidas, dejando un remanente controlado. La cobertura resultante es:
#       días_cobertura = 30 * (S0 - total_salidas) / total_salidas
#
#   Es idempotente: en cada corrida borra sus propias salidas anteriores
#   (marcadas con observacion='SEED_PRONOSTICO') y reinicia el stock a S0.
#
#   USO:
#     python manage.py seed_pronostico_demo
# ============================================================

from datetime import date, timedelta

from django.core.management.base import BaseCommand
from django.conf import settings
from supabase import create_client

MARCA = "SEED_PRONOSTICO"   # etiqueta para reconocer/limpiar sus movimientos
VENTANA = 30                # días (coincide con el default del reporte)

# Cada insumo: (nombre, categoria, venc_dias, stock_min, stock_max,
#               stock_inicial S0, [ (dias_atras, cantidad), ... ] )
# La suma de salidas < S0. El remanente (S0 - suma) define la cobertura.
INSUMOS = [
    # URGENTE: consumo 4/día, quedan ~18 → cobertura ~4.5 días (rojo)
    ("Pechuga de Pollo", "Carne", 5, 10, 200, 138,
     [(25, 40), (18, 30), (10, 30), (3, 20)]),                # total 120
    # URGENTE: consumo 3/día, quedan ~18 → cobertura ~6 días (rojo)
    ("Tomate Perita", "Verdura", 12, 10, 200, 108,
     [(22, 30), (12, 35), (4, 25)]),                          # total 90
    # MEDIO: consumo 2/día, quedan 40 → cobertura ~20 días
    ("Leche Entera 1L", "Lácteo", 20, 10, 200, 100,
     [(20, 25), (9, 20), (2, 15)]),                           # total 60
    # CÓMODO: consumo 1.5/día, quedan 90 → cobertura ~60 días
    ("Harina 0000 1kg", "Abarrote", 365, 10, 200, 135,
     [(26, 15), (15, 15), (5, 15)]),                          # total 45
]


class Command(BaseCommand):
    help = "Siembra salidas variadas sobre 4 insumos para la demo del Pronóstico de Demanda (CU44)."

    def handle(self, *args, **options):
        self.sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        self.stdout.write(self.style.MIGRATE_HEADING(
            "== Seeder demo: Pronóstico de Demanda (salidas variadas) =="
        ))

        usuario_id = self._usuario_demo()
        self._limpiar_salidas_previas()

        for nombre, cat, venc, smin, smax, s0, salidas in INSUMOS:
            insumo_id = self._insumo(nombre, cat, venc)
            stock_id = self._reset_stock(insumo_id, s0, smin, smax)
            self._sembrar_salidas(insumo_id, stock_id, usuario_id, salidas)
            self.stdout.write(self.style.SUCCESS(
                f"  + {nombre}: stock inicial {s0}, {len(salidas)} salidas"
            ))

        self._imprimir_resumen()

    # ── Usuario para usuario_id de los movimientos ───────────
    def _usuario_demo(self):
        # Prioriza un administrador; si no, cualquiera.
        admin = self.sb.table("usuario").select("id").eq("rol", "administrador").limit(1).execute()
        if admin.data:
            return admin.data[0]["id"]
        cualquiera = self.sb.table("usuario").select("id").limit(1).execute()
        if cualquiera.data:
            return cualquiera.data[0]["id"]
        raise RuntimeError("No hay usuarios en la tabla 'usuario' para asignar a los movimientos.")

    # ── Limpieza idempotente ─────────────────────────────────
    def _limpiar_salidas_previas(self):
        try:
            self.sb.table("movimiento_inventario").delete().eq("observacion", MARCA).execute()
            self.stdout.write("  limpieza: salidas de demo anteriores eliminadas.")
        except Exception as e:
            self.stdout.write(self.style.WARNING(f"  no se pudieron limpiar salidas previas: {e}"))

    # ── Insumo (idempotente por nombre) ──────────────────────
    def _insumo(self, nombre, categoria, venc):
        existe = self.sb.table("insumo").select("id").eq("nombre", nombre).execute()
        if existe.data:
            return existe.data[0]["id"]
        r = self.sb.table("insumo").insert({
            "nombre": nombre, "categoria": categoria, "origen": "Nacional",
            "conservado": "Ambiente", "vencimiento_dias": venc,
            "proteinas": 1.0, "calorias": 20.0, "grasas": 0.5,
            "calcio": 10.0, "hierro": 0.5,
        }).execute()
        return r.data[0]["id"]

    # ── Reinicia el stock a S0 (una sola ubicación por insumo) ─
    def _reset_stock(self, insumo_id, s0, smin, smax):
        st = self.sb.table("stock").select("id").eq("insumo_id", insumo_id).execute()
        payload = {"cantidad": s0, "stock_min": smin, "stock_max": smax}
        if st.data:
            stock_id = st.data[0]["id"]
            self.sb.table("stock").update(payload).eq("id", stock_id).execute()
        else:
            r = self.sb.table("stock").insert({"insumo_id": insumo_id, **payload}).execute()
            stock_id = r.data[0]["id"]
        return stock_id

    # ── Inserta las salidas (el trigger descuenta el stock) ──
    def _sembrar_salidas(self, insumo_id, stock_id, usuario_id, salidas):
        hoy = date.today()
        for dias_atras, cantidad in salidas:
            self.sb.table("movimiento_inventario").insert({
                "tipo": "salida",
                "insumo_id": insumo_id,
                "stock_id": stock_id,
                "cantidad": cantidad,
                "fecha_mov": (hoy - timedelta(days=dias_atras)).isoformat(),
                "usuario_id": usuario_id,
                "destino": "Producción",
                "observacion": MARCA,
            }).execute()

    # ── Resumen de lo que debería mostrar el pronóstico ──────
    def _imprimir_resumen(self):
        self.stdout.write(self.style.SUCCESS(
            "\n✓ Listo. Abrí: Reportes → Pronóstico de Demanda (ventana 30 días).\n"
        ))
        self.stdout.write("Deberías ver algo así:\n")
        self.stdout.write(f"  {'Insumo':<20}{'Consumo/día':>12}{'Stock':>8}{'Cobertura':>12}")
        for nombre, _c, _v, _min, _max, s0, salidas in INSUMOS:
            total = sum(c for _d, c in salidas)
            consumo = round(total / VENTANA, 2)
            final = s0 - total
            cobertura = round(VENTANA * final / total, 1) if total else 0
            flag = "  ← URGENTE" if cobertura < 7 else ""
            self.stdout.write(
                f"  {nombre:<20}{consumo:>12}{final:>8}{str(cobertura) + ' días':>12}{flag}"
            )
