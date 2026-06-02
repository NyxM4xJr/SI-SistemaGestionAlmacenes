import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'nucleo.settings')
django.setup()

from supabase import create_client
from django.conf import settings

def run():
    supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    
    print("--- TABLA: PROVEEDOR ---")
    try:
        res = supabase.table("proveedor").select("*").limit(2).execute()
        print(res.data)
    except Exception as e:
        print("Error proveedor:", e)

    print("\n--- TABLA: PROVEEDOR_INSUMO ---")
    try:
        res = supabase.table("proveedor_insumo").select("*").limit(2).execute()
        print(res.data)
    except Exception as e:
        print("Error proveedor_insumo:", e)

if __name__ == "__main__":
    run()
