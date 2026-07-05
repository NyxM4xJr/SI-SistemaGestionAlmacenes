# ============================================================
# ARCHIVO: backend/usuarios/management/commands/seed_ciclo5.py
# CICLO: 5
# FECHA: 04/07/26
#
# DESCRIPCIÓN:
#   Seeder de datos de DEMO para probar los CUs del Ciclo 5.
#   Es IDEMPOTENTE: se puede correr varias veces sin duplicar
#   (reutiliza las filas existentes por nombre).
#
#   Arma una situación de negocio coherente:
#     - CU37 Órdenes de compra: insumos con stock <= stock_min +
#       2 proveedores (con email) y precios distintos por insumo,
#       para que el sistema elija el más barato y notifique.
#     - CU34 Caducidad (FEFO): lotes con detalle vencido / por
#       vencer / ok.
#     - CU33 Notificaciones: alertas_stock pendientes (leida=False).
#
#   USO:
#     python manage.py seed_ciclo5
#     python manage.py seed_ciclo5 --limpiar   (borra lo sembrado y sale)
#
#   Escribe en la MISMA Supabase que apunte el .env (cloud). Los datos
#   quedan guardados en la base: se corre UNA sola vez, no en cada deploy.
# ============================================================

from datetime import date, datetime, timedelta

from django.core.management.base import BaseCommand
from django.conf import settings
from supabase import create_client

# Insumos de demo: (nombre, categoria, vencimiento_dias)
INSUMOS_SEED = [
    ("Tomate Perita", "Verdura", 5),
    ("Leche Entera",  "Lácteo",  3),
    ("Harina 0000",   "Harinas", 90),
]

# Stock por insumo: (nombre_insumo, cantidad, stock_min, stock_max)
# Tomate y Leche quedan EN/BAJO el mínimo -> disparan CU37.
STOCK_SEED = {
    "Tomate Perita": (2, 10, 50),
    "Leche Entera":  (5, 8, 40),
    "Harina 0000":   (100, 20, 200),
}

# Proveedores de demo (ambos con email para CU37 -> notificación)
PROVEEDORES_SEED = [
    ("Distribuidora Andina", "distribuidora.andina@demo.com"),
    ("Mercado Central",      "mercado.central@demo.com"),
]

NOMBRES_INSUMOS = [n for n, _, _ in INSUMOS_SEED]
NOMBRES_PROVEEDORES = [n for n, _ in PROVEEDORES_SEED]


