# ============================================================
# ARCHIVO: backend/usuarios/management/commands/seed_conciliacion_demo.py
# CASOS DE USO: CU36 (Órdenes automáticas) + CU39/CU40 (Facturas/Conciliación)
# CICLO: 6
#
# DESCRIPCIÓN:
#   Prepara un escenario CONTROLADO y REPETIBLE para la demo de
#   conciliación factura↔orden. Deja los datos listos para que, al
#   apretar "Generar automáticas" (CU36), el botón cree EXACTAMENTE
#   tres órdenes de compra:
#     - Distribuidora del Sur → 4 insumos
#     - Comercial Andina      → 3 insumos
#     - Almacén del Norte      → 2 insumos
#   con cantidades y precios distintos y deterministas.
#
#   La lógica de CU36 no se toca: solo se siembran los datos (stock bajo
#   mínimo + proveedor_insumo con el precio) para que el botón real haga
#   su trabajo. La cantidad que pide CU36 = stock_max - cantidad_actual,
#   por eso acá se controla ambos para que salgan números limpios.
#
#   Con --aislar (activo por defecto) sube por encima del mínimo el stock
#   de CUALQUIER otro insumo que esté bajo mínimo, para que el botón
#   genere ÚNICAMENTE estas tres órdenes y la demo quede limpia.
#
#   Es idempotente. USO:
#     python manage.py seed_conciliacion_demo
#     python manage.py seed_conciliacion_demo --no-aislar
# ============================================================

from django.core.management.base import BaseCommand
from django.conf import settings
from supabase import create_client

# Email real del usuario: Resend sin dominio verificado solo entrega a la
# casilla propia, así los dos proveedores notifican a tu correo.
EMAIL_DEMO = "adalidgragedrojas@gmail.com"

PROVEEDORES = [
    ("Distribuidora del Sur", EMAIL_DEMO),
    ("Comercial Andina", EMAIL_DEMO),
    ("Almacén del Norte", EMAIL_DEMO),
]

# (insumo, categoria, venc_dias, proveedor, precio, cantidad, stock_min, stock_max)
# cantidad <= stock_min  → dispara la orden.
# cantidad a pedir = stock_max - cantidad  (determinista).
ITEMS = [
    # ── Orden A: Distribuidora del Sur (4 insumos) ──
    ("Lomo de Res",        "Carne",    10, "Distribuidora del Sur", 55.00,  2, 10, 22),  # pide 20
    ("Papa Blanca",        "Verdura", 120, "Distribuidora del Sur",  4.20,  8, 20, 58),  # pide 50
    ("Cebolla Morada",     "Verdura",  60, "Distribuidora del Sur",  3.80,  5, 15, 35),  # pide 30
    ("Zanahoria",          "Verdura",  90, "Distribuidora del Sur",  5.00,  4, 12, 29),  # pide 25
    # ── Orden B: Comercial Andina (3 insumos) ──
    ("Aceite Vegetal 5L",  "Abarrote",365, "Comercial Andina",      42.00,  3,  8, 18),  # pide 15
    ("Sal Fina 1kg",       "Abarrote",730, "Comercial Andina",       6.50,  6, 20, 46),  # pide 40
    ("Azúcar Blanca 1kg",  "Abarrote",730, "Comercial Andina",       7.00, 10, 25, 45),  # pide 35
    # ── Orden C: Almacén del Norte (2 insumos) ──
    ("Fideo Spaghetti 500g","Abarrote",540, "Almacén del Norte",     5.50,  6, 15, 36),  # pide 30
    ("Atún en Lata 170g",   "Abarrote",900, "Almacén del Norte",     9.00,  8, 20, 44),  # pide 36
]


