#!/usr/bin/env python
import os
import sys
import django

# Setup Django
sys.path.append('.')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'boutique_Main.settings')
django.setup()

from assistant.ai_service import AssistantAIService

def test_assistant():
    try:
        print("1. Creando servicio...")
        service = AssistantAIService()
        print("✓ Servicio creado")
        
        print("2. Probando cliente Groq...")
        client = service.client  # Esto debería inicializar el cliente
        print("✓ Cliente Groq inicializado")
        
        print("3. Probando método chat...")
        result = service.chat(
            user_message='Hola, ¿cómo estás?',
            user_role='customer',
            user_name='Test User',
            conversation_history=[]
        )
        
        print("4. Resultado:")
        print(f"   Success: {result.get('success')}")
        if result.get('success'):
            response = result.get('response', '')
            print(f"   Response length: {len(response)}")
            print(f"   Response preview: {response[:200]}...")
            print(f"   Actions count: {len(result.get('suggested_actions', []))}")
        else:
            print(f"   Error: {result.get('error')}")
        
        return result
        
    except Exception as e:
        print(f"✗ Error: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    test_assistant()