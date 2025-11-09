from accounts.models import CustomUser, Role
from inventory.models import Category, Product, ProductVariant
from django.db import transaction

print("Iniciando poblacion de datos...")

@transaction.atomic
def populate():
    # Crear admin
    admin, _ = CustomUser.objects.get_or_create(
        username='admin_boutique',
        defaults={
            'email': 'admin@boutiquecruz.com',
            'first_name': 'Maria',
            'last_name': 'Cruz',
            'identification_number': '1234567-LP',
            'phone': '77712345',
            'gender': 'F',
            'user_type': 'admin',
        }
    )
    admin.set_password('admin123')
    admin.save()
    print("Admin creado")
    
    # Crear categorias
    cat1, _ = Category.objects.get_or_create(
        name='Camisas Formales Hombre',
        defaults={
            'description': 'Camisas de vestir para caballero',
            'gender': 'M',
            'kind': 'V',
            'sizes': ['S', 'M', 'L', 'XL', 'XXL']
        }
    )
    
    cat2, _ = Category.objects.get_or_create(
        name='Vestidos Mujer',
        defaults={
            'description': 'Vestidos para toda ocasion',
            'gender': 'F',
            'kind': 'V',
            'sizes': ['XS', 'S', 'M', 'L', 'XL']
        }
    )
    
    cat3, _ = Category.objects.get_or_create(
        name='Zapatos Formales Hombre',
        defaults={
            'description': 'Zapatos de cuero para caballero',
            'gender': 'M',
            'kind': 'Z',
            'sizes': ['39', '40', '41', '42', '43', '44']
        }
    )
    
    cat4, _ = Category.objects.get_or_create(
        name='Tacones Mujer',
        defaults={
            'description': 'Tacones elegantes para dama',
            'gender': 'F',
            'kind': 'Z',
            'sizes': ['35', '36', '37', '38', '39', '40']
        }
    )
    
    print("Categorias creadas")
    
    # Crear productos
    p1, created = Product.objects.get_or_create(
        sku='CAM-H-001',
        defaults={
            'name': 'Camisa Blanca Slim Fit',
            'category': cat1,
            'price': 280.00,
            'description': 'Camisa blanca de corte slim fit, 100% algodon egipcio',
            'colors': ['Blanco'],
            'sizes': ['S', 'M', 'L', 'XL'],
            'stock': 40,
        }
    )
    if created:
        ProductVariant.objects.create(product=p1, size='S', stock=8, sku='CAM-H-001-S')
        ProductVariant.objects.create(product=p1, size='M', stock=15, sku='CAM-H-001-M')
        ProductVariant.objects.create(product=p1, size='L', stock=12, sku='CAM-H-001-L')
        ProductVariant.objects.create(product=p1, size='XL', stock=5, sku='CAM-H-001-XL')
    
    p2, created = Product.objects.get_or_create(
        sku='VES-M-001',
        defaults={
            'name': 'Vestido Negro Coctel',
            'category': cat2,
            'price': 650.00,
            'description': 'Vestido negro corte A-line, perfecto para eventos de noche',
            'colors': ['Negro'],
            'sizes': ['XS', 'S', 'M', 'L'],
            'stock': 28,
        }
    )
    if created:
        ProductVariant.objects.create(product=p2, size='XS', stock=4, sku='VES-M-001-XS')
        ProductVariant.objects.create(product=p2, size='S', stock=8, sku='VES-M-001-S')
        ProductVariant.objects.create(product=p2, size='M', stock=10, sku='VES-M-001-M')
        ProductVariant.objects.create(product=p2, size='L', stock=6, sku='VES-M-001-L')
    
    p3, created = Product.objects.get_or_create(
        sku='ZAP-H-001',
        defaults={
            'name': 'Zapato Oxford Negro',
            'category': cat3,
            'price': 550.00,
            'description': 'Zapato Oxford de cuero genuino. Ideal para traje',
            'colors': ['Negro'],
            'sizes': ['40', '41', '42', '43'],
            'stock': 36,
        }
    )
    if created:
        ProductVariant.objects.create(product=p3, size='40', stock=6, sku='ZAP-H-001-40')
        ProductVariant.objects.create(product=p3, size='41', stock=10, sku='ZAP-H-001-41')
        ProductVariant.objects.create(product=p3, size='42', stock=12, sku='ZAP-H-001-42')
        ProductVariant.objects.create(product=p3, size='43', stock=8, sku='ZAP-H-001-43')
    
    p4, created = Product.objects.get_or_create(
        sku='TAC-M-001',
        defaults={
            'name': 'Tacon Stiletto Negro',
            'category': cat4,
            'price': 580.00,
            'description': 'Tacon alto tipo stiletto en negro. 10 cm de altura',
            'colors': ['Negro'],
            'sizes': ['36', '37', '38', '39'],
            'stock': 29,
        }
    )
    if created:
        ProductVariant.objects.create(product=p4, size='36', stock=6, sku='TAC-M-001-36')
        ProductVariant.objects.create(product=p4, size='37', stock=10, sku='TAC-M-001-37')
        ProductVariant.objects.create(product=p4, size='38', stock=8, sku='TAC-M-001-38')
        ProductVariant.objects.create(product=p4, size='39', stock=5, sku='TAC-M-001-39')
    
    print("Productos creados")
    print("Completado!")

populate()
