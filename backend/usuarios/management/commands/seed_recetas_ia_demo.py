# ============================================================
# ARCHIVO: backend/usuarios/management/commands/seed_recetas_ia_demo.py
# CASO DE USO: CU38 - Generación de Recetas con IA
# CICLO: 5
#
# DESCRIPCIÓN:
#   Seeder de demo para tener MÁS variedad de insumos candidatos al
#   generar sugerencias con IA (CU38), además de los que ya deja
#   seed_ciclo5 (Tomate/Leche). Agrega 2 insumos de categorías
#   distintas, cada uno con:
#     - Un lote/detalle_lote con fecha_vencimiento próxima (ventana
#       de 7 días que usa CU38).
#     - Un porcentaje de merma técnica en FICHA_TECNICA (CU22), para
#       que la IA también razone sobre merma, no solo días restantes.
#
#   Es idempotente (se puede correr de nuevo sin duplicar).
#
#   USO:
#     python manage.py seed_recetas_ia_demo
# ============================================================

from datetime import date, timedelta

from django.core.management.base import BaseCommand
from django.conf import settings
from supabase import create_client

# (nombre, categoria, vencimiento_dias, dias_hasta_vencer_lote, porcentaje_merma)
INSUMOS_SEED = [
    ("Zanahoria",    "Verdura", 10, 3,  12.0),
    ("Pollo Entero", "Carne",    6, 5,  8.0),
]

CANTIDAD_STOCK = 15
CANTIDAD_LOTE = 10
COSTO_UNITARIO_DEMO = 6.0


