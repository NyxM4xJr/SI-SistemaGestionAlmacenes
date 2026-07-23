# ============================================================
# ARCHIVO: backend/inventario/management/commands/limpiar_facturas.py
# CASOS DE USO: CU39 / CU40 - Facturas escaneadas
# CICLO: 6
#
# DESCRIPCIÓN:
#   Deja LIMPIA la tabla de facturas escaneadas para volver a subirlas
#   en la defensa. Borra todas las facturas y su detalle
#   (detalle_factura sale en cascada), y opcionalmente las imágenes
#   guardadas en el bucket de Supabase Storage 'facturas'.
#
#   NO toca órdenes de compra, insumos, stock ni proveedores. Solo
#   facturas.
#
#   USO:
#     python manage.py limpiar_facturas             (borra facturas + detalle)
#     python manage.py limpiar_facturas --imagenes  (además borra las imágenes del bucket)
# ============================================================

from django.core.management.base import BaseCommand
from django.conf import settings
from supabase import create_client

BUCKET_FACTURAS = 'facturas'


class Command(BaseCommand):
    help = "Borra todas las facturas escaneadas y su detalle (opcionalmente las imágenes del bucket)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--imagenes",
            action="store_true",
            help="También elimina las imágenes de las facturas del bucket de Storage.",
        )

    def handle(self, *args, **options):
        sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        self.stdout.write(self.style.MIGRATE_HEADING("== Limpiar facturas escaneadas =="))

        facturas = sb.table("factura").select("id, numero_factura, imagen_url").execute()
        filas = facturas.data or []

        if not filas:
            self.stdout.write("  No hay facturas para eliminar.")
            return

        factura_ids = [f["id"] for f in filas]

        # Borrar imágenes del bucket (opcional).
        if options["imagenes"]:
            rutas = [f["imagen_url"] for f in filas if f.get("imagen_url")]
            if rutas:
                try:
                    sb.storage.from_(BUCKET_FACTURAS).remove(rutas)
                    self.stdout.write(f"  imágenes eliminadas del bucket: {len(rutas)}")
                except Exception as e:
                    self.stdout.write(self.style.WARNING(
                        f"  ! no se pudieron borrar algunas imágenes: {str(e)}"
                    ))

        # detalle_factura cae en cascada, pero lo borramos explícito por si
        # la FK no tuviera ON DELETE CASCADE en este entorno.
        sb.table("detalle_factura").delete().in_("factura_id", factura_ids).execute()
        sb.table("factura").delete().in_("id", factura_ids).execute()

        self.stdout.write(self.style.SUCCESS(
            f"\n✓ {len(factura_ids)} factura(s) eliminada(s). Listo para volver a escanear."
        ))
