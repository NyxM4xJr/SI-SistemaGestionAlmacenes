# ============================================================
# ARCHIVO: backend/usuarios/management/commands/seed_reabastecimiento.py
# CASO DE USO: CU37 - Órdenes de Compra Automáticas
# CICLO: 5
#
# DESCRIPCIÓN:
#   Seeder liviano para volver a probar "Generar automáticas" las
#   veces que haga falta (por ejemplo, para revisar el formato del
#   correo), sin repetir todo seed_ciclo5 (lotes, alertas, etc.).
#
#   Reutiliza los insumos/proveedores de seed_ciclo5 si ya existen y
#   solo fuerza de nuevo el stock de Tomate Perita y Leche Entera por
#   debajo del mínimo, para que la próxima corrida de
#   "Generar automáticas" vuelva a encontrar algo que reabastecer.
#
#   USO:
#     python manage.py seed_reabastecimiento
# ============================================================

from django.core.management.base import BaseCommand
from django.conf import settings
from supabase import create_client

# (nombre_insumo, cantidad, stock_min, stock_max)
STOCK_BAJO = [
    ("Tomate Perita", 2, 10, 50),
    ("Leche Entera",  5, 8,  40),
]


class Command(BaseCommand):
    help = "Reinicia el stock de insumos demo por debajo del mínimo, para volver a probar CU37."

    def handle(self, *args, **options):
        sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

        self.stdout.write(self.style.MIGRATE_HEADING("== Seeder de reabastecimiento (CU37) =="))

        for nombre, cantidad, smin, smax in STOCK_BAJO:
            insumo = sb.table("insumo").select("id").eq("nombre", nombre).execute()
            if not insumo.data:
                self.stdout.write(self.style.WARNING(
                    f"  ! insumo '{nombre}' no existe todavía. "
                    f"Corré primero: python manage.py seed_ciclo5"
                ))
                continue

            insumo_id = insumo.data[0]["id"]
            stock = sb.table("stock").select("id").eq("insumo_id", insumo_id).execute()
            if not stock.data:
                self.stdout.write(self.style.WARNING(
                    f"  ! '{nombre}' no tiene fila de stock todavía. "
                    f"Corré primero: python manage.py seed_ciclo5"
                ))
                continue

            stock_id = stock.data[0]["id"]
            sb.table("stock").update(
                {"cantidad": cantidad, "stock_min": smin, "stock_max": smax}
            ).eq("id", stock_id).execute()
            self.stdout.write(self.style.SUCCESS(
                f"  + stock reiniciado: {nombre} (cant={cantidad}, min={smin}, max={smax})"
            ))

        self.stdout.write(self.style.SUCCESS(
            "\n✓ Listo. Probá: Órdenes de Compra → Generar automáticas."
        ))