class Command(BaseCommand):
    help = "Puebla datos de demo para los CUs del Ciclo 5 (idempotente)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--limpiar",
            action="store_true",
            help="Elimina los datos de demo sembrados y termina.",
        )

    def _insert_id(self, tabla, payload):
        """
        Inserta en una tabla cuyo 'id' NO se autogenera en esta instancia
        de Supabase (proveedor_insumo, lote, detalle_lote, alertas_stock).
        Calcula el próximo id como max(id)+1.
        """
        r = self.sb.table(tabla).select("id").order("id", desc=True).limit(1).execute()
        siguiente = (r.data[0]["id"] + 1) if r.data else 1
        return self.sb.table(tabla).insert({**payload, "id": siguiente}).execute()

    def handle(self, *args, **options):
        self.sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

        if options["limpiar"]:
            self._limpiar()
            return

        self.stdout.write(self.style.MIGRATE_HEADING("== Seeder Ciclo 5 =="))

        insumos = self._seed_insumos()
        stocks = self._seed_stock(insumos)
        proveedores = self._seed_proveedores()
        self._seed_proveedor_insumo(insumos, proveedores)
        self._seed_lotes(insumos, stocks, proveedores)
        self._seed_alertas(stocks)

        self.stdout.write(self.style.SUCCESS("\n✓ Seeder completado."))
        self.stdout.write(
            "Probá: Órdenes de Compra → Generar automáticas, "
            "Caducidad (FEFO) y Alertas → Revisar y notificar."
        )

    # ── Insumos ──────────────────────────────────────────────
    def _seed_insumos(self):
        resultado = {}
        for nombre, categoria, venc in INSUMOS_SEED:
            existe = self.sb.table("insumo").select("id").eq("nombre", nombre).execute()
            if existe.data:
                resultado[nombre] = existe.data[0]["id"]
                self.stdout.write(f"  insumo ya existe: {nombre}")
                continue
            payload = {
                "nombre": nombre,
                "categoria": categoria,
                "origen": "Nacional",
                "conservado": "Refrigerado",
                "vencimiento_dias": venc,
                "proteinas": 1.0, "calorias": 20.0, "grasas": 0.5,
                "calcio": 10.0, "hierro": 0.5,
            }
            r = self.sb.table("insumo").insert(payload).execute()
            resultado[nombre] = r.data[0]["id"]
            self.stdout.write(self.style.SUCCESS(f"  + insumo: {nombre}"))
        return resultado

    # ── Stock ────────────────────────────────────────────────
    def _seed_stock(self, insumos):
        resultado = {}
        for nombre, (cant, smin, smax) in STOCK_SEED.items():
            insumo_id = insumos[nombre]
            existe = self.sb.table("stock").select("id").eq("insumo_id", insumo_id).execute()
            if existe.data:
                stock_id = existe.data[0]["id"]
                self.sb.table("stock").update(
                    {"cantidad": cant, "stock_min": smin, "stock_max": smax}
                ).eq("id", stock_id).execute()
                resultado[nombre] = stock_id
                self.stdout.write(f"  stock actualizado: {nombre} (cant={cant}, min={smin})")
                continue
            r = self.sb.table("stock").insert({
                "insumo_id": insumo_id, "cantidad": cant,
                "stock_min": smin, "stock_max": smax,
            }).execute()
            resultado[nombre] = r.data[0]["id"]
            self.stdout.write(self.style.SUCCESS(f"  + stock: {nombre} (cant={cant}, min={smin})"))
        return resultado

    # ── Proveedores ──────────────────────────────────────────
    def _seed_proveedores(self):
        resultado = {}
        for nombre, email in PROVEEDORES_SEED:
            existe = self.sb.table("proveedor").select("id").eq("nombre", nombre).execute()
            if existe.data:
                resultado[nombre] = existe.data[0]["id"]
                self.stdout.write(f"  proveedor ya existe: {nombre}")
                continue
            r = self.sb.table("proveedor").insert({
                "nombre": nombre, "contacto": "70000000",
                "email": email, "ubicacion": "Santa Cruz",
                "tipo_pago": "Contado",
            }).execute()
            resultado[nombre] = r.data[0]["id"]
            self.stdout.write(self.style.SUCCESS(f"  + proveedor: {nombre} <{email}>"))
        return resultado

    # ── proveedor_insumo (precios distintos → CU37 elige el más barato) ──
    def _seed_proveedor_insumo(self, insumos, proveedores):
        barato = proveedores["Distribuidora Andina"]
        caro = proveedores["Mercado Central"]
        # (insumo, precio_barato, precio_caro)
        precios = [
            ("Tomate Perita", 5.0, 8.0),
            ("Leche Entera", 6.0, 9.5),
        ]
        for nombre, p_barato, p_caro in precios:
            insumo_id = insumos[nombre]
            for prov_id, precio in [(barato, p_barato), (caro, p_caro)]:
                existe = (
                    self.sb.table("proveedor_insumo")
                    .select("id").eq("proveedor_id", prov_id).eq("insumo_id", insumo_id)
                    .execute()
                )
                if existe.data:
                    continue
                self._insert_id("proveedor_insumo", {
                    "proveedor_id": prov_id, "insumo_id": insumo_id,
                    "precio": precio, "calificacion": "Buena",
                    "nota": "Precio de demostración",
                })
                self.stdout.write(self.style.SUCCESS(
                    f"  + proveedor_insumo: {nombre} @ {precio} Bs (prov {prov_id})"
                ))

    # ── Lotes + detalle (FEFO: vencido / por vencer / ok) ────
    def _seed_lotes(self, insumos, stocks, proveedores):
        # idempotencia por INSUMO sembrado (no por proveedor, que puede ser
        # preexistente y tener lotes reales del usuario).
        insumo_ids = list(insumos.values())
        ya = self.sb.table("detalle_lote").select("id").in_("insumo_id", insumo_ids).execute()
        if ya.data:
            self.stdout.write("  lotes de demo ya existen (skip)")
            return

        hoy = date.today()
        prov_barato = proveedores["Distribuidora Andina"]
        # (insumo, dias_hasta_vencer)  -> vencido / por vencer / ok
        detalles = [
            ("Tomate Perita", -2),   # vencido
            ("Leche Entera",  3),    # por vencer (dentro de 7 días)
            ("Harina 0000",   60),   # ok
        ]
        lote = self._insert_id("lote", {
            "fecha_ing": hoy.isoformat(),
            "proveedor_id": prov_barato,
            "total_lote": 100.0,
        })
        lote_id = lote.data[0]["id"]

        for nombre, dias in detalles:
            fv = (hoy + timedelta(days=dias)).isoformat()
            self._insert_id("detalle_lote", {
                "lote_id": lote_id,
                "insumo_id": insumos[nombre],
                "stock_id": stocks[nombre],
                "cantidad": 10,
                "costo_unitario": 4.5,
                "fecha_vencimiento": fv,
            })
            self.stdout.write(self.style.SUCCESS(
                f"  + detalle_lote: {nombre} vence {fv}"
            ))

    # ── Alertas pendientes (CU33) ────────────────────────────
    def _seed_alertas(self, stocks):
        stock_tomate = stocks["Tomate Perita"]
        stock_leche = stocks["Leche Entera"]
        # idempotencia: si ya hay alertas para estos stocks, no repetir
        ya = (
            self.sb.table("alertas_stock").select("id")
            .in_("stock_id", [stock_tomate, stock_leche]).execute()
        )
        if ya.data:
            self.stdout.write("  alertas de demo ya existen (skip)")
            return
        ahora = datetime.now().isoformat()
        alertas = [
            (stock_tomate, "Stock bajo: Tomate Perita (2 de mínimo 10)"),
            (stock_leche,  "Lote de Leche Entera próximo a vencer"),
        ]
        for stock_id, mensaje in alertas:
            self._insert_id("alertas_stock", {
                "stock_id": stock_id, "fecha": ahora,
                "mensaje": mensaje, "leida": False,
            })
            self.stdout.write(self.style.SUCCESS(f"  + alerta: {mensaje}"))

    # ── Limpieza ─────────────────────────────────────────────
    def _limpiar(self):
        self.stdout.write(self.style.WARNING("Eliminando datos de demo..."))
        # insumos y proveedores sembrados
        insumos = self.sb.table("insumo").select("id").in_("nombre", NOMBRES_INSUMOS).execute()
        insumo_ids = [i["id"] for i in (insumos.data or [])]
        provs = self.sb.table("proveedor").select("id").in_("nombre", NOMBRES_PROVEEDORES).execute()
        prov_ids = [p["id"] for p in (provs.data or [])]

        # stocks de esos insumos (para borrar sus alertas)
        stock_ids = []
        if insumo_ids:
            stocks = self.sb.table("stock").select("id").in_("insumo_id", insumo_ids).execute()
            stock_ids = [s["id"] for s in (stocks.data or [])]

        # alertas de esos stocks
        if stock_ids:
            self.sb.table("alertas_stock").delete().in_("stock_id", stock_ids).execute()
        # detalle_lote + lote que CONTIENEN insumos sembrados (identifica el
        # lote de demo por su contenido, sin tocar otros lotes del proveedor)
        if insumo_ids:
            detalles = self.sb.table("detalle_lote").select("id, lote_id").in_("insumo_id", insumo_ids).execute()
            lote_ids = list({d["lote_id"] for d in (detalles.data or [])})
            for lid in lote_ids:
                self.sb.table("detalle_lote").delete().eq("lote_id", lid).execute()
                self.sb.table("lote").delete().eq("id", lid).execute()
        # proveedor_insumo + stock + insumos
        if insumo_ids:
            self.sb.table("proveedor_insumo").delete().in_("insumo_id", insumo_ids).execute()
            self.sb.table("stock").delete().in_("insumo_id", insumo_ids).execute()
            self.sb.table("insumo").delete().in_("id", insumo_ids).execute()
        if prov_ids:
            self.sb.table("proveedor").delete().in_("id", prov_ids).execute()
        self.stdout.write(self.style.SUCCESS("✓ Datos de demo eliminados."))
