# ============================================================
# ARCHIVO: backend/usuarios/management/commands/limpiar_lotes.py
# CASO DE USO: CU42 (Recepción) / CU12 (Lotes) — utilidad de demo
# CICLO: 6
#
# DESCRIPCIÓN:
#   Borra lotes creados durante la demo (por ejemplo los que cargás con
#   los remitos de Recepción de Mercadería) y REVIERTE el stock que esos
#   lotes habían sumado, igual que hace el botón "Eliminar" de la pantalla
#   de Lotes. Así podés dejar todo limpio y volver a subir los remitos
#   cuando defiendas.
#
#   Por seguridad NO borra nada si no le decís qué borrar. Dos formas:
#     - Por id:      python manage.py limpiar_lotes --ids 21 22 23
#     - Los últimos: python manage.py limpiar_lotes --ultimos 3
#
#   Con --listar solo muestra los lotes recientes (no borra), para que
#   sepas qué ids elegir.
# ============================================================

from django.core.management.base import BaseCommand
from django.conf import settings
from supabase import create_client


class Command(BaseCommand):
    help = "Borra lotes de demo y revierte su stock. Usá --ids, --ultimos o --listar."

    def add_arguments(self, parser):
        parser.add_argument("--ids", nargs="+", type=int, help="IDs de lote a borrar.")
        parser.add_argument("--ultimos", type=int, help="Borra los N lotes más recientes.")
        parser.add_argument("--listar", action="store_true", help="Solo lista lotes recientes (no borra).")

    def handle(self, *args, **options):
        self.sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

        if options["listar"]:
            self._listar()
            return

        ids = options.get("ids")
        ultimos = options.get("ultimos")

        if not ids and not ultimos:
            self.stdout.write(self.style.WARNING(
                "No indicaste qué borrar. Usá --ids 21 22, --ultimos 3, o --listar para ver los ids."
            ))
            return

        if ultimos:
            r = self.sb.table("lote").select("id").order("id", desc=True).limit(ultimos).execute()
            ids = [row["id"] for row in (r.data or [])]

        if not ids:
            self.stdout.write("No hay lotes para borrar.")
            return

        for lote_id in ids:
            self._borrar_lote(lote_id)

        self.stdout.write(self.style.SUCCESS(f"\n✓ Listo. Se borraron {len(ids)} lote(s) y se revirtió su stock."))

    def _listar(self):
        r = self.sb.table("lote").select("id, fecha_ing, total_lote, proveedor_id").order("id", desc=True).limit(15).execute()
        self.stdout.write(self.style.MIGRATE_HEADING("== Últimos lotes =="))
        for l in (r.data or []):
            prov = l.get("proveedor_id")
            origen = "Recepción/manual (sin proveedor)" if prov is None else f"proveedor #{prov}"
            self.stdout.write(f"  #{l['id']}  {l.get('fecha_ing','')}  total {l.get('total_lote',0)} Bs  · {origen}")

    def _borrar_lote(self, lote_id):
        existe = self.sb.table("lote").select("id").eq("id", lote_id).execute()
        if not existe.data:
            self.stdout.write(self.style.WARNING(f"  #{lote_id}: no existe, se omite."))
            return

        # Revertir stock: restar de cada ubicación lo que este lote había sumado.
        detalles = self.sb.table("detalle_lote").select("stock_id, cantidad").eq("lote_id", lote_id).execute()
        for d in (detalles.data or []):
            sql = f"UPDATE stock SET cantidad = cantidad - {d['cantidad']} WHERE id = {d['stock_id']}"
            self.sb.rpc("exec_sql", {"query": sql}).execute()

        # Borrar el lote (detalle_lote cae en cascada).
        self.sb.rpc("exec_sql", {"query": f"DELETE FROM lote WHERE id = {lote_id}"}).execute()
        self.stdout.write(self.style.SUCCESS(f"  #{lote_id}: borrado y stock revertido."))
