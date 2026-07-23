# ============================================================
# ARCHIVO: backend/usuarios/management/commands/seed_facturas_demo.py
# CASO DE USO: CU36 - Órdenes de Compra Automáticas (+ conciliación facturas)
# CICLO: 5
#
# DESCRIPCIÓN:
#   Siembra los datos para que "Generar automáticas" produzca EXACTAMENTE
#   tres órdenes de compra que coinciden 1:1 con las tres facturas de demo:
#
#     Factura F-000501 -> Distribuidora del Sur   (total 1549.00 Bs)
#     Factura 26       -> Almacén del Norte        (total  489.00 Bs)
#     Factura F-000502 -> Comercial Andina         (total 1135.00 Bs)
#
#   El generador de órdenes calcula:
#       cantidad_a_pedir = stock_max - cantidad_actual   (si stock_max > actual)
#       precio           = proveedor_insumo.precio (proveedor más barato)
#   Por eso, por cada insumo se siembra:
#       cantidad_actual = stock_min           -> queda EN el mínimo (dispara CU36)
#       stock_max       = stock_min + qty     -> cantidad_a_pedir = qty de la factura
#       proveedor_insumo.precio = precio unit. de la factura (único proveedor)
#
#   Además sube por encima del mínimo los otros insumos demo
#   (Tomate/Leche/Arroz/Queso) para que NO generen órdenes extra y salgan
#   solo las tres esperadas.
#
#   Es IDEMPOTENTE (se puede correr de nuevo sin duplicar).
#
#   USO:
#     python manage.py seed_facturas_demo
#     python manage.py seed_facturas_demo --limpiar   (borra lo sembrado y sale)
# ============================================================

from datetime import datetime

from django.core.management.base import BaseCommand
from django.conf import settings
from supabase import create_client

# Correo real de la cuenta: Resend sin dominio verificado solo entrega al
# dueño de la cuenta, por eso todos los proveedores demo usan este correo.
EMAIL_DEMO = "adalidgragedrojas@gmail.com"

# Base para el stock: cantidad_actual = stock_min (queda EN el mínimo).
STOCK_MIN_BASE = 10

# Definición de las tres facturas.
# proveedor -> lista de (insumo, categoria, cantidad_factura, precio_unitario)
FACTURAS = {
    "Distribuidora del Sur": {
        "numero": "F-000501",
        "items": [
            ("Lomo de Res",     "Carne",   20, 55.00),
            ("Papa Blanca",     "Verdura", 50,  4.20),
            ("Cebolla Morada",  "Verdura", 30,  3.80),
            ("Zanahoria",       "Verdura", 25,  5.00),
        ],
    },
    "Almacén del Norte": {
        "numero": "26",
        "items": [
            ("Fideo Spaghetti 500g", "Abarrote", 30, 5.50),
            ("Atún en Lata 170g",    "Abarrote", 36, 9.00),
        ],
    },
    "Comercial Andina": {
        "numero": "F-000502",
        "items": [
            ("Aceite Vegetal 5L", "Abarrote", 15, 42.00),
            ("Sal Fina 1kg",      "Abarrote", 40,  6.50),
            ("Azúcar Blanca 1kg", "Abarrote", 35,  7.00),
        ],
    },
}

# Otros insumos demo que hay que subir por encima del mínimo para que NO
# generen órdenes y solo salgan las tres facturas.
INSUMOS_A_REABASTECER = ["Tomate Perita", "Leche Entera", "Arroz Blanco", "Queso Mozzarella"]

# Todos los nombres sembrados aquí (para --limpiar)
NOMBRES_INSUMOS = [
    nombre
    for f in FACTURAS.values()
    for (nombre, _cat, _qty, _precio) in f["items"]
]
NOMBRES_PROVEEDORES = list(FACTURAS.keys())


