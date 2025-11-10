"""
Views para el sistema de reportes dinámicos con IA
"""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db import connection
from django.http import HttpResponse
from django.utils import timezone
import time
import json

from .ai_service import AIReportService
# from .whisper_service import WhisperTranscriptionService
from .export_service import ReportExporter
from .models import ReportLog
from .serializers import ReportLogSerializer


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_report(request):
    """
    Endpoint principal para generar reportes dinámicos
    
    Body:
        {
            "prompt": "string (opcional si hay audio)",
            "audio": "file (opcional)",
            "export_format": "pdf|excel",
            "include_chart": boolean (default: true)
        }
    """
    
    user = request.user
    
    # Verificar permisos (admin o seller pueden generar reportes)
    if not user.is_superuser and user.user_type not in ['admin', 'seller']:
        return Response(
            {'error': 'No tienes permisos para generar reportes'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    start_time = time.time()
    
    try:
        # 1. Obtener prompt (texto o audio)
        prompt = request.data.get('prompt')
        audio_file = request.FILES.get('audio')
        export_format = request.data.get('export_format', 'pdf')
        include_chart = request.data.get('include_chart', True)
        
        transcription = None
        input_type = 'text'
        
        # Si hay audio, transcribir primero (TODO: Implementar Whisper)
        if audio_file:
            return Response(
                {'error': 'La transcripción de audio aún no está implementada. Por favor usa texto.'},
                status=status.HTTP_501_NOT_IMPLEMENTED
            )
            # input_type = 'audio'
            # whisper_service = WhisperTranscriptionService()
            # transcription_result = whisper_service.transcribe_audio(audio_file)
            # transcription = transcription_result['text']
            # prompt = transcription
        
        if not prompt:
            return Response(
                {'error': 'Debes proporcionar un prompt'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # 2. Interpretar prompt con IA
        ai_service = AIReportService()
        ai_response = ai_service.interpret_prompt(prompt)
        
        sql_query = ai_response['sql_query']
        report_type = ai_response['report_type']
        explanation = ai_response['explanation']
        suggested_chart = ai_response.get('suggested_chart_type', 'bar')
        tokens_used = ai_response.get('tokens_used', 0)
        
        # 3. Validar seguridad SQL
        ai_service.validate_sql_safety(sql_query)
        
        # 4. Ejecutar query
        with connection.cursor() as cursor:
            cursor.execute(sql_query)
            columns = [col[0] for col in cursor.description]
            results = [
                dict(zip(columns, row))
                for row in cursor.fetchall()
            ]
        
        # 5. Generar resumen con IA
        summary = ai_service.generate_report_summary(prompt, results)
        
        # 6. Preparar metadata
        report_metadata = {
            'title': f"Reporte de {report_type.title()}",
            'user': user.get_full_name() or user.email,
            'prompt': prompt,
            'explanation': explanation,
            'summary': summary,
            'generated_at': timezone.now().isoformat(),
        }
        
        # 7. Exportar según formato
        if export_format == 'excel':
            file_content = ReportExporter.to_excel(results, 'reporte', report_metadata)
            content_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            filename = f'reporte_{report_type}_{timezone.now().strftime("%Y%m%d_%H%M%S")}.xlsx'
        else:  # PDF
            chart_data = None
            if include_chart and len(results) > 0 and suggested_chart != 'none':
                # Intentar detectar campos para gráfico
                numeric_fields = [k for k, v in results[0].items() if isinstance(v, (int, float))]
                text_fields = [k for k, v in results[0].items() if isinstance(v, str)]
                
                if numeric_fields and text_fields:
                    chart_data = {
                        'type': suggested_chart,
                        'x_field': text_fields[0],
                        'y_field': numeric_fields[0],
                        'title': explanation
                    }
            
            file_content = ReportExporter.to_pdf(results, 'reporte', report_metadata, chart_data)
            content_type = 'application/pdf'
            filename = f'reporte_{report_type}_{timezone.now().strftime("%Y%m%d_%H%M%S")}.pdf'
        
        # 8. Guardar log
        execution_time = time.time() - start_time
        
        report_log = ReportLog.objects.create(
            user=user,
            report_type=report_type,
            input_type=input_type,
            original_prompt=prompt,
            transcription=transcription,
            generated_sql=sql_query,
            results_count=len(results),
            export_format=export_format,
            execution_time=execution_time,
            tokens_used=tokens_used,
            success=True
        )
        
        # 9. Devolver archivo
        response = HttpResponse(file_content.read(), content_type=content_type)
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        response['X-Report-Id'] = str(report_log.id)
        response['X-Execution-Time'] = str(execution_time)
        response['X-Results-Count'] = str(len(results))
        
        return response
        
    except Exception as e:
        # Log de error
        execution_time = time.time() - start_time
        
        ReportLog.objects.create(
            user=user,
            report_type='custom',
            input_type=input_type if 'input_type' in locals() else 'text',
            original_prompt=prompt if 'prompt' in locals() else 'N/A',
            generated_sql='',
            results_count=0,
            export_format=export_format,
            execution_time=execution_time,
            tokens_used=0,
            success=False,
            error_message=str(e)
        )
        
        return Response(
            {
                'error': 'Error al generar reporte',
                'detail': str(e)
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def preview_report(request):
    """
    Vista previa del reporte sin exportar (solo JSON)
    
    Body:
        {
            "prompt": "string",
            "limit": integer (default: 50)
        }
    """
    
    user = request.user
    
    if not user.is_superuser and user.user_type not in ['admin', 'seller']:
        return Response(
            {'error': 'No tienes permisos para generar reportes'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    try:
        prompt = request.data.get('prompt')
        limit = request.data.get('limit', 50)
        if not prompt:
            return Response(
                {'error': 'Debes proporcionar un prompt'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Interpretar prompt
        ai_service = AIReportService()
        ai_response = ai_service.interpret_prompt(prompt)
        
        sql_query = ai_response['sql_query']
        
        # Agregar LIMIT si no lo tiene
        if 'LIMIT' not in sql_query.upper():
            sql_query += f' LIMIT {limit}'
        
        # Validar y ejecutar
        ai_service.validate_sql_safety(sql_query)
        
        with connection.cursor() as cursor:
            cursor.execute(sql_query)
            columns = [col[0] for col in cursor.description]
            results = [
                dict(zip(columns, row))
                for row in cursor.fetchall()
            ]
        
        return Response({
            'success': True,
            'report_type': ai_response['report_type'],
            'explanation': ai_response['explanation'],
            'sql_query': sql_query,
            'results_count': len(results),
            'results': results,
            'suggested_chart_type': ai_response.get('suggested_chart_type'),
            'filters_applied': ai_response.get('filters_applied', [])
        })
        
    except Exception as e:
        return Response(
            {
                'error': 'Error al generar vista previa',
                'detail': str(e)
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def report_history(request):
    """
    Historial de reportes generados por el usuario
    """
    
    user = request.user
    
    if user.is_superuser or user.user_type == 'admin':
        # Admin o superuser ve todos los reportes
        reports = ReportLog.objects.all()
    else:
        # Vendedores solo ven sus propios reportes
        reports = ReportLog.objects.filter(user=user)
    
    # Filtros opcionales
    report_type = request.query_params.get('type')
    success_only = request.query_params.get('success_only')
    
    if report_type:
        reports = reports.filter(report_type=report_type)
    
    if success_only == 'true':
        reports = reports.filter(success=True)
    
    # Paginación simple
    page = int(request.query_params.get('page', 1))
    page_size = int(request.query_params.get('page_size', 20))
    
    start = (page - 1) * page_size
    end = start + page_size
    
    total = reports.count()
    reports_page = reports[start:end]
    
    serializer = ReportLogSerializer(reports_page, many=True)
    
    return Response({
        'total': total,
        'page': page,
        'page_size': page_size,
        'results': serializer.data
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def report_suggestions(request):
    """
    Sugerencias de reportes comunes
    """
    
    user = request.user
    
    suggestions = {
        'sales': [
            'Ventas del último mes',
            'Productos más vendidos esta semana',
            'Comparar ventas online vs tienda física del último trimestre',
            'Top 5 clientes con mayor gasto este año',
            'Ventas por día de la semana del último mes',
        ],
        'inventory': [
            'Productos con stock bajo (menos de 10 unidades)',
            'Productos sin ventas en el último mes',
            'Valor total del inventario actual',
        ],
        'financial': [
            'Ingresos totales del último mes',
            'Comparar ingresos mes a mes del último año',
            'Métodos de pago más usados',
        ],
        'customers': [
            'Nuevos clientes este mes',
            'Clientes con más pedidos',
            'Clientes inactivos (sin compras en 3 meses)',
        ]
    }
    
    # Si es vendedor, limitar sugerencias (superuser no se limita)
    if not user.is_superuser and user.user_type == 'seller':
        suggestions = {
            'sales': suggestions['sales'][:3],
            'financial': suggestions['financial'][:2]
        }
    
    return Response({
        'suggestions': suggestions,
        'user_role': user.user_type
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def manual_report_preview(request):
    """
    Vista previa de reportes manuales con filtros tradicionales
    
    Query params:
        - report_type: sales|products|inventory|categories|invoices|employees|customers
        - year: YYYY
        - month: 1-12
        - quarter: Q1|Q2|Q3|Q4
        - start_date: YYYY-MM-DD
        - end_date: YYYY-MM-DD
        - category: ID de categoría
        - status: pending|completed|cancelled
        - min_stock: número
        - max_stock: número
        - limit: número (default: 50)
    """
    
    user = request.user
    
    if not user.is_superuser and user.user_type not in ['admin', 'seller']:
        return Response(
            {'error': 'No tienes permisos para generar reportes'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    try:
        report_type = request.query_params.get('report_type', 'sales')
        limit = int(request.query_params.get('limit', 50))
        
        # Construir query según tipo de reporte
        query_builder = ManualReportQueryBuilder()
        sql_query = query_builder.build_query(report_type, request.query_params)
        
        # Agregar LIMIT
        if 'LIMIT' not in sql_query.upper():
            sql_query += f' LIMIT {limit}'
        
        # Ejecutar query
        with connection.cursor() as cursor:
            cursor.execute(sql_query)
            columns = [col[0] for col in cursor.description]
            results = [
                dict(zip(columns, row))
                for row in cursor.fetchall()
            ]
        
        # Generar resumen
        summary = query_builder.generate_summary(report_type, results, request.query_params)
        
        return Response({
            'success': True,
            'report_type': report_type,
            'total': len(results),
            'results': results,
            'summary': summary,
            'filters_applied': query_builder.get_applied_filters(request.query_params)
        })
        
    except Exception as e:
        return Response(
            {
                'error': 'Error al generar vista previa del reporte manual',
                'detail': str(e)
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def manual_report_generate(request):
    """
    Generar y descargar reporte manual con filtros
    
    Query params: (iguales que preview + export_format)
    """
    
    user = request.user
    
    if not user.is_superuser and user.user_type not in ['admin', 'seller']:
        return Response(
            {'error': 'No tienes permisos para generar reportes'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    start_time = time.time()
    
    try:
        report_type = request.query_params.get('report_type', 'sales')
        export_format = request.query_params.get('export_format', 'pdf')
        
        # Construir query
        query_builder = ManualReportQueryBuilder()
        sql_query = query_builder.build_query(report_type, request.query_params)
        
        # Ejecutar query
        with connection.cursor() as cursor:
            cursor.execute(sql_query)
            columns = [col[0] for col in cursor.description]
            results = [
                dict(zip(columns, row))
                for row in cursor.fetchall()
            ]
        
        # Generar resumen
        summary = query_builder.generate_summary(report_type, results, request.query_params)
        
        # Preparar metadata
        report_metadata = {
            'title': f"Reporte de {report_type.title()}",
            'user': user.get_full_name() or user.email,
            'generated_at': timezone.now().isoformat(),
            'filters': query_builder.get_applied_filters(request.query_params),
            'summary': summary,
        }
        
        # Exportar según formato
        if export_format == 'excel':
            file_content = ReportExporter.to_excel(results, report_type, report_metadata)
            content_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            filename = f'reporte_{report_type}_{timezone.now().strftime("%Y%m%d_%H%M%S")}.xlsx'
        else:  # PDF
            file_content = ReportExporter.to_pdf(results, report_type, report_metadata)
            content_type = 'application/pdf'
            filename = f'reporte_{report_type}_{timezone.now().strftime("%Y%m%d_%H%M%S")}.pdf'
        
        # Guardar log
        execution_time = time.time() - start_time
        
        ReportLog.objects.create(
            user=user,
            report_type=report_type,
            input_type='manual',
            original_prompt=f"Reporte manual: {report_type}",
            generated_sql=sql_query,
            results_count=len(results),
            export_format=export_format,
            execution_time=execution_time,
            tokens_used=0,
            success=True
        )
        
        # Devolver archivo
        response = HttpResponse(file_content.read(), content_type=content_type)
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        response['X-Execution-Time'] = str(execution_time)
        response['X-Results-Count'] = str(len(results))
        
        return response
        
    except Exception as e:
        execution_time = time.time() - start_time
        
        ReportLog.objects.create(
            user=user,
            report_type=report_type if 'report_type' in locals() else 'manual',
            input_type='manual',
            original_prompt='Reporte manual',
            generated_sql='',
            results_count=0,
            export_format=export_format if 'export_format' in locals() else 'pdf',
            execution_time=execution_time,
            tokens_used=0,
            success=False,
            error_message=str(e)
        )
        
        return Response(
            {
                'error': 'Error al generar reporte manual',
                'detail': str(e)
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# Helper class para construir queries de reportes manuales
class ManualReportQueryBuilder:
    """
    Construye queries SQL seguras para reportes manuales basados en filtros
    """
    
    def build_query(self, report_type, params):
        """Construir query según tipo de reporte y parámetros"""
        
        if report_type == 'sales':
            return self._build_sales_query(params)
        elif report_type == 'products':
            return self._build_products_query(params)
        elif report_type == 'inventory':
            return self._build_inventory_query(params)
        elif report_type == 'categories':
            return self._build_categories_query(params)
        elif report_type == 'invoices':
            return self._build_invoices_query(params)
        elif report_type == 'employees':
            return self._build_employees_query(params)
        elif report_type == 'customers':
            return self._build_customers_query(params)
        else:
            raise ValueError(f"Tipo de reporte no soportado: {report_type}")
    
    def _build_sales_query(self, params):
        """Query para reportes de ventas"""
        query = """
            SELECT 
                o.id as order_id,
                o.created_at as fecha,
                CONCAT(u.first_name, ' ', u.last_name) as cliente,
                o.total,
                o.status as estado,
                o.payment_method as metodo_pago
            FROM orders_order o
            LEFT JOIN authentication_user u ON o.user_id = u.id
            WHERE 1=1
        """
        query += self._add_date_filters(params, 'o.created_at')
        
        status = params.get('status')
        if status and status != 'all':
            query += f" AND o.status = '{status}'"
        
        query += " ORDER BY o.created_at DESC"
        return query
    
    def _build_products_query(self, params):
        """Query para reportes de productos"""
        query = """
            SELECT 
                p.id,
                p.name as nombre,
                p.sku,
                p.price as precio,
                p.stock,
                c.name as categoria,
                p.is_active as activo
            FROM products_product p
            LEFT JOIN products_category c ON p.category_id = c.id
            WHERE 1=1
        """
        
        category = params.get('category')
        if category and category != 'all':
            query += f" AND p.category_id = {category}"
        
        min_stock = params.get('min_stock')
        if min_stock:
            query += f" AND p.stock >= {min_stock}"
        
        max_stock = params.get('max_stock')
        if max_stock:
            query += f" AND p.stock <= {max_stock}"
        
        query += " ORDER BY p.name"
        return query
    
    def _build_inventory_query(self, params):
        """Query para reportes de inventario"""
        query = """
            SELECT 
                p.id,
                p.name as nombre,
                p.sku,
                p.stock,
                p.price as precio_unitario,
                (p.stock * p.price) as valor_total,
                c.name as categoria,
                CASE 
                    WHEN p.stock = 0 THEN 'Sin stock'
                    WHEN p.stock < 10 THEN 'Stock bajo'
                    WHEN p.stock < 50 THEN 'Stock medio'
                    ELSE 'Stock alto'
                END as nivel_stock
            FROM products_product p
            LEFT JOIN products_category c ON p.category_id = c.id
            WHERE p.is_active = TRUE
        """
        
        category = params.get('category')
        if category and category != 'all':
            query += f" AND p.category_id = {category}"
        
        min_stock = params.get('min_stock')
        if min_stock:
            query += f" AND p.stock >= {min_stock}"
        
        max_stock = params.get('max_stock')
        if max_stock:
            query += f" AND p.stock <= {max_stock}"
        
        query += " ORDER BY p.stock ASC"
        return query
    
    def _build_categories_query(self, params):
        """Query para reportes de categorías"""
        query = """
            SELECT 
                c.id,
                c.name as nombre,
                c.description as descripcion,
                COUNT(p.id) as total_productos,
                SUM(p.stock) as stock_total,
                c.is_active as activa
            FROM products_category c
            LEFT JOIN products_product p ON c.id = p.category_id
            WHERE 1=1
            GROUP BY c.id, c.name, c.description, c.is_active
            ORDER BY total_productos DESC
        """
        return query
    
    def _build_invoices_query(self, params):
        """Query para reportes de facturas"""
        query = """
            SELECT 
                i.id,
                i.invoice_number as numero_factura,
                i.created_at as fecha,
                CONCAT(u.first_name, ' ', u.last_name) as cliente,
                i.total,
                i.status as estado,
                i.payment_method as metodo_pago
            FROM orders_invoice i
            LEFT JOIN authentication_user u ON i.user_id = u.id
            WHERE 1=1
        """
        query += self._add_date_filters(params, 'i.created_at')
        
        status = params.get('status')
        if status and status != 'all':
            query += f" AND i.status = '{status}'"
        
        query += " ORDER BY i.created_at DESC"
        return query
    
    def _build_employees_query(self, params):
        """Query para reportes de empleados"""
        query = """
            SELECT 
                e.id,
                CONCAT(u.first_name, ' ', u.last_name) as nombre_completo,
                u.email,
                e.position as puesto,
                e.hire_date as fecha_contratacion,
                e.salary as salario,
                e.is_active as activo
            FROM employees_employee e
            LEFT JOIN authentication_user u ON e.user_id = u.id
            WHERE 1=1
        """
        query += " ORDER BY e.hire_date DESC"
        return query
    
    def _build_customers_query(self, params):
        """Query para reportes de clientes"""
        query = """
            SELECT 
                u.id,
                CONCAT(u.first_name, ' ', u.last_name) as nombre_completo,
                u.email,
                u.phone as telefono,
                u.date_joined as fecha_registro,
                COUNT(DISTINCT o.id) as total_ordenes,
                COALESCE(SUM(o.total), 0) as total_gastado,
                u.is_active as activo
            FROM authentication_user u
            LEFT JOIN orders_order o ON u.id = o.user_id
            WHERE u.role = 'customer'
            GROUP BY u.id, u.first_name, u.last_name, u.email, u.phone, u.date_joined, u.is_active
            ORDER BY total_gastado DESC
        """
        return query
    
    def _add_date_filters(self, params, date_field):
        """Agregar filtros de fecha a la query"""
        filters = ""
        
        year = params.get('year')
        month = params.get('month')
        quarter = params.get('quarter')
        start_date = params.get('start_date')
        end_date = params.get('end_date')
        
        if year:
            filters += f" AND EXTRACT(YEAR FROM {date_field}) = {year}"
            
            if month:
                filters += f" AND EXTRACT(MONTH FROM {date_field}) = {month}"
            elif quarter:
                quarter_months = {
                    'Q1': (1, 3),
                    'Q2': (4, 6),
                    'Q3': (7, 9),
                    'Q4': (10, 12)
                }
                if quarter in quarter_months:
                    start_m, end_m = quarter_months[quarter]
                    filters += f" AND EXTRACT(MONTH FROM {date_field}) BETWEEN {start_m} AND {end_m}"
        
        if start_date:
            filters += f" AND {date_field}::date >= '{start_date}'"
        
        if end_date:
            filters += f" AND {date_field}::date <= '{end_date}'"
        
        return filters
    
    def generate_summary(self, report_type, results, params):
        """Generar resumen del reporte"""
        if not results:
            return "No se encontraron resultados con los filtros aplicados."
        
        count = len(results)
        
        if report_type == 'sales':
            total = sum(float(r.get('total', 0)) for r in results)
            return f"Se encontraron {count} ventas con un total de ${total:,.2f}"
        
        elif report_type == 'products':
            total_stock = sum(int(r.get('stock', 0)) for r in results)
            return f"Se encontraron {count} productos con un stock total de {total_stock} unidades"
        
        elif report_type == 'inventory':
            total_value = sum(float(r.get('valor_total', 0)) for r in results)
            return f"Inventario de {count} productos con un valor total de ${total_value:,.2f}"
        
        elif report_type == 'customers':
            total_spent = sum(float(r.get('total_gastado', 0)) for r in results)
            return f"Se encontraron {count} clientes con un gasto total de ${total_spent:,.2f}"
        
        else:
            return f"Se encontraron {count} registros"
    
    def get_applied_filters(self, params):
        """Obtener lista de filtros aplicados"""
        filters = []
        
        if params.get('year'):
            filters.append(f"Año: {params['year']}")
        if params.get('month'):
            filters.append(f"Mes: {params['month']}")
        if params.get('quarter'):
            filters.append(f"Trimestre: {params['quarter']}")
        if params.get('start_date'):
            filters.append(f"Desde: {params['start_date']}")
        if params.get('end_date'):
            filters.append(f"Hasta: {params['end_date']}")
        if params.get('category') and params['category'] != 'all':
            filters.append(f"Categoría: {params['category']}")
        if params.get('status') and params['status'] != 'all':
            filters.append(f"Estado: {params['status']}")
        if params.get('min_stock'):
            filters.append(f"Stock mínimo: {params['min_stock']}")
        if params.get('max_stock'):
            filters.append(f"Stock máximo: {params['max_stock']}")
        
        return filters if filters else ['Sin filtros aplicados']
