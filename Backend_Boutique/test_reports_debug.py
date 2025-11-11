#!/usr/bin/env python
import os
import sys
import django

# Setup Django
sys.path.append('.')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'boutique_Main.settings')
django.setup()

from reports.ai_service import AIReportService

def test_reports_service():
    try:
        print("1. Creando servicio de reportes...")
        service = AIReportService()
        print("✓ Servicio de reportes creado")
        
        print("2. Probando interpretación de prompt...")
        result = service.interpret_prompt(
            user_prompt="Dame un resumen de ventas del último mes"
        )
        
        print("3. Resultado:")
        if result:
            print(f"   Report Type: {result.get('report_type', 'No type')}")
            print(f"   SQL Query length: {len(result.get('sql_query', ''))}")
            print(f"   SQL Query preview: {result.get('sql_query', '')[:100]}...")
            print(f"   Explanation length: {len(result.get('explanation', ''))}")
            print(f"   Chart Type: {result.get('suggested_chart_type', 'No chart')}")
        else:
            print("   No result returned")
        
        return result
        
    except Exception as e:
        print(f"✗ Error: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    test_reports_service()