class Command(BaseCommand):
    help = "Siembra 9 insumos + 3 proveedores para que 'Generar automáticas' calque las 3 facturas de demo (CU36)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--limpiar",
            action="store_true",
            help="Elimina los datos de demo sembrados y termina.",
        )

    def handle(self, *args, **options):
        self.sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

        if options["limpiar"]:
            self._limpiar()
            return

        self.stdout.write(self.style.MIGRATE_HEADING("== Seeder facturas demo (CU36) =="))

        self._reabastecer_otros()
        for nombre_prov, factura in FACTURAS.items():
            prov_id = self._seed_proveedor(nombre_prov)
            for insumo, categoria, qty, precio in factura["items"]:
                insumo_id = self._seed_insumo(insumo, categoria)
                self._seed_stock(insumo, insumo_id, qty)
                self._seed_proveedor_insumo(insumo, insumo_id, prov_id, precio)
            self.stdout.write(self.style.SUCCESS(
                f"  ✓ {nombre_prov} (factura {factura['numero']}) listo"
            ))

        self.stdout.write(self.style.SUCCESS(
            "\n✓ Listo. Probá: Órdenes de Compra → Generar automáticas.\n"
            "  Deberían salir 3 órdenes: 1549.00, 489.00 y 1135.00 Bs."
        ))

    # ── Insumo ───────────────────────────────────────────────
    def _seed_insumo(self, nombre, categoria):
        existe = self.sb.table("insumo").select("id").eq("nombre", nombre).execute()
        if existe.data:
            self.stdout.write(f"  insumo ya existe: {nombre}")
            return existe.data[0]["id"]
        r = self.sb.table("insumo").insert({
            "nombre": nombre, "categoria": categoria,
            "origen": "Nacional", "conservado": "Ambiente",
            "vencimiento_dias": 90,
            "proteinas": 1.0, "calorias": 20.0, "grasas": 0.5,
            "calcio": 10.0, "hierro": 0.5,
        }).execute()
        self.stdout.write(self.style.SUCCESS(f"  + insumo: {nombre}"))
        return r.data[0]["id"]

    # ── Stock ────────────────────────────────────────────────
    def _seed_stock(self, nombre, insumo_id, qty):
        # cantidad_actual = stock_min (EN el mínimo, dispara CU36);
        # stock_max = stock_min + qty  ->  cantidad_a_pedir = qty de la factura.
        cant = STOCK_MIN_BASE
        smin = STOCK_MIN_BASE
        smax = STOCK_MIN_BASE + qty
        existe = self.sb.table("stock").select("id").eq("insumo_id", insumo_id).execute()
        if existe.data:
            self.sb.table("stock").update(
                {"cantidad": cant, "stock_min": smin, "stock_max": smax}
            ).eq("id", existe.data[0]["id"]).execute()
            self.stdout.write(f"    stock actualizado: {nombre} (pedir={qty})")
            return
        self.sb.table("stock").insert({
            "insumo_id": insumo_id, "cantidad": cant,
            "stock_min": smin, "stock_max": smax,
        }).execute()
        self.stdout.write(self.style.SUCCESS(f"    + stock: {nombre} (pedir={qty})"))

    # ── Proveedor ────────────────────────────────────────────
    def _seed_proveedor(self, nombre):
        existe = self.sb.table("proveedor").select("id").eq("nombre", nombre).execute()
        if existe.data:
            prov_id = existe.data[0]["id"]
            self.sb.table("proveedor").update({"email": EMAIL_DEMO}).eq("id", prov_id).execute()
            self.stdout.write(f"  proveedor ya existe: {nombre} (email actualizado)")
            return prov_id
        r = self.sb.table("proveedor").insert({
            "nombre": nombre, "contacto": "70000000",
            "email": EMAIL_DEMO, "ubicacion": "Santa Cruz",
            "tipo_pago": "Contado",
        }).execute()
        self.stdout.write(self.style.SUCCESS(f"  + proveedor: {nombre} <{EMAIL_DEMO}>"))
        return r.data[0]["id"]

    # ── proveedor_insumo (único proveedor -> es el más barato) ──
    def _seed_proveedor_insumo(self, nombre, insumo_id, prov_id, precio):
        existe = (
            self.sb.table("proveedor_insumo")
            .select("id").eq("proveedor_id", prov_id).eq("insumo_id", insumo_id)
            .execute()
        )
        if existe.data:
            self.sb.table("proveedor_insumo").update(
                {"precio": precio}
            ).eq("id", existe.data[0]["id"]).execute()
            self.stdout.write(f"    proveedor_insumo actualizado: {nombre} @ {precio} Bs")
            return
        self._insert("proveedor_insumo", {
            "proveedor_id": prov_id, "insumo_id": insumo_id,
            "precio": precio, "calificacion": "Buena",
            "nota": "Precio de factura de demostración",
        })
        self.stdout.write(self.style.SUCCESS(
            f"    + proveedor_insumo: {nombre} @ {precio} Bs (prov {prov_id})"
        ))

    # ── Subir otros insumos demo por encima del mínimo ───────
    def _reabastecer_otros(self):
        for nombre in INSUMOS_A_REABASTECER:
            ins = self.sb.table("insumo").select("id").eq("nombre", nombre).execute()
            if not ins.data:
                continue
            insumo_id = ins.data[0]["id"]
            st = self.sb.table("stock").select("id, stock_min, stock_max").eq(
                "insumo_id", insumo_id
            ).execute()
            if not st.data:
                continue
            fila = st.data[0]
            smin = int(fila.get("stock_min") or 0)
            smax = fila.get("stock_max")
            # dejar la cantidad por encima del mínimo (al tope si hay stock_max)
            nueva = int(smax) if smax is not None else smin + 10
            self.sb.table("stock").update({"cantidad": nueva}).eq("id", fila["id"]).execute()
            self.stdout.write(f"  reabastecido (no genera orden): {nombre} -> cant={nueva}")

    def _insert(self, tabla, payload):
        """Inserta respetando la secuencia; solo calcula 'id' si la tabla lo exige."""
        try:
            return self.sb.table(tabla).insert(payload).execute()
        except Exception as e:
            msg = str(e)
            if '23502' in msg or 'null value in column "id"' in msg:
                r = self.sb.table(tabla).select("id").order("id", desc=True).limit(1).execute()
                siguiente = (r.data[0]["id"] + 1) if r.data else 1
                return self.sb.table(tabla).insert({**payload, "id": siguiente}).execute()
            raise

    # ── Limpieza ─────────────────────────────────────────────
    def _limpiar(self):
        self.stdout.write(self.style.WARNING("Eliminando datos de facturas demo..."))
        insumos = self.sb.table("insumo").select("id").in_("nombre", NOMBRES_INSUMOS).execute()
        insumo_ids = [i["id"] for i in (insumos.data or [])]
        provs = self.sb.table("proveedor").select("id").in_("nombre", NOMBRES_PROVEEDORES).execute()
        prov_ids = [p["id"] for p in (provs.data or [])]

        # Órdenes de compra generadas (con el botón) para estos 3 proveedores.
        # OJO: esto NO borra facturas escaneadas, solo las órdenes de compra.
        if prov_ids:
            ordenes = self.sb.table("orden_compra").select("id").in_("proveedor_id", prov_ids).execute()
            orden_ids = [o["id"] for o in (ordenes.data or [])]
            if orden_ids:
                self.sb.table("detalle_orden_compra").delete().in_("orden_id", orden_ids).execute()
                self.sb.table("orden_compra").delete().in_("id", orden_ids).execute()
                self.stdout.write(f"  órdenes de compra eliminadas: {len(orden_ids)}")

        if insumo_ids:
            stocks = self.sb.table("stock").select("id").in_("insumo_id", insumo_ids).execute()
            stock_ids = [s["id"] for s in (stocks.data or [])]
            # Liberar FKs que apuntan a stock/insumo antes de borrar stock.
            if stock_ids:
                self.sb.table("alertas_stock").delete().in_("stock_id", stock_ids).execute()
                self.sb.table("detalle_lote").delete().in_("stock_id", stock_ids).execute()
            self.sb.table("detalle_lote").delete().in_("insumo_id", insumo_ids).execute()
            self.sb.table("detalle_orden_compra").delete().in_("insumo_id", insumo_ids).execute()
            self.sb.table("movimiento_inventario").delete().in_("insumo_id", insumo_ids).execute()
            self.sb.table("proveedor_insumo").delete().in_("insumo_id", insumo_ids).execute()
            self.sb.table("stock").delete().in_("insumo_id", insumo_ids).execute()
            self.sb.table("insumo").delete().in_("id", insumo_ids).execute()
        if prov_ids:
            self.sb.table("proveedor").delete().in_("id", prov_ids).execute()
        self.stdout.write(self.style.SUCCESS("✓ Datos de facturas demo eliminados."))
