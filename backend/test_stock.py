import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'nucleo.settings')
django.setup()

from supabase import create_client
from django.conf import settings

def run():
    supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    response = supabase.table("stock").select("*, insumo(nombre)").execute()
    print("DATA:", response.data)

if __name__ == "__main__":
    run()
