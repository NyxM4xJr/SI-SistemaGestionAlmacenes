# ============================================================
# ARCHIVO: backend/usuarios/management/commands/seed_valor_perdido_demo.py
# CASO DE USO: CU25 (Valor Perdido) / CU29 (Dashboard) - CU38 (Briefing IA)
# CICLO: 5
#
# DESCRIPCIÓN:
#   El gráfico "Tendencia de Valor Perdido" del Dashboard (CU29) queda
#   vacío si no hay movimientos tipo 'merma' registrados en el mes en
#   curso. Este seeder inserta unos pocos movimientos de merma de DEMO,
#   repartidos en distintos días del mes actual, para que el gráfico
#   tenga datos reales que mostrar.
#
#   Reutiliza insumos/stock ya sembrados por seed_ciclo5 y
#   seed_recetas_ia_demo (Tomate Perita, Leche Entera, Harina 0000,
#   Zanahoria, Pollo Entero) si existen; si un insumo no existe, se
#   omite sin romper el resto.
#
#   Es idempotente: no duplica si ya hay mermas de demo este mes
#   (se identifican por el marcador en 'observacion').
#
#   USO:
#     python manage.py seed_valor_perdido_demo
# ============================================================

from datetime import date, timedelta

from django.core.management.base import BaseCommand
from django.conf import settings
from supabase import create_client

MARCADOR_DEMO = "[demo-valor-perdido]"

# (nombre_insumo, dias_atras, cantidad, valor_perdido, causa)
# Cantidades deliberadamente bajas (1): un trigger de la BD rechaza la
# merma si excede el stock disponible, y algunos insumos de demo quedan
# con muy poco stock (ej. Tomate Perita en 2, por seed_reabastecimiento).
MERMAS_SEED = [
    ("Tomate Perita",   1, 1, 18.50, "Vencimiento"),
    ("Leche Entera",    3, 1, 14.00, "Daño físico"),
    ("Harina 0000",     5, 1, 6.75,  "Error de manipulación"),
    ("Zanahoria",       7, 1, 9.20,  "Vencimiento"),
    ("Pollo Entero",   10, 1, 22.00, "Deterioro por temperatura"),
]


class Command(BaseCommand):
    help = "Inserta movimientos de merma de demo en el mes actual, para poblar el gráfico de tendencia del Dashboard."

    def handle(self, *args, **options):
        self.sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        self.stdout.write(self.style.MIGRATE_HEADING("== Seeder de demo: valor perdido (tendencia del Dashboard) =="))

        ya = (
            self.sb.table("movimiento_inventario")
            .select("id")
            .eq("tipo", "merma")
            .ilike("observacion", f"%{MARCADOR_DEMO}%")
            .execute()
        )
        if ya.data:
            self.stdout.write("  ya hay mermas de demo cargadas este mes (skip)")
            return

        usuario_id = self._algun_usuario_id()
        if not usuario_id:
            self.stdout.write(self.style.WARNING(
                "  ! no se encontró ningún usuario en detalle_bitacora. "
                "Iniciá sesión al menos una vez antes de correr este seeder."
            ))
            return

        hoy = date.today()
        insertados = 0

        for nombre, dias_atras, cantidad, valor_perdido, causa in MERMAS_SEED:
            insumo = self.sb.table("insumo").select("id").eq("nombre", nombre).execute()
            if not insumo.data:
                self.stdout.write(f"  ! insumo '{nombre}' no existe, se omite")
                continue
            insumo_id = insumo.data[0]["id"]

            stock = self.sb.table("stock").select("id, cantidad").eq("insumo_id", insumo_id).execute()
            if not stock.data:
                self.stdout.write(f"  ! '{nombre}' no tiene stock, se omite")
                continue
            stock_id = stock.data[0]["id"]

            # La BD rechaza la merma si excede el stock disponible: se
            # verifica antes de intentar el insert en vez de dejar que
            # rompa el seeder completo.
            disponible = float(stock.data[0]["cantidad"])
            if disponible < cantidad:
                self.stdout.write(self.style.WARNING(
                    f"  ! '{nombre}' tiene solo {disponible} en stock "
                    f"(se necesita {cantidad}), se omite"
                ))
                continue

            fecha_mov = hoy - timedelta(days=dias_atras)
            # Si la fecha cae antes del 1° del mes actual, se ajusta al día 1
            # (para que siempre caiga dentro de la ventana que grafica CU29).
            if fecha_mov < hoy.replace(day=1):
                fecha_mov = hoy.replace(day=1)

            self.sb.table("movimiento_inventario").insert({
                "tipo": "merma",
                "insumo_id": insumo_id,
                "stock_id": stock_id,
                "cantidad": cantidad,
                "fecha_mov": fecha_mov.isoformat(),
                "usuario_id": usuario_id,
                "observacion": f"Merma de demostración {MARCADOR_DEMO}",
                "causa": causa,
                "valor_perdido": valor_perdido,
            }).execute()

            insertados += 1
            self.stdout.write(self.style.SUCCESS(
                f"  + merma: {nombre} el {fecha_mov.isoformat()} (Bs. {valor_perdido})"
            ))

        self.stdout.write(self.style.SUCCESS(
            f"\n✓ {insertados} mermas de demo insertadas. Revisá Dashboard de KPIs → Tendencia de Valor Perdido."
        ))

    def _algun_usuario_id(self):
        """
        movimiento_inventario.usuario_id exige un UUID válido de un
        usuario real. Se reutiliza cualquiera que ya haya generado una
        fila en detalle_bitacora (garantiza que la FK es válida, sin
        necesitar el Admin API de Supabase Auth).
        """
        fila = (
            self.sb.table("detalle_bitacora")
            .select("usuario_id")
            .order("id", desc=True)
            .limit(1)
            .execute()
        )
        return fila.data[0]["usuario_id"] if fila.data else None