class Command(BaseCommand):
    help = "Agrega insumos de demo con vencimiento próximo y merma técnica, para probar CU38 con más variedad."

    def _insert(self, tabla, payload):
        """Mismo helper que seed_ciclo5: inserta sin 'id' y, si la tabla
        lo exige (not-null sin default), lo calcula a mano como max(id)+1."""
        try:
            return self.sb.table(tabla).insert(payload).execute()
        except Exception as e:
            msg = str(e)
            if '23502' in msg or 'null value in column "id"' in msg:
                r = self.sb.table(tabla).select("id").order("id", desc=True).limit(1).execute()
                siguiente = (r.data[0]["id"] + 1) if r.data else 1
                return self.sb.table(tabla).insert({**payload, "id": siguiente}).execute()
            raise

    def handle(self, *args, **options):
        self.sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        self.stdout.write(self.style.MIGRATE_HEADING("== Seeder de demo: variedad para Recetas IA (CU38) =="))

        hoy = date.today()

        for nombre, categoria, venc_dias, dias_vencer_lote, merma in INSUMOS_SEED:
            insumo_id = self._seed_insumo(nombre, categoria, venc_dias)
            stock_id = self._seed_stock(nombre, insumo_id)
            self._seed_lote(nombre, insumo_id, stock_id, hoy + timedelta(days=dias_vencer_lote))
            self._seed_merma(nombre, insumo_id, merma)

        self.stdout.write(self.style.SUCCESS(
            "\n✓ Listo. Probá: Menús y Recetas → Recetas Sugeridas por IA → Generar de nuevo."
        ))

    def _seed_insumo(self, nombre, categoria, venc_dias):
        existe = self.sb.table("insumo").select("id").eq("nombre", nombre).execute()
        if existe.data:
            self.stdout.write(f"  insumo ya existe: {nombre}")
            return existe.data[0]["id"]

        r = self.sb.table("insumo").insert({
            "nombre": nombre, "categoria": categoria,
            "origen": "Nacional", "conservado": "Refrigerado",
            "vencimiento_dias": venc_dias,
            "proteinas": 1.0, "calorias": 20.0, "grasas": 0.5,
            "calcio": 10.0, "hierro": 0.5,
        }).execute()
        self.stdout.write(self.style.SUCCESS(f"  + insumo: {nombre}"))
        return r.data[0]["id"]

    def _seed_stock(self, nombre, insumo_id):
        existe = self.sb.table("stock").select("id, cantidad").eq("insumo_id", insumo_id).execute()
        if existe.data:
            stock_id = existe.data[0]["id"]
            if float(existe.data[0]["cantidad"]) <= 0:
                self.sb.table("stock").update({"cantidad": CANTIDAD_STOCK}).eq("id", stock_id).execute()
                self.stdout.write(f"  stock reactivado: {nombre} (cant={CANTIDAD_STOCK})")
            else:
                self.stdout.write(f"  stock ya existe: {nombre}")
            return stock_id

        r = self.sb.table("stock").insert({
            "insumo_id": insumo_id, "cantidad": CANTIDAD_STOCK,
            "stock_min": 5, "stock_max": 30,
        }).execute()
        self.stdout.write(self.style.SUCCESS(f"  + stock: {nombre} (cant={CANTIDAD_STOCK})"))
        return r.data[0]["id"]

    def _seed_lote(self, nombre, insumo_id, stock_id, fecha_vencimiento):
        # Idempotencia: si ya hay un detalle_lote de este insumo venciendo
        # en los próximos 7 días, no se crea otro (evita duplicar candidatos
        # en cada corrida del seeder).
        hoy = date.today()
        ya = (
            self.sb.table("detalle_lote").select("id")
            .eq("insumo_id", insumo_id)
            .gte("fecha_vencimiento", hoy.isoformat())
            .lte("fecha_vencimiento", (hoy + timedelta(days=7)).isoformat())
            .execute()
        )
        if ya.data:
            self.stdout.write(f"  lote por vencer ya existe: {nombre}")
            return

        lote = self._insert("lote", {
            "fecha_ing": hoy.isoformat(),
            "proveedor_id": self._algun_proveedor_id(),
            "total_lote": CANTIDAD_LOTE * COSTO_UNITARIO_DEMO,
        })
        lote_id = lote.data[0]["id"]

        self._insert("detalle_lote", {
            "lote_id": lote_id,
            "insumo_id": insumo_id,
            "stock_id": stock_id,
            "cantidad": CANTIDAD_LOTE,
            "costo_unitario": COSTO_UNITARIO_DEMO,
            "fecha_vencimiento": fecha_vencimiento.isoformat(),
        })
        self.stdout.write(self.style.SUCCESS(
            f"  + detalle_lote: {nombre} vence {fecha_vencimiento.isoformat()}"
        ))

    def _algun_proveedor_id(self):
        """
        'lote' exige proveedor_id NOT NULL. Reutiliza cualquier proveedor
        ya existente (ideal: 'Distribuidora Andina' de seed_ciclo5) en vez
        de crear uno nuevo solo para satisfacer la FK.
        """
        if getattr(self, "_proveedor_id_cache", None):
            return self._proveedor_id_cache

        preferido = self.sb.table("proveedor").select("id").eq(
            "nombre", "Distribuidora Andina"
        ).execute()
        if preferido.data:
            self._proveedor_id_cache = preferido.data[0]["id"]
            return self._proveedor_id_cache

        cualquiera = self.sb.table("proveedor").select("id").limit(1).execute()
        if not cualquiera.data:
            raise RuntimeError(
                "No hay ningún proveedor registrado. Corré primero: "
                "python manage.py seed_ciclo5"
            )
        self._proveedor_id_cache = cualquiera.data[0]["id"]
        return self._proveedor_id_cache

    def _seed_merma(self, nombre, insumo_id, porcentaje_merma):
        existe = self.sb.table("ficha_tecnica").select("id").eq("insumo_id", insumo_id).execute()
        if existe.data:
            self.sb.table("ficha_tecnica").update(
                {"porcentaje_merma": porcentaje_merma}
            ).eq("insumo_id", insumo_id).execute()
            self.stdout.write(f"  merma actualizada: {nombre} ({porcentaje_merma}%)")
            return

        self._insert("ficha_tecnica", {
            "insumo_id": insumo_id,
            "porcentaje_merma": porcentaje_merma,
        })
        self.stdout.write(self.style.SUCCESS(f"  + ficha_tecnica: {nombre} ({porcentaje_merma}% merma)"))
