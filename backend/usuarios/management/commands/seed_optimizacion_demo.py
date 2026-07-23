from datetime import date, timedelta

from django.core.management.base import BaseCommand
from django.conf import settings
from supabase import create_client

PLATO_NOMBRE = "Pollo con Arroz (Demo Optimización)"

# (nombre, categoria)
INSUMOS_SEED = [
    ("Pollo Trozado Demo", "Carne"),
    ("Arroz Blanco Demo", "Cereal"),
    ("Cebolla Blanca Demo", "Verdura"),
    ("Cebolla Perla Demo", "Verdura"),  # alternativa más barata (palanca B)
]

PROVEEDORES_SEED = [
    ("Proveedor Ahorro Demo", "adalidgragedrojas@gmail.com"),
    ("Proveedor Estándar Demo", "adalidgragedrojas@gmail.com"),
]

# (insumo, precio_ahorro, precio_estandar)
PRECIOS_PROVEEDOR = [
    ("Pollo Trozado Demo", 18.0, 24.0),
    ("Arroz Blanco Demo", 4.0, 5.5),
    ("Cebolla Blanca Demo", 3.0, 3.0),
    ("Cebolla Perla Demo", 2.0, None),
]

# Costo que "hoy se paga" (detalle_lote), simulando compra al proveedor caro.
COSTO_VIGENTE = {
    "Pollo Trozado Demo": 24.0,
    "Arroz Blanco Demo": 5.5,
    "Cebolla Blanca Demo": 3.0,
}

# (insumo, cantidad_en_receta)
RECETA_SEED = [
    ("Pollo Trozado Demo", 0.5),
    ("Arroz Blanco Demo", 0.3),
    ("Cebolla Blanca Demo", 0.2),
]

NOMBRES_INSUMOS = [n for n, _ in INSUMOS_SEED]
NOMBRES_PROVEEDORES = [n for n, _ in PROVEEDORES_SEED]


