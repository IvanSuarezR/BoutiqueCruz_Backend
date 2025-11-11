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

def test_chat_endpoint():
    try:
        print("1. Creando usuario de prueba...")
        User = get_user_model()
        user, created = User.objects.get_or_create(
            username='debug_user',
            defaults={
                'email': 'debug@test.com',
                'identification_number': str(uuid.uuid4())[:12]
            }
        )
        if created:
            user.set_password('testpass')
            user.save()
        print("✓ Usuario creado/obtenido")
        
        print("2. Configurando cliente API...")
        client = APIClient()
        client.force_authenticate(user=user)
        print("✓ Cliente autenticado")
        
        print("3. Enviando petición al endpoint...")
        response = client.post(
            '/api/assistant/chat/',
            {'message': 'Hola, soy un test'},
            format='json',
            HTTP_HOST='localhost'
        )
        
        print(f"4. Respuesta del endpoint:")
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Success: {data.get('success')}")
            print(f"   Conversation ID: {data.get('conversation_id', 'None')[:8]}...")
            
            message_data = data.get('message', {})
            content = message_data.get('content', '')
            print(f"   Response length: {len(content)}")
            print(f"   Response preview: {content[:200]}...")
            
            # Mostrar si es error genérico
            if "hubo un error" in content.lower():
                print("   ⚠️ RESPUESTA DE ERROR GENÉRICO DETECTADA")
            
            actions = message_data.get('suggested_actions', [])
            print(f"   Actions count: {len(actions)}")
            
        else:
            print(f"   Error en petición: {response.content}")
        
        return response
        
    except Exception as e:
        print(f"✗ Error: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    test_chat_endpoint()