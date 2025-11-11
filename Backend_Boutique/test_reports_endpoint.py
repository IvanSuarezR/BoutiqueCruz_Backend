#!/usr/bin/env python
import os
import sys
import django

# Setup Django
sys.path.append('.')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'boutique_Main.settings')
django.setup()

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
import uuid

def test_reports_endpoint():
    try:
        print("1. Creando usuario administrador...")
        User = get_user_model()
        user, created = User.objects.get_or_create(
            username='admin_test',
            defaults={
                'email': 'admin@test.com',
                'identification_number': str(uuid.uuid4())[:12],
                'user_type': 'admin',
                'is_superuser': True,
                'is_staff': True
            }
        )
        if created:
            user.set_password('testpass')
            user.save()
        print("✓ Usuario administrador creado/obtenido")
        
        print("2. Configurando cliente API...")
        client = APIClient()
        client.force_authenticate(user=user)
        print("✓ Cliente autenticado")
        
        print("3. Enviando petición al endpoint de reportes...")
        response = client.post(
            '/api/reports/generate/',
            {
                'prompt': 'Dame un resumen de las órdenes de la última semana',
                'export_format': 'pdf',
                'include_chart': True
            },
            format='json',
            HTTP_HOST='localhost'
        )
        
        print(f"4. Respuesta del endpoint:")
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Success: {data.get('success')}")
            print(f"   Report Title: {data.get('title', 'No title')[:50]}...")
            print(f"   Query length: {len(data.get('sql_query', ''))}")
            print(f"   Data rows: {len(data.get('data', []))}")
            
        else:
            try:
                error_data = response.json()
                print(f"   Error: {error_data}")
            except:
                print(f"   Raw error: {response.content}")
        
        return response
        
    except Exception as e:
        print(f"✗ Error: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    test_reports_endpoint()