class Command(BaseCommand):
    help = "Prepara 3 proveedores + 9 insumos bajo mínimo para que 'Generar automáticas' cree 3 órdenes (4+3+2)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--no-aislar", action="store_false", dest="aislar",
            help="No subir el stock de otros insumos bajo mínimo (puede generar órdenes extra).",
        )
        parser.add_argument(
            "--no-limpiar-ordenes", action="store_false", dest="limpiar_ordenes",
            help="No borrar las órdenes viejas de los proveedores demo (se acumularían duplicadas).",
        )

    def handle(self, *args, **options):
        self.sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        self.stdout.write(self.style.MIGRATE_HEADING(
            "== Seeder demo: conciliación factura↔orden (2 órdenes, 4+3) =="
        ))

        proveedores = self._seed_proveedores()

        # Borra las órdenes viejas de estos proveedores para que "Generar
        # automáticas" no acumule duplicados en cada corrida de la demo.
        if options["limpiar_ordenes"]:
            self._limpiar_ordenes_demo(proveedores)

        insumos = self._seed_insumos_y_stock()
        self._seed_proveedor_insumo(insumos, proveedores)

        if options["aislar"]:
            self._aislar_otros(insumos)

        self._imprimir_resumen()

    # ── Proveedores ──────────────────────────────────────────
    def _seed_proveedores(self):
        res = {}
        for nombre, email in PROVEEDORES:
            existe = self.sb.table("proveedor").select("id").eq("nombre", nombre).execute()
            if existe.data:
                pid = existe.data[0]["id"]
                self.sb.table("proveedor").update({"email": email}).eq("id", pid).execute()
                self.stdout.write(f"  proveedor ya existe: {nombre}")
            else:
                r = self.sb.table("proveedor").insert({
                    "nombre": nombre, "contacto": "70000000", "email": email,
                    "ubicacion": "Santa Cruz", "tipo_pago": "Contado",
                }).execute()
                pid = r.data[0]["id"]
                self.stdout.write(self.style.SUCCESS(f"  + proveedor: {nombre}"))
            res[nombre] = pid
        return res

    # ── Limpiar órdenes viejas de los proveedores demo ───────
    def _limpiar_ordenes_demo(self, proveedores):
        ids = list(proveedores.values())
        if not ids:
            return
        ordenes = (
            self.sb.table("orden_compra").select("id")
            .in_("proveedor_id", ids).execute()
        )
        orden_ids = [o["id"] for o in (ordenes.data or [])]
        if not orden_ids:
            self.stdout.write("  limpieza: no había órdenes previas de estos proveedores.")
            return

        # 1) Desvincular las facturas que apuntaban a esas órdenes (evita
        #    romper la relación factura→orden al borrarlas).
        try:
            self.sb.table("factura").update({"orden_id": None}).in_(
                "orden_id", orden_ids
            ).execute()
        except Exception as e:
            self.stdout.write(self.style.WARNING(f"  (aviso) no se pudo desvincular facturas: {e}"))

        # 2) Borrar las órdenes (detalle_orden_compra cae en cascada).
        self.sb.table("orden_compra").delete().in_("proveedor_id", ids).execute()
        self.stdout.write(self.style.WARNING(
            f"  limpieza: borré {len(orden_ids)} orden(es) vieja(s) de los proveedores demo."
        ))

    # ── Insumos + stock (bajo mínimo) ────────────────────────
    def _seed_insumos_y_stock(self):
        res = {}
        for nombre, cat, venc, _prov, _precio, cant, smin, smax in ITEMS:
            existe = self.sb.table("insumo").select("id").eq("nombre", nombre).execute()
            if existe.data:
                iid = existe.data[0]["id"]
                self.stdout.write(f"  insumo ya existe: {nombre}")
            else:
                r = self.sb.table("insumo").insert({
                    "nombre": nombre, "categoria": cat, "origen": "Nacional",
                    "conservado": "Ambiente", "vencimiento_dias": venc,
                    "proteinas": 1.0, "calorias": 20.0, "grasas": 0.5,
                    "calcio": 10.0, "hierro": 0.5,
                }).execute()
                iid = r.data[0]["id"]
                self.stdout.write(self.style.SUCCESS(f"  + insumo: {nombre}"))
            res[nombre] = iid

            # Stock bajo mínimo (o actualiza a los valores de demo).
            st = self.sb.table("stock").select("id").eq("insumo_id", iid).execute()
            payload = {"cantidad": cant, "stock_min": smin, "stock_max": smax}
            if st.data:
                self.sb.table("stock").update(payload).eq("id", st.data[0]["id"]).execute()
            else:
                self.sb.table("stock").insert({"insumo_id": iid, **payload}).execute()
        return res

    # ── proveedor_insumo (precio pactado) ────────────────────
    def _seed_proveedor_insumo(self, insumos, proveedores):
        for nombre, _cat, _venc, prov, precio, *_ in ITEMS:
            iid = insumos[nombre]
            pid = proveedores[prov]
            existe = (
                self.sb.table("proveedor_insumo").select("id")
                .eq("proveedor_id", pid).eq("insumo_id", iid).execute()
            )
            if existe.data:
                self.sb.table("proveedor_insumo").update(
                    {"precio": precio}
                ).eq("id", existe.data[0]["id"]).execute()
            else:
                self._insert("proveedor_insumo", {
                    "proveedor_id": pid, "insumo_id": iid, "precio": precio,
                    "calificacion": "Buena", "nota": "Precio de demostración",
                })
            self.stdout.write(f"  proveedor_insumo: {nombre} @ {precio} Bs → {prov}")

    # ── Aislar: subir stock de OTROS insumos bajo mínimo ─────
    def _aislar_otros(self, insumos_demo):
        ids_demo = set(insumos_demo.values())
        rows = self.sb.table("stock").select(
            "id, insumo_id, cantidad, stock_min, stock_max"
        ).execute()
        subidos = 0
        for s in (rows.data or []):
            if s["insumo_id"] in ids_demo:
                continue
            smin = s.get("stock_min")
            if smin is None:
                continue
            if float(s.get("cantidad", 0)) <= float(smin):
                # stock.cantidad es entero: subimos a un valor por encima del mínimo.
                nuevo = int(float(smin)) + 5
                self.sb.table("stock").update(
                    {"cantidad": nuevo}
                ).eq("id", s["id"]).execute()
                subidos += 1
        if subidos:
            self.stdout.write(self.style.WARNING(
                f"  aislar: subí el stock de {subidos} insumo(s) que estaban bajo mínimo, "
                f"para que 'Generar automáticas' cree SOLO las 2 órdenes de la demo."
            ))
        else:
            self.stdout.write("  aislar: no había otros insumos bajo mínimo.")

    # ── Resumen para armar las facturas ──────────────────────
    def _imprimir_resumen(self):
        self.stdout.write(self.style.SUCCESS(
            "\n✓ Datos listos. Ahora: Proveedores → Órdenes de Compra → 'Generar automáticas'.\n"
        ))
        self.stdout.write("Se generarán estas 2 órdenes (usá estos datos para las facturas):\n")
        por_prov = {}
        for nombre, _c, _v, prov, precio, cant, _min, smax in ITEMS:
            qty = smax - cant
            por_prov.setdefault(prov, []).append((nombre, qty, precio, round(qty * precio, 2)))
        for prov, items in por_prov.items():
            total = round(sum(i[3] for i in items), 2)
            self.stdout.write(self.style.HTTP_INFO(f"\n  ── {prov} ({len(items)} insumos) ──"))
            for nombre, qty, precio, sub in items:
                self.stdout.write(f"     {nombre:<20} {qty:>3} x {precio:>6.2f} = {sub:>8.2f} Bs")
            self.stdout.write(f"     {'TOTAL':<20} {'':>3}   {'':>6}   {total:>8.2f} Bs")

    def _insert(self, tabla, payload):
        """Inserta respetando la secuencia; si la tabla exige 'id', lo calcula."""
        try:
            return self.sb.table(tabla).insert(payload).execute()
        except Exception as e:
            msg = str(e)
            if '23502' in msg or 'null value in column "id"' in msg:
                r = self.sb.table(tabla).select("id").order("id", desc=True).limit(1).execute()
                siguiente = (r.data[0]["id"] + 1) if r.data else 1
                return self.sb.table(tabla).insert({**payload, "id": siguiente}).execute()
            raise
