# ============================================================
# ARCHIVO: backend/usuarios/management/commands/seed_ordenes_demo.py
# CASO DE USO: CU37 - Órdenes de Compra Automáticas
# CICLO: 5
#
# DESCRIPCIÓN:
#   Seeder de demo para mostrar VARIAS órdenes de compra distintas
#   (insumos y proveedores diferentes) en una sola corrida de
#   "Generar automáticas", en vez de repetir siempre Tomate/Leche
#   con el mismo proveedor.
#
#   No toca los datos de seed_ciclo5 (Tomate/Leche/Distribuidora
#   Andina/Mercado Central); solo agrega:
#     - Arroz Blanco    -> más barato en Mercado Central
#     - Queso Mozzarella -> proveedor nuevo: Frigorífico del Valle
#
#   Es idempotente (se puede correr de nuevo sin duplicar).
#
#   USO:
#     python manage.py seed_ordenes_demo
# ============================================================

from django.core.management.base import BaseCommand
from django.conf import settings
from supabase import create_client

# (nombre, categoria, vencimiento_dias)
INSUMOS_SEED = [
    ("Arroz Blanco",      "Cereal", 180),
    ("Queso Mozzarella",  "Lácteo",  20),
]

# (nombre_insumo, cantidad, stock_min, stock_max)
STOCK_SEED = {
    "Arroz Blanco":     (5, 15, 60),
    "Queso Mozzarella": (1, 6,  25),
}

# (nombre_proveedor, email) -- reutiliza tu correo real por la
# restricción de Resend sin dominio verificado.
PROVEEDORES_SEED = [
    ("Frigorífico del Valle", "adalidgragedrojas@gmail.com"),
]

# (insumo, proveedor, precio) -- Arroz va al proveedor ya existente
# "Mercado Central"; Queso va al proveedor nuevo.
PRECIOS_SEED = [
    ("Arroz Blanco",     "Mercado Central",        4.5),
    ("Queso Mozzarella", "Frigorífico del Valle",  30.0),
]


class Command(BaseCommand):
    help = "Agrega insumos/proveedores extra para demostrar varias órdenes de compra distintas (CU37)."

    def handle(self, *args, **options):
        self.sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        self.stdout.write(self.style.MIGRATE_HEADING("== Seeder de demo: órdenes de compra variadas =="))

        insumos = self._seed_insumos()
        self._seed_stock(insumos)
        proveedores = self._seed_proveedores()
        self._seed_proveedor_insumo(insumos, proveedores)

        self.stdout.write(self.style.SUCCESS(
            "\n✓ Listo. Probá: Órdenes de Compra → Generar automáticas."
        ))

    def _seed_insumos(self):
        resultado = {}
        for nombre, categoria, venc in INSUMOS_SEED:
            existe = self.sb.table("insumo").select("id").eq("nombre", nombre).execute()
            if existe.data:
                resultado[nombre] = existe.data[0]["id"]
                self.stdout.write(f"  insumo ya existe: {nombre}")
                continue
            r = self.sb.table("insumo").insert({
                "nombre": nombre, "categoria": categoria,
                "origen": "Nacional", "conservado": "Ambiente",
                "vencimiento_dias": venc,
                "proteinas": 1.0, "calorias": 20.0, "grasas": 0.5,
                "calcio": 10.0, "hierro": 0.5,
            }).execute()
            resultado[nombre] = r.data[0]["id"]
            self.stdout.write(self.style.SUCCESS(f"  + insumo: {nombre}"))
        return resultado

    def _seed_stock(self, insumos):
        for nombre, (cant, smin, smax) in STOCK_SEED.items():
            insumo_id = insumos[nombre]
            existe = self.sb.table("stock").select("id").eq("insumo_id", insumo_id).execute()
            if existe.data:
                self.sb.table("stock").update(
                    {"cantidad": cant, "stock_min": smin, "stock_max": smax}
                ).eq("id", existe.data[0]["id"]).execute()
                self.stdout.write(f"  stock actualizado: {nombre} (cant={cant}, min={smin})")
                continue
            self.sb.table("stock").insert({
                "insumo_id": insumo_id, "cantidad": cant,
                "stock_min": smin, "stock_max": smax,
            }).execute()
            self.stdout.write(self.style.SUCCESS(f"  + stock: {nombre} (cant={cant}, min={smin})"))

    def _seed_proveedores(self):
        resultado = {}
        for nombre, email in PROVEEDORES_SEED:
            existe = self.sb.table("proveedor").select("id").eq("nombre", nombre).execute()
            if existe.data:
                prov_id = existe.data[0]["id"]
                self.sb.table("proveedor").update({"email": email}).eq("id", prov_id).execute()
                resultado[nombre] = prov_id
                self.stdout.write(f"  proveedor ya existe: {nombre} (email actualizado)")
                continue
            r = self.sb.table("proveedor").insert({
                "nombre": nombre, "contacto": "70000000",
                "email": email, "ubicacion": "Santa Cruz",
                "tipo_pago": "Contado",
            }).execute()
            resultado[nombre] = r.data[0]["id"]
            self.stdout.write(self.style.SUCCESS(f"  + proveedor: {nombre} <{email}>"))
        return resultado

    def _seed_proveedor_insumo(self, insumos, proveedores_nuevos):
        for nombre_insumo, nombre_proveedor, precio in PRECIOS_SEED:
            insumo_id = insumos[nombre_insumo]
            if nombre_proveedor in proveedores_nuevos:
                proveedor_id = proveedores_nuevos[nombre_proveedor]
            else:
                existe_prov = self.sb.table("proveedor").select("id").eq(
                    "nombre", nombre_proveedor
                ).execute()
                if not existe_prov.data:
                    self.stdout.write(self.style.WARNING(
                        f"  ! proveedor '{nombre_proveedor}' no existe. "
                        f"Corré primero: python manage.py seed_ciclo5"
                    ))
                    continue
                proveedor_id = existe_prov.data[0]["id"]

            existe = (
                self.sb.table("proveedor_insumo")
                .select("id").eq("proveedor_id", proveedor_id).eq("insumo_id", insumo_id)
                .execute()
            )
            if existe.data:
                self.sb.table("proveedor_insumo").update(
                    {"precio": precio}
                ).eq("id", existe.data[0]["id"]).execute()
                self.stdout.write(f"  proveedor_insumo actualizado: {nombre_insumo} @ {precio} Bs")
                continue

            self._insert("proveedor_insumo", {
                "proveedor_id": proveedor_id, "insumo_id": insumo_id,
                "precio": precio, "calificacion": "Buena",
                "nota": "Precio de demostración",
            })
            self.stdout.write(self.style.SUCCESS(
                f"  + proveedor_insumo: {nombre_insumo} @ {precio} Bs (prov {proveedor_id})"
            ))

    def _insert(self, tabla, payload):
        """
        Inserta intentando primero SIN 'id' (para respetar la secuencia/
        default de la tabla). Solo si la tabla exige 'id' (not-null sin
        default, como proveedor_insumo), lo calcula a mano como max(id)+1.
        """
        try:
            return self.sb.table(tabla).insert(payload).execute()
        except Exception as e:
            msg = str(e)
            if '23502' in msg or 'null value in column "id"' in msg:
                r = self.sb.table(tabla).select("id").order("id", desc=True).limit(1).execute()
                siguiente = (r.data[0]["id"] + 1) if r.data else 1
                return self.sb.table(tabla).insert({**payload, "id": siguiente}).execute()
            raise
