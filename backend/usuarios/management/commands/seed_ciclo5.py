# ============================================================
# ARCHIVO: backend/usuarios/management/commands/seed_ciclo5.py
# CICLO: 5
# FECHA: 04/07/26
#
# DESCRIPCIÓN:
#   Seeder de datos de DEMO para probar los CUs del Ciclo 5.
#   Es IDEMPOTENTE: se puede correr varias veces sin duplicar
#   (detecta lo ya sembrado por el prefijo "[SEED]").
#
#   Puebla lo necesario para demostrar:
#     - CU37 Órdenes de compra: insumos con stock <= stock_min +
#       2 proveedores (con email) y precios distintos por insumo.
#     - CU34 Caducidad (FEFO): lotes con detalle vencido / por
#       vencer / ok.
#     - CU33 Notificaciones: alertas_stock pendientes (leida=False).
#
#   USO:
#     python manage.py seed_ciclo5
#     python manage.py seed_ciclo5 --limpiar   (borra lo sembrado y sale)
#
#   Escribe en la MISMA Supabase que apunte el .env (cloud), así que
#   corriéndolo local con las credenciales de producción, puebla prod.
# ============================================================

from datetime import date, datetime, timedelta

from django.core.management.base import BaseCommand
from django.conf import settings
from supabase import create_client

PREFIJO = "[SEED]"

# Insumos de demo: (nombre, categoria, vencimiento_dias)
INSUMOS_SEED = [
    (f"{PREFIJO} Tomate", "Verdura", 5),
    (f"{PREFIJO} Leche",  "Lácteo",  3),
    (f"{PREFIJO} Harina", "Harinas", 90),
]

# Stock por insumo: (nombre_insumo, cantidad, stock_min, stock_max)
# Tomate y Leche quedan EN/BAJO el mínimo -> disparan CU37.
STOCK_SEED = {
    f"{PREFIJO} Tomate": (2, 10, 50),
    f"{PREFIJO} Leche":  (5, 8, 40),
    f"{PREFIJO} Harina": (100, 20, 200),
}

# Proveedores de demo (ambos con email para CU37 -> notificación)
PROVEEDORES_SEED = [
    (f"{PREFIJO} Proveedor Barato", "proveedor.barato@demo.com"),
    (f"{PREFIJO} Proveedor Caro",   "proveedor.caro@demo.com"),
]


class Command(BaseCommand):
    help = "Puebla datos de demo para los CUs del Ciclo 5 (idempotente)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--limpiar",
            action="store_true",
            help="Elimina los datos sembrados ([SEED]) y termina.",
        )

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
                # aseguramos los valores de demo (por si cambiaron)
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
        barato = proveedores[f"{PREFIJO} Proveedor Barato"]
        caro = proveedores[f"{PREFIJO} Proveedor Caro"]
        # (insumo, precio_barato, precio_caro)
        precios = [
            (f"{PREFIJO} Tomate", 5.0, 8.0),
            (f"{PREFIJO} Leche", 6.0, 9.5),
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
                self.sb.table("proveedor_insumo").insert({
                    "proveedor_id": prov_id, "insumo_id": insumo_id,
                    "precio": precio, "calificacion": "Buena",
                    "nota": f"{PREFIJO} demo",
                }).execute()
                self.stdout.write(self.style.SUCCESS(
                    f"  + proveedor_insumo: {nombre} @ {precio} Bs (prov {prov_id})"
                ))

    # ── Lotes + detalle (FEFO: vencido / por vencer / ok) ────
    def _seed_lotes(self, insumos, stocks, proveedores):
        # idempotencia: si ya hay algún lote de los proveedores sembrados, no repetir
        prov_ids = list(proveedores.values())
        ya = self.sb.table("lote").select("id").in_("proveedor_id", prov_ids).execute()
        if ya.data:
            self.stdout.write("  lotes de demo ya existen (skip)")
            return

        hoy = date.today()
        prov_barato = proveedores[f"{PREFIJO} Proveedor Barato"]
        # (insumo, dias_hasta_vencer)  -> vencido / por vencer / ok
        detalles = [
            (f"{PREFIJO} Tomate", -2),   # vencido
            (f"{PREFIJO} Leche",  3),    # por vencer (dentro de 7 días)
            (f"{PREFIJO} Harina", 60),   # ok
        ]
        lote = self.sb.table("lote").insert({
            "fecha_ing": hoy.isoformat(),
            "proveedor_id": prov_barato,
            "total_lote": 100.0,
        }).execute()
        lote_id = lote.data[0]["id"]

        for nombre, dias in detalles:
            fv = (hoy + timedelta(days=dias)).isoformat()
            self.sb.table("detalle_lote").insert({
                "lote_id": lote_id,
                "insumo_id": insumos[nombre],
                "stock_id": stocks[nombre],
                "cantidad": 10,
                "costo_unitario": 4.5,
                "fecha_vencimiento": fv,
            }).execute()
            self.stdout.write(self.style.SUCCESS(
                f"  + detalle_lote: {nombre} vence {fv}"
            ))

    # ── Alertas pendientes (CU33) ────────────────────────────
    def _seed_alertas(self, stocks):
        ya = self.sb.table("alertas_stock").select("id").like("mensaje", f"{PREFIJO}%").execute()
        if ya.data:
            self.stdout.write("  alertas de demo ya existen (skip)")
            return
        ahora = datetime.now().isoformat()
        alertas = [
            (stocks[f"{PREFIJO} Tomate"], f"{PREFIJO} Stock bajo de Tomate (2 <= 10)"),
            (stocks[f"{PREFIJO} Leche"],  f"{PREFIJO} Lote de Leche próximo a vencer"),
        ]
        for stock_id, mensaje in alertas:
            self.sb.table("alertas_stock").insert({
                "stock_id": stock_id, "fecha": ahora,
                "mensaje": mensaje, "leida": False,
            }).execute()
            self.stdout.write(self.style.SUCCESS(f"  + alerta: {mensaje}"))

    # ── Limpieza ─────────────────────────────────────────────
    def _limpiar(self):
        self.stdout.write(self.style.WARNING("Eliminando datos [SEED]..."))
        # alertas
        self.sb.table("alertas_stock").delete().like("mensaje", f"{PREFIJO}%").execute()
        # detalle_lote + lote de proveedores sembrados
        provs = self.sb.table("proveedor").select("id").like("nombre", f"{PREFIJO}%").execute()
        prov_ids = [p["id"] for p in (provs.data or [])]
        if prov_ids:
            lotes = self.sb.table("lote").select("id").in_("proveedor_id", prov_ids).execute()
            for l in (lotes.data or []):
                self.sb.table("detalle_lote").delete().eq("lote_id", l["id"]).execute()
            self.sb.table("lote").delete().in_("proveedor_id", prov_ids).execute()
        # proveedor_insumo + proveedores
        insumos = self.sb.table("insumo").select("id").like("nombre", f"{PREFIJO}%").execute()
        insumo_ids = [i["id"] for i in (insumos.data or [])]
        if insumo_ids:
            self.sb.table("proveedor_insumo").delete().in_("insumo_id", insumo_ids).execute()
            # stock + detalle sueltos
            self.sb.table("stock").delete().in_("insumo_id", insumo_ids).execute()
            self.sb.table("insumo").delete().in_("id", insumo_ids).execute()
        if prov_ids:
            self.sb.table("proveedor").delete().in_("id", prov_ids).execute()
        self.stdout.write(self.style.SUCCESS("✓ Datos [SEED] eliminados."))