class Command(BaseCommand):
    help = "Puebla datos de demo para el Optimizador de Recetas con IA (idempotente)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--limpiar",
            action="store_true",
            help="Elimina los datos de demo sembrados y termina.",
        )

    def _insert(self, tabla, payload):
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

        if options["limpiar"]:
            self._limpiar()
            return

        self.stdout.write(self.style.MIGRATE_HEADING("== Seeder Optimizador de Recetas =="))

        insumos = self._seed_insumos()
        proveedores = self._seed_proveedores()
        self._seed_proveedor_insumo(insumos, proveedores)
        unidad_id = self._obtener_unidad()
        plato_id = self._seed_plato()
        self._seed_receta(plato_id, insumos, unidad_id)
        self._seed_lote(insumos, proveedores)

        self.stdout.write(self.style.SUCCESS("\n✓ Seeder completado."))
        self.stdout.write(
            f"Probá: Recetas → Optimizar Receta (IA) → '{PLATO_NOMBRE}'."
        )

    def _seed_insumos(self):
        resultado = {}
        for nombre, categoria in INSUMOS_SEED:
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
                "vencimiento_dias": 30,
                "proteinas": 1.0, "calorias": 20.0, "grasas": 0.5,
                "calcio": 10.0, "hierro": 0.5,
            }
            r = self.sb.table("insumo").insert(payload).execute()
            resultado[nombre] = r.data[0]["id"]
            self.stdout.write(self.style.SUCCESS(f"  + insumo: {nombre}"))
        return resultado

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
            self.stdout.write(self.style.SUCCESS(f"  + proveedor: {nombre}"))
        return resultado

    def _seed_proveedor_insumo(self, insumos, proveedores):
        ahorro_id = proveedores["Proveedor Ahorro Demo"]
        estandar_id = proveedores["Proveedor Estándar Demo"]
        for nombre, precio_ahorro, precio_estandar in PRECIOS_PROVEEDOR:
            insumo_id = insumos[nombre]
            pares = [(ahorro_id, precio_ahorro)]
            if precio_estandar is not None:
                pares.append((estandar_id, precio_estandar))
            for prov_id, precio in pares:
                existe = (
                    self.sb.table("proveedor_insumo")
                    .select("id").eq("proveedor_id", prov_id).eq("insumo_id", insumo_id)
                    .execute()
                )
                if existe.data:
                    continue
                self._insert("proveedor_insumo", {
                    "proveedor_id": prov_id, "insumo_id": insumo_id,
                    "precio": precio, "calificacion": "Buena",
                    "nota": "Precio de demostración",
                })
                self.stdout.write(self.style.SUCCESS(
                    f"  + proveedor_insumo: {nombre} @ {precio} Bs (prov {prov_id})"
                ))

    def _obtener_unidad(self):
        r = self.sb.table("unidad_medida").select("id").limit(1).execute()
        if not r.data:
            raise RuntimeError("No hay filas en unidad_medida; sembralas antes de correr este comando.")
        return r.data[0]["id"]

    def _seed_plato(self):
        existe = self.sb.table("plato").select("id").eq("nombre", PLATO_NOMBRE).execute()
        if existe.data:
            self.stdout.write(f"  plato ya existe: {PLATO_NOMBRE}")
            return existe.data[0]["id"]
        r = self.sb.table("plato").insert({
            "nombre": PLATO_NOMBRE,
            "descripcion": "Plato de demostración para probar el optimizador de recetas.",
            "costo": 45.0,
        }).execute()
        self.stdout.write(self.style.SUCCESS(f"  + plato: {PLATO_NOMBRE}"))
        return r.data[0]["id"]

    def _seed_receta(self, plato_id, insumos, unidad_id):
        existe = self.sb.table("receta").select("id").eq("plato_id", plato_id).execute()
        if existe.data:
            self.stdout.write("  receta ya existe (skip)")
            return

        receta = self._insert("receta", {
            "plato_id": plato_id,
            "descripcion": "Receta de demostración.",
            "cantidad": 1,
        })
        receta_id = receta.data[0]["id"]

        detalles = [{
            "receta_id": receta_id,
            "insumo_id": insumos[nombre],
            "cantidad": cantidad,
            "unidad_id": unidad_id,
        } for nombre, cantidad in RECETA_SEED]
        self.sb.table("detalle_receta").insert(detalles).execute()
        self.stdout.write(self.style.SUCCESS(f"  + receta con {len(detalles)} ingrediente(s)"))

    def _seed_lote(self, insumos, proveedores):
        insumo_ids = [insumos[n] for n in COSTO_VIGENTE]
        ya = self.sb.table("detalle_lote").select("id").in_("insumo_id", insumo_ids).execute()
        if ya.data:
            self.stdout.write("  lote de demo ya existe (skip)")
            return

        hoy = date.today()
        fecha_vencimiento = (hoy + timedelta(days=90)).isoformat()

        lote = self._insert("lote", {
            "fecha_ing": hoy.isoformat(),
            "proveedor_id": proveedores["Proveedor Estándar Demo"],
            "total_lote": 100.0,
        })
        lote_id = lote.data[0]["id"]

        for nombre, costo in COSTO_VIGENTE.items():
            insumo_id = insumos[nombre]
            stock = self.sb.table("stock").select("id").eq("insumo_id", insumo_id).execute()
            if stock.data:
                stock_id = stock.data[0]["id"]
            else:
                stock_id = self.sb.table("stock").insert({
                    "insumo_id": insumo_id, "cantidad": 20,
                    "stock_min": 5, "stock_max": 50,
                }).execute().data[0]["id"]

            self._insert("detalle_lote", {
                "lote_id": lote_id,
                "insumo_id": insumo_id,
                "stock_id": stock_id,
                "cantidad": 10,
                "costo_unitario": costo,
                "fecha_vencimiento": fecha_vencimiento,
            })
            self.stdout.write(self.style.SUCCESS(f"  + detalle_lote: {nombre} @ {costo} Bs (costo vigente)"))

    def _limpiar(self):
        self.stdout.write(self.style.WARNING("Eliminando datos de demo..."))
        insumos = self.sb.table("insumo").select("id").in_("nombre", NOMBRES_INSUMOS).execute()
        insumo_ids = [i["id"] for i in (insumos.data or [])]
        provs = self.sb.table("proveedor").select("id").in_("nombre", NOMBRES_PROVEEDORES).execute()
        prov_ids = [p["id"] for p in (provs.data or [])]

        plato = self.sb.table("plato").select("id").eq("nombre", PLATO_NOMBRE).execute()
        if plato.data:
            plato_id = plato.data[0]["id"]
            receta = self.sb.table("receta").select("id").eq("plato_id", plato_id).execute()
            for r in (receta.data or []):
                self.sb.table("detalle_receta").delete().eq("receta_id", r["id"]).execute()
                self.sb.table("receta").delete().eq("id", r["id"]).execute()
            self.sb.table("plato").delete().eq("id", plato_id).execute()

        if insumo_ids:
            detalles = self.sb.table("detalle_lote").select("id, lote_id").in_("insumo_id", insumo_ids).execute()
            lote_ids = list({d["lote_id"] for d in (detalles.data or [])})
            for lid in lote_ids:
                self.sb.table("detalle_lote").delete().eq("lote_id", lid).execute()
                self.sb.table("lote").delete().eq("id", lid).execute()
            self.sb.table("movimiento_inventario").delete().in_("insumo_id", insumo_ids).execute()
            self.sb.table("proveedor_insumo").delete().in_("insumo_id", insumo_ids).execute()
            self.sb.table("stock").delete().in_("insumo_id", insumo_ids).execute()
            self.sb.table("insumo").delete().in_("id", insumo_ids).execute()
        if prov_ids:
            self.sb.table("proveedor").delete().in_("id", prov_ids).execute()
        self.stdout.write(self.style.SUCCESS("✓ Datos de demo eliminados."))
