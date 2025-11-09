"""
Script para poblar la base de datos con datos realistas para Boutique Cruz
Ejecutar con: python manage.py shell < populate_data.py
O: python manage.py shell
>>> exec(open('populate_data.py').read())
"""

from accounts.models import CustomUser, Role
from inventory.models import Category, Product, ProductVariant
from django.db import transaction
import random

print("=" * 60)
print("Iniciando población de datos para Boutique Cruz")
print("=" * 60)

@transaction.atomic
def populate_all():
    # 1. CREAR USUARIOS
    print("\n1. Creando usuarios...")
    
    # Admin/Dueño
    admin, created = CustomUser.objects.get_or_create(
        username='admin_boutique',
        defaults={
            'email': 'admin@boutiquecruz.com',
            'first_name': 'María',
            'last_name': 'Cruz',
            'identification_number': '1234567-LP',
            'phone': '77712345',
            'gender': 'F',
            'address': 'Av. 6 de Agosto #2350, La Paz',
            'user_type': 'admin',
            'is_staff': False,
        }
    )
    if created:
        admin.set_password('admin123')
        admin.save()
        print(f"  ✓ Admin creado: {admin.username}")
    
    # Vendedores
    vendedores_data = [
        {
            'username': 'vendedor_juan',
            'email': 'juan@boutiquecruz.com',
            'first_name': 'Juan',
            'last_name': 'Pérez',
            'identification_number': '2345678-LP',
            'phone': '77723456',
            'gender': 'M',
            'address': 'Zona Miraflores, La Paz',
            'user_type': 'seller',
        },
        {
            'username': 'vendedor_ana',
            'email': 'ana@boutiquecruz.com',
            'first_name': 'Ana',
            'last_name': 'Rojas',
            'identification_number': '3456789-LP',
            'phone': '77734567',
            'gender': 'F',
            'address': 'Zona Sopocachi, La Paz',
            'user_type': 'seller',
        },
    ]
    
    for data in vendedores_data:
        user, created = CustomUser.objects.get_or_create(
            username=data['username'],
            defaults=data
        )
        if created:
            user.set_password('vendedor123')
            user.save()
            print(f"  ✓ Vendedor creado: {user.username}")
    
    # Clientes
    clientes_data = [
        {
            'username': 'cliente_pedro',
            'email': 'pedro.gomez@gmail.com',
            'first_name': 'Pedro',
            'last_name': 'Gómez',
            'identification_number': '4567890-LP',
            'phone': '77745678',
            'gender': 'M',
            'address': 'Zona Sur, La Paz',
            'user_type': 'customer',
        },
        {
            'username': 'cliente_lucia',
            'email': 'lucia.martinez@gmail.com',
            'first_name': 'Lucía',
            'last_name': 'Martínez',
            'identification_number': '5678901-LP',
            'phone': '77756789',
            'gender': 'F',
            'address': 'Zona Calacoto, La Paz',
            'user_type': 'customer',
        },
        {
            'username': 'cliente_carlos',
            'email': 'carlos.lopez@gmail.com',
            'first_name': 'Carlos',
            'last_name': 'López',
            'identification_number': '6789012-LP',
            'phone': '77767890',
            'gender': 'M',
            'address': 'Zona Obrajes, La Paz',
            'user_type': 'customer',
        },
    ]
    
    for data in clientes_data:
        user, created = CustomUser.objects.get_or_create(
            username=data['username'],
            defaults=data
        )
        if created:
            user.set_password('cliente123')
            user.save()
            print(f"  ✓ Cliente creado: {user.username}")
    
    # 2. CREAR CATEGORÍAS
    print("\n2. Creando categorías...")
    
    categorias_data = [
        # VESTIR - HOMBRE
        {
            'name': 'Camisas Formales Hombre',
            'description': 'Camisas de vestir para caballero, perfectas para oficina y eventos',
            'gender': 'M',
            'kind': 'V',
            'sizes': ['S', 'M', 'L', 'XL', 'XXL']
        },
        {
            'name': 'Pantalones Casuales Hombre',
            'description': 'Pantalones cómodos y modernos para el día a día',
            'gender': 'M',
            'kind': 'V',
            'sizes': ['28', '30', '32', '34', '36', '38']
        },
        {
            'name': 'Trajes Hombre',
            'description': 'Trajes completos de dos y tres piezas',
            'gender': 'M',
            'kind': 'V',
            'sizes': ['S', 'M', 'L', 'XL']
        },
        {
            'name': 'Polos Hombre',
            'description': 'Polos deportivos y casuales',
            'gender': 'M',
            'kind': 'V',
            'sizes': ['S', 'M', 'L', 'XL', 'XXL']
        },
        
        # VESTIR - MUJER
        {
            'name': 'Blusas Elegantes Mujer',
            'description': 'Blusas de alta calidad para dama',
            'gender': 'F',
            'kind': 'V',
            'sizes': ['XS', 'S', 'M', 'L', 'XL']
        },
        {
            'name': 'Vestidos Mujer',
            'description': 'Vestidos para toda ocasión, casuales y de gala',
            'gender': 'F',
            'kind': 'V',
            'sizes': ['XS', 'S', 'M', 'L', 'XL']
        },
        {
            'name': 'Faldas Mujer',
            'description': 'Faldas largas y cortas, varios estilos',
            'gender': 'F',
            'kind': 'V',
            'sizes': ['XS', 'S', 'M', 'L', 'XL']
        },
        {
            'name': 'Pantalones Mujer',
            'description': 'Pantalones de vestir y casuales',
            'gender': 'F',
            'kind': 'V',
            'sizes': ['26', '28', '30', '32', '34']
        },
        
        # CALZADO - HOMBRE
        {
            'name': 'Zapatos Formales Hombre',
            'description': 'Zapatos de cuero para caballero',
            'gender': 'M',
            'kind': 'Z',
            'sizes': ['39', '40', '41', '42', '43', '44']
        },
        {
            'name': 'Zapatillas Deportivas Hombre',
            'description': 'Calzado deportivo y casual',
            'gender': 'M',
            'kind': 'Z',
            'sizes': ['39', '40', '41', '42', '43', '44']
        },
        
        # CALZADO - MUJER
        {
            'name': 'Tacones Mujer',
            'description': 'Tacones elegantes para dama',
            'gender': 'F',
            'kind': 'Z',
            'sizes': ['35', '36', '37', '38', '39', '40']
        },
        {
            'name': 'Botas Mujer',
            'description': 'Botas de temporada y casuales',
            'gender': 'F',
            'kind': 'Z',
            'sizes': ['35', '36', '37', '38', '39', '40']
        },
        {
            'name': 'Zapatillas Mujer',
            'description': 'Zapatillas cómodas para el día a día',
            'gender': 'F',
            'kind': 'Z',
            'sizes': ['35', '36', '37', '38', '39', '40']
        },
        
        # UNISEX
        {
            'name': 'Accesorios',
            'description': 'Bufandas, gorros, guantes y más',
            'gender': 'U',
            'kind': 'V',
            'sizes': ['Único']
        },
    ]
    
    categorias_creadas = {}
    for cat_data in categorias_data:
        cat, created = Category.objects.get_or_create(
            name=cat_data['name'],
            defaults=cat_data
        )
        categorias_creadas[cat.name] = cat
        if created:
            print(f"  ✓ Categoría creada: {cat.name}")
    
    # 3. CREAR PRODUCTOS
    print("\n3. Creando productos...")
    
    productos_data = [
        # CAMISAS FORMALES HOMBRE
        {
            'sku': 'CAM-H-001',
            'name': 'Camisa Blanca Slim Fit',
            'category': 'Camisas Formales Hombre',
            'price': 280.00,
            'description': 'Camisa blanca de corte slim fit, 100% algodón egipcio. Ideal para oficina y eventos formales.',
            'colors': ['Blanco'],
            'sizes': ['S', 'M', 'L', 'XL', 'XXL'],
            'variants': [
                {'size': 'S', 'stock': 8},
                {'size': 'M', 'stock': 15},
                {'size': 'L', 'stock': 12},
                {'size': 'XL', 'stock': 10},
                {'size': 'XXL', 'stock': 5},
            ]
        },
        {
            'sku': 'CAM-H-002',
            'name': 'Camisa Celeste Rayas',
            'category': 'Camisas Formales Hombre',
            'price': 295.00,
            'description': 'Camisa celeste con rayas finas, cuello italiano. Perfecta para el día a día ejecutivo.',
            'colors': ['Celeste', 'Blanco'],
            'sizes': ['S', 'M', 'L', 'XL'],
            'variants': [
                {'size': 'S', 'stock': 6},
                {'size': 'M', 'stock': 12},
                {'size': 'L', 'stock': 10},
                {'size': 'XL', 'stock': 7},
            ]
        },
        {
            'sku': 'CAM-H-003',
            'name': 'Camisa Negra Satinada',
            'category': 'Camisas Formales Hombre',
            'price': 320.00,
            'description': 'Camisa negra con acabado satinado. Elegante para eventos nocturnos.',
            'colors': ['Negro'],
            'sizes': ['M', 'L', 'XL'],
            'variants': [
                {'size': 'M', 'stock': 8},
                {'size': 'L', 'stock': 6},
                {'size': 'XL', 'stock': 4},
            ]
        },
        
        # PANTALONES HOMBRE
        {
            'sku': 'PAN-H-001',
            'name': 'Jean Azul Oscuro Slim',
            'category': 'Pantalones Casuales Hombre',
            'price': 350.00,
            'description': 'Jean de mezclilla azul oscuro, corte slim. Cómodo y versátil.',
            'colors': ['Azul Oscuro'],
            'sizes': ['28', '30', '32', '34', '36'],
            'variants': [
                {'size': '28', 'stock': 5},
                {'size': '30', 'stock': 12},
                {'size': '32', 'stock': 15},
                {'size': '34', 'stock': 10},
                {'size': '36', 'stock': 6},
            ]
        },
        {
            'sku': 'PAN-H-002',
            'name': 'Pantalón Caqui Chino',
            'category': 'Pantalones Casuales Hombre',
            'price': 380.00,
            'description': 'Pantalón tipo chino en color caqui. Ideal para look smart casual.',
            'colors': ['Caqui', 'Beige'],
            'sizes': ['30', '32', '34', '36'],
            'variants': [
                {'size': '30', 'stock': 8},
                {'size': '32', 'stock': 14},
                {'size': '34', 'stock': 11},
                {'size': '36', 'stock': 7},
            ]
        },
        
        # POLOS HOMBRE
        {
            'sku': 'POL-H-001',
            'name': 'Polo Piqué Negro',
            'category': 'Polos Hombre',
            'price': 180.00,
            'description': 'Polo clásico de piqué en negro. Cuello y puños en contraste.',
            'colors': ['Negro', 'Blanco', 'Azul Marino'],
            'sizes': ['S', 'M', 'L', 'XL', 'XXL'],
            'variants': [
                {'size': 'S', 'stock': 10},
                {'size': 'M', 'stock': 20},
                {'size': 'L', 'stock': 18},
                {'size': 'XL', 'stock': 12},
                {'size': 'XXL', 'stock': 8},
            ]
        },
        {
            'sku': 'POL-H-002',
            'name': 'Polo Rayas Horizontales',
            'category': 'Polos Hombre',
            'price': 195.00,
            'description': 'Polo con rayas horizontales, estilo náutico. 100% algodón.',
            'colors': ['Azul/Blanco', 'Rojo/Blanco'],
            'sizes': ['M', 'L', 'XL'],
            'variants': [
                {'size': 'M', 'stock': 15},
                {'size': 'L', 'stock': 12},
                {'size': 'XL', 'stock': 8},
            ]
        },
        
        # BLUSAS MUJER
        {
            'sku': 'BLU-M-001',
            'name': 'Blusa Seda Blanca',
            'category': 'Blusas Elegantes Mujer',
            'price': 420.00,
            'description': 'Blusa de seda natural en color blanco. Elegante y sofisticada.',
            'colors': ['Blanco', 'Crema'],
            'sizes': ['XS', 'S', 'M', 'L'],
            'variants': [
                {'size': 'XS', 'stock': 6},
                {'size': 'S', 'stock': 12},
                {'size': 'M', 'stock': 14},
                {'size': 'L', 'stock': 8},
            ]
        },
        {
            'sku': 'BLU-M-002',
            'name': 'Blusa Estampada Flores',
            'category': 'Blusas Elegantes Mujer',
            'price': 380.00,
            'description': 'Blusa con estampado floral, manga larga. Perfecta para primavera.',
            'colors': ['Multicolor'],
            'sizes': ['S', 'M', 'L', 'XL'],
            'variants': [
                {'size': 'S', 'stock': 10},
                {'size': 'M', 'stock': 15},
                {'size': 'L', 'stock': 12},
                {'size': 'XL', 'stock': 6},
            ]
        },
        
        # VESTIDOS MUJER
        {
            'sku': 'VES-M-001',
            'name': 'Vestido Negro Coctel',
            'category': 'Vestidos Mujer',
            'price': 650.00,
            'description': 'Vestido negro corte A-line, perfecto para eventos de noche.',
            'colors': ['Negro'],
            'sizes': ['XS', 'S', 'M', 'L'],
            'variants': [
                {'size': 'XS', 'stock': 4},
                {'size': 'S', 'stock': 8},
                {'size': 'M', 'stock': 10},
                {'size': 'L', 'stock': 6},
            ]
        },
        {
            'sku': 'VES-M-002',
            'name': 'Vestido Floreado Largo',
            'category': 'Vestidos Mujer',
            'price': 580.00,
            'description': 'Vestido largo con estampado floral. Ideal para eventos al aire libre.',
            'colors': ['Rosa/Verde', 'Azul/Blanco'],
            'sizes': ['S', 'M', 'L'],
            'variants': [
                {'size': 'S', 'stock': 7},
                {'size': 'M', 'stock': 12},
                {'size': 'L', 'stock': 8},
            ]
        },
        {
            'sku': 'VES-M-003',
            'name': 'Vestido Rojo Ajustado',
            'category': 'Vestidos Mujer',
            'price': 720.00,
            'description': 'Vestido rojo ajustado con escote en V. Muy elegante.',
            'colors': ['Rojo'],
            'sizes': ['XS', 'S', 'M', 'L'],
            'variants': [
                {'size': 'XS', 'stock': 5},
                {'size': 'S', 'stock': 9},
                {'size': 'M', 'stock': 7},
                {'size': 'L', 'stock': 4},
            ]
        },
        
        # PANTALONES MUJER
        {
            'sku': 'PAN-M-001',
            'name': 'Jean Negro Skinny',
            'category': 'Pantalones Mujer',
            'price': 420.00,
            'description': 'Jean negro skinny de tiro alto. Moldea la figura perfectamente.',
            'colors': ['Negro'],
            'sizes': ['26', '28', '30', '32'],
            'variants': [
                {'size': '26', 'stock': 8},
                {'size': '28', 'stock': 15},
                {'size': '30', 'stock': 12},
                {'size': '32', 'stock': 7},
            ]
        },
        {
            'sku': 'PAN-M-002',
            'name': 'Pantalón Palazzo Beige',
            'category': 'Pantalones Mujer',
            'price': 480.00,
            'description': 'Pantalón palazzo de pierna ancha en tono beige. Muy cómodo y elegante.',
            'colors': ['Beige', 'Negro', 'Blanco'],
            'sizes': ['28', '30', '32', '34'],
            'variants': [
                {'size': '28', 'stock': 9},
                {'size': '30', 'stock': 14},
                {'size': '32', 'stock': 10},
                {'size': '34', 'stock': 6},
            ]
        },
        
        # ZAPATOS HOMBRE
        {
            'sku': 'ZAP-H-001',
            'name': 'Zapato Oxford Negro',
            'category': 'Zapatos Formales Hombre',
            'price': 550.00,
            'description': 'Zapato Oxford de cuero genuino. Ideal para traje.',
            'colors': ['Negro'],
            'sizes': ['40', '41', '42', '43'],
            'variants': [
                {'size': '40', 'stock': 6},
                {'size': '41', 'stock': 10},
                {'size': '42', 'stock': 12},
                {'size': '43', 'stock': 8},
            ]
        },
        {
            'sku': 'ZAP-H-002',
            'name': 'Zapato Mocasín Café',
            'category': 'Zapatos Formales Hombre',
            'price': 480.00,
            'description': 'Mocasín de cuero café con detalle de hebilla.',
            'colors': ['Café', 'Negro'],
            'sizes': ['40', '41', '42', '43', '44'],
            'variants': [
                {'size': '40', 'stock': 5},
                {'size': '41', 'stock': 8},
                {'size': '42', 'stock': 10},
                {'size': '43', 'stock': 7},
                {'size': '44', 'stock': 4},
            ]
        },
        
        # ZAPATILLAS HOMBRE
        {
            'sku': 'ZAT-H-001',
            'name': 'Zapatillas Deportivas Blancas',
            'category': 'Zapatillas Deportivas Hombre',
            'price': 380.00,
            'description': 'Zapatillas deportivas blancas con detalles en negro. Muy cómodas.',
            'colors': ['Blanco/Negro', 'Blanco/Azul'],
            'sizes': ['40', '41', '42', '43'],
            'variants': [
                {'size': '40', 'stock': 12},
                {'size': '41', 'stock': 18},
                {'size': '42', 'stock': 15},
                {'size': '43', 'stock': 10},
            ]
        },
        
        # TACONES MUJER
        {
            'sku': 'TAC-M-001',
            'name': 'Tacón Stiletto Negro',
            'category': 'Tacones Mujer',
            'price': 580.00,
            'description': 'Tacón alto tipo stiletto en negro. 10 cm de altura.',
            'colors': ['Negro'],
            'sizes': ['36', '37', '38', '39'],
            'variants': [
                {'size': '36', 'stock': 6},
                {'size': '37', 'stock': 10},
                {'size': '38', 'stock': 8},
                {'size': '39', 'stock': 5},
            ]
        },
        {
            'sku': 'TAC-M-002',
            'name': 'Tacón Ancho Nude',
            'category': 'Tacones Mujer',
            'price': 520.00,
            'description': 'Tacón ancho cómodo en color nude. 7 cm de altura.',
            'colors': ['Nude', 'Negro'],
            'sizes': ['36', '37', '38', '39', '40'],
            'variants': [
                {'size': '36', 'stock': 8},
                {'size': '37', 'stock': 12},
                {'size': '38', 'stock': 14},
                {'size': '39', 'stock': 10},
                {'size': '40', 'stock': 6},
            ]
        },
        
        # ZAPATILLAS MUJER
        {
            'sku': 'ZAT-M-001',
            'name': 'Zapatillas Casual Rosa',
            'category': 'Zapatillas Mujer',
            'price': 320.00,
            'description': 'Zapatillas casuales en rosa pastel. Perfectas para el día a día.',
            'colors': ['Rosa', 'Blanco', 'Negro'],
            'sizes': ['36', '37', '38', '39'],
            'variants': [
                {'size': '36', 'stock': 10},
                {'size': '37', 'stock': 15},
                {'size': '38', 'stock': 12},
                {'size': '39', 'stock': 8},
            ]
        },
        
        # BOTAS MUJER
        {
            'sku': 'BOT-M-001',
            'name': 'Botas Largas Negras',
            'category': 'Botas Mujer',
            'price': 680.00,
            'description': 'Botas largas hasta la rodilla en cuero negro. Tacón medio.',
            'colors': ['Negro'],
            'sizes': ['36', '37', '38', '39'],
            'variants': [
                {'size': '36', 'stock': 5},
                {'size': '37', 'stock': 8},
                {'size': '38', 'stock': 10},
                {'size': '39', 'stock': 6},
            ]
        },
    ]
    
    productos_creados = 0
    for prod_data in productos_data:
        category = categorias_creadas.get(prod_data['category'])
        if not category:
            print(f"  ✗ Categoría no encontrada para: {prod_data['name']}")
            continue
        
        variants_data = prod_data.pop('variants', [])
        
        product, created = Product.objects.get_or_create(
            sku=prod_data['sku'],
            defaults={
                'name': prod_data['name'],
                'category': category,
                'price': prod_data['price'],
                'description': prod_data['description'],
                'colors': prod_data['colors'],
                'sizes': prod_data['sizes'],
                'stock': sum(v['stock'] for v in variants_data),
                'is_active': True,
            }
        )
        
        if created:
            # Crear variantes
            for variant_data in variants_data:
                ProductVariant.objects.create(
                    product=product,
                    size=variant_data['size'],
                    stock=variant_data['stock'],
                    sku=f"{product.sku}-{variant_data['size']}"
                )
            
            productos_creados += 1
            print(f"  ✓ Producto creado: {product.name} ({len(variants_data)} variantes)")
    
    print(f"\n{'=' * 60}")
    print(f"Resumen de datos creados:")
    print(f"  - Usuarios: {CustomUser.objects.count()}")
    print(f"  - Categorías: {Category.objects.count()}")
    print(f"  - Productos: {Product.objects.count()}")
    print(f"  - Variantes: {ProductVariant.objects.count()}")
    print(f"{'=' * 60}")
    print("✓ Población de datos completada exitosamente!")
    print(f"{'=' * 60}\n")

# Ejecutar la población
try:
    populate_all()
except Exception as e:
    print(f"\n✗ Error durante la población: {str(e)}")
    import traceback
    traceback.print_exc()
