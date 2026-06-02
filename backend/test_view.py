import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'nucleo.settings')
django.setup()

from rest_framework.test import APIRequestFactory, force_authenticate
from usuarios.stock_views import StockListView

def run():
    factory = APIRequestFactory()
    request = factory.get('/api/stock/')
    
    # Bypass auth by mocking the user
    user = type('User', (), {'id': 'test-id', 'email': 'test@test.com', 'is_authenticated': True, 'rol': 'administrador'})()
    force_authenticate(request, user=user)
    
    view = StockListView.as_view()
    
    try:
        response = view(request)
        print("STATUS:", response.status_code)
        print("DATA:", response.data)
    except Exception as e:
        print("EXCEPTION IN VIEW:", str(e))

if __name__ == "__main__":
    run()
