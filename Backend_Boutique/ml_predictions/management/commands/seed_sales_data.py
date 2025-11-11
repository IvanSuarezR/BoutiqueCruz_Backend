"""
Comando para poblar datos de ventas optimizado para ML
Usa bulk_create y SQL directo para fechas históricas
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db import connection, transaction
from datetime import datetime, timedelta
from decimal import Decimal
import random

from orders.models import Order, OrderItem, Address, ShippingMethod, PaymentMethod
from inventory.models import Product, ProductVariant, Category

User = get_user_model()


class Command(BaseCommand):
    help = 'Pobla datos de ventas con fechas históricas correctas para ML (6 meses)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days',
            type=int,
            default=180,
            help='Días de historial (default: 180 = 6 meses)'
        )

    def handle(self, *args, **options):
        days = options['days']
        
        self.stdout.write(self.style.SUCCESS('🚀 Iniciando población de datos de ventas...'))
        
        with transaction.atomic():
            # 1. Limpiar datos existentes
            self.stdout.write('Limpiando datos existentes...')
            OrderItem.objects.all().delete()
            Order.objects.all().delete()
            self.stdout.write(self.style.SUCCESS('  ✓ Datos limpiados'))
            
            # 2. Verificar/crear datos base
            shipping_methods = self.ensure_shipping_methods()
            payment_methods = self.ensure_payment_methods()
            categories = self.ensure_categories()
            products = self.ensure_products(categories)
            customers = self.ensure_customers()
            addresses = self.ensure_addresses(customers)
            
            # 3. Crear órdenes con fechas históricas
            self.create_historical_orders(
                days=days,
                customers=customers,
                products=products,
                shipping_methods=shipping_methods,
                payment_methods=payment_methods,
                addresses=addresses
            )
        
        self.stdout.write(self.style.SUCCESS('✅ ¡Población de datos completada!'))

    def ensure_shipping_methods(self):
        """Asegura que existan métodos de envío"""
        self.stdout.write('Verificando métodos de envío...')
        
        methods_data = [
            {'code': 'standard', 'name': 'Envío Estándar', 'base_cost': Decimal('15.00')},
            {'code': 'express', 'name': 'Envío Express', 'base_cost': Decimal('30.00')},
            {'code': 'pickup', 'name': 'Retiro en Tienda', 'base_cost': Decimal('0.00')},
        ]
        
        for data in methods_data:
            ShippingMethod.objects.get_or_create(code=data['code'], defaults=data)
        
        methods = list(ShippingMethod.objects.all())
        self.stdout.write(self.style.SUCCESS(f'  ✓ {len(methods)} métodos de envío'))
        return methods

    def ensure_payment_methods(self):
        """Asegura que existan métodos de pago"""
        self.stdout.write('Verificando métodos de pago...')
        
        methods_data = [
            {'code': 'cash', 'name': 'Efectivo', 'type': 'OFFLINE'},
            {'code': 'qr', 'name': 'QR Simple/Tigo Money', 'type': 'GATEWAY'},
            {'code': 'transfer', 'name': 'Transferencia Bancaria', 'type': 'OFFLINE'},
            {'code': 'card', 'name': 'Tarjeta', 'type': 'GATEWAY'},
        ]
        
        for data in methods_data:
            PaymentMethod.objects.get_or_create(code=data['code'], defaults=data)
        
        methods = list(PaymentMethod.objects.all())
        self.stdout.write(self.style.SUCCESS(f'  ✓ {len(methods)} métodos de pago'))
        return methods

    def ensure_categories(self):
        """Asegura que existan categorías"""
        self.stdout.write('Verificando categorías...')
        
        if Category.objects.count() == 0:
            categories_data = [
                {'name': 'Camisas Hombre', 'gender': 'M', 'kind': 'V', 'sizes': ['S', 'M', 'L', 'XL']},
                {'name': 'Pantalones Hombre', 'gender': 'M', 'kind': 'V', 'sizes': ['30', '32', '34', '36']},
                {'name': 'Vestidos Mujer', 'gender': 'F', 'kind': 'V', 'sizes': ['XS', 'S', 'M', 'L']},
                {'name': 'Blusas Mujer', 'gender': 'F', 'kind': 'V', 'sizes': ['XS', 'S', 'M', 'L']},
                {'name': 'Jeans Unisex', 'gender': 'U', 'kind': 'V', 'sizes': ['28', '30', '32', '34']},
                {'name': 'Zapatos Hombre', 'gender': 'M', 'kind': 'Z', 'sizes': ['40', '41', '42', '43']},
                {'name': 'Zapatos Mujer', 'gender': 'F', 'kind': 'Z', 'sizes': ['36', '37', '38', '39']},
            ]
            
            for cat_data in categories_data:
                Category.objects.create(**cat_data)
        
        categories = list(Category.objects.all())
        self.stdout.write(self.style.SUCCESS(f'  ✓ {len(categories)} categorías'))
        return categories

    def ensure_products(self, categories):
        """Asegura que existan productos"""
        self.stdout.write('Verificando productos...')
        
        if Product.objects.count() < 20:
            products_to_create = []
            counter = Product.objects.count() + 1
            
            for category in categories:
                for i in range(4):  # 4 productos por categoría
                    sku = f'PROD{counter:04d}'
                    product = Product(
                        sku=sku,
                        name=f'{category.name} Modelo {i+1}',
                        category=category,
                        gender=category.gender,
                        price=Decimal(random.randint(150, 500)),
                        stock=random.randint(50, 200),
                        colors=['Negro', 'Azul', 'Blanco'] if random.random() > 0.5 else ['Negro'],
                        sizes=category.sizes,
                        is_active=True
                    )
                    products_to_create.append(product)
                    counter += 1
            
            Product.objects.bulk_create(products_to_create, ignore_conflicts=True)
        
        products = list(Product.objects.filter(is_active=True))
        self.stdout.write(self.style.SUCCESS(f'  ✓ {len(products)} productos'))
        return products

    def ensure_customers(self):
        """Asegura que existan clientes"""
        self.stdout.write('Verificando clientes...')
        
        existing = User.objects.filter(user_type='customer').count()
        
        if existing < 30:
            nombres = ['Juan', 'María', 'Carlos', 'Ana', 'Luis', 'Sofia', 'Pedro', 'Laura', 
                      'Miguel', 'Carmen', 'Jorge', 'Elena', 'Roberto', 'Patricia', 'Diego']
            apellidos = ['García', 'Rodríguez', 'Martínez', 'López', 'González', 'Pérez',
                        'Sánchez', 'Ramírez', 'Torres', 'Flores', 'Cruz', 'Morales']
            
            customers_to_create = []
            for i in range(30 - existing):
                nombre = random.choice(nombres)
                apellido = random.choice(apellidos)
                username = f'{nombre.lower()}.{apellido.lower()}{existing + i + 1}'
                
                customer = User(
                    username=username,
                    email=f'{username}@example.com',
                    first_name=nombre,
                    last_name=apellido,
                    user_type='customer',
                    identification_number=str(random.randint(1000000, 9999999)),
                    phone=f'7{random.randint(1000000, 9999999)}',
                    is_active=True,
                )
                customer.set_password('password123')
                customers_to_create.append(customer)
            
            User.objects.bulk_create(customers_to_create, ignore_conflicts=True)
        
        customers = list(User.objects.filter(user_type='customer', is_active=True))
        self.stdout.write(self.style.SUCCESS(f'  ✓ {len(customers)} clientes'))
        return customers

    def ensure_addresses(self, customers):
        """Asegura que los clientes tengan direcciones"""
        self.stdout.write('Verificando direcciones...')
        
        ciudades = ['La Paz', 'Santa Cruz', 'Cochabamba', 'Sucre', 'Oruro', 'Potosí']
        
        addresses_to_create = []
        for customer in customers:
            if not Address.objects.filter(user=customer).exists():
                address = Address(
                    user=customer,
                    full_name=customer.get_full_name(),
                    phone=customer.phone or f'7{random.randint(1000000, 9999999)}',
                    line1=f'Calle {random.randint(1, 100)} #{random.randint(1, 500)}',
                    city=random.choice(ciudades),
                    country='BO',
                    is_default=True
                )
                addresses_to_create.append(address)
        
        Address.objects.bulk_create(addresses_to_create, ignore_conflicts=True)
        
        addresses = {addr.user_id: addr for addr in Address.objects.all()}
        self.stdout.write(self.style.SUCCESS(f'  ✓ {len(addresses)} direcciones'))
        return addresses

    def create_historical_orders(self, days, customers, products, shipping_methods, 
                                payment_methods, addresses):
        """Crea órdenes con fechas históricas usando SQL directo"""
        self.stdout.write(f'Creando {days} días de historial de ventas...')
        
        now = timezone.now()
        start_date = now - timedelta(days=days)
        
        orders_data = []
        items_data = []
        total_orders = 0
        
        # Generar datos de órdenes (en memoria)
        for day_offset in range(days):
            current_date = start_date + timedelta(days=day_offset)
            
            # Variación: más ventas en fin de semana
            day_of_week = current_date.weekday()
            if day_of_week >= 5:  # Sábado/Domingo
                daily_orders = random.randint(12, 18)
            else:
                daily_orders = random.randint(8, 14)
            
            for _ in range(daily_orders):
                customer = random.choice(customers)
                address = addresses.get(customer.id)
                
                if not address:
                    continue
                
                # Fecha exacta de la orden
                order_datetime = current_date + timedelta(
                    hours=random.randint(9, 20),
                    minutes=random.randint(0, 59),
                    seconds=random.randint(0, 59)
                )
                
                # Seleccionar productos (1-4 items)
                num_items = random.randint(1, 4)
                selected_products = random.sample(products, min(num_items, len(products)))
                
                # Calcular totales
                subtotal = Decimal('0')
                total_items_qty = 0
                order_items = []
                
                for product in selected_products:
                    quantity = random.randint(1, 3)
                    unit_price = product.price
                    line_subtotal = unit_price * quantity
                    
                    subtotal += line_subtotal
                    total_items_qty += quantity
                    
                    order_items.append({
                        'product_id': product.id,
                        'product_name': product.name,
                        'sku': product.sku,
                        'unit_price': unit_price,
                        'quantity': quantity,
                        'line_subtotal': line_subtotal
                    })
                
                shipping_method = random.choice(shipping_methods)
                payment_method = random.choice(payment_methods)
                shipping_cost = shipping_method.base_cost
                grand_total = subtotal + shipping_cost
                
                # Datos de la orden
                order_data = {
                    'user_id': customer.id,
                    'status': random.choices(
                        ['DELIVERED', 'PAID', 'AWAITING_DISPATCH', 'SHIPPED'],
                        weights=[70, 15, 10, 5]
                    )[0],
                    'currency': 'BOB',
                    'total_items': total_items_qty,
                    'subtotal': subtotal,
                    'shipping_cost': shipping_cost,
                    'payment_fee': Decimal('0'),
                    'tax_total': Decimal('0'),
                    'grand_total': grand_total,
                    'shipping_method_id': shipping_method.id,
                    'payment_method_id': payment_method.id,
                    'shipping_address_id': address.id,
                    'inventory_deducted': True,
                    'created_at': order_datetime,
                    'updated_at': order_datetime,
                    'items': order_items  # Temporal para asociar items después
                }
                
                orders_data.append(order_data)
                total_orders += 1
        
        # Insertar órdenes en batch usando SQL directo
        self.stdout.write(f'  Insertando {total_orders} órdenes...')
        
        with connection.cursor() as cursor:
            # Insertar órdenes
            for order_data in orders_data:
                items = order_data.pop('items')
                
                cursor.execute("""
                    INSERT INTO orders_order 
                    (user_id, status, currency, total_items, subtotal, shipping_cost, 
                     payment_fee, tax_total, grand_total, shipping_method_id, 
                     payment_method_id, shipping_address_id, inventory_deducted, 
                     inventory_restored, created_at, updated_at, placed_at, paid_at, 
                     canceled_at, external_payment_id, external_payment_status, 
                     notes, customer_note, shipping_address_snapshot)
                    VALUES 
                    (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 
                     NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
                    RETURNING id
                """, [
                    order_data['user_id'],
                    order_data['status'],
                    order_data['currency'],
                    order_data['total_items'],
                    order_data['subtotal'],
                    order_data['shipping_cost'],
                    order_data['payment_fee'],
                    order_data['tax_total'],
                    order_data['grand_total'],
                    order_data['shipping_method_id'],
                    order_data['payment_method_id'],
                    order_data['shipping_address_id'],
                    order_data['inventory_deducted'],
                    False,  # inventory_restored
                    order_data['created_at'],
                    order_data['updated_at']
                ])
                
                order_id = cursor.fetchone()[0]
                
                # Insertar items de esta orden
                for item in items:
                    cursor.execute("""
                        INSERT INTO orders_orderitem
                        (order_id, product_id, variant_id, product_name_cache, 
                         sku_cache, unit_price, quantity, line_subtotal)
                        VALUES (%s, %s, NULL, %s, %s, %s, %s, %s)
                    """, [
                        order_id,
                        item['product_id'],
                        item['product_name'],
                        item['sku'],
                        item['unit_price'],
                        item['quantity'],
                        item['line_subtotal']
                    ])
        
        self.stdout.write(self.style.SUCCESS(f'  ✓ {total_orders} órdenes creadas'))
        
        # Verificar resultado
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT DATE(created_at) as date, COUNT(*) as count 
                FROM orders_order 
                GROUP BY DATE(created_at) 
                ORDER BY date
                LIMIT 5
            """)
            sample = cursor.fetchall()
            
            self.stdout.write('  Muestra de datos:')
            for date, count in sample:
                self.stdout.write(f'    {date}: {count} órdenes')
