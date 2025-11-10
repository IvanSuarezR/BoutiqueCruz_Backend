from django.db import migrations


def seed_methods(apps, schema_editor):
    ShippingMethod = apps.get_model('orders', 'ShippingMethod')
    PaymentMethod = apps.get_model('orders', 'PaymentMethod')
    # Shipping
    ShippingMethod.objects.get_or_create(
        code='PICKUP', defaults={
            'name': 'Retiro en tienda',
            'description': 'Retira tu pedido en tienda',
            'base_cost': 0,
            'transit_days_min': 0,
            'transit_days_max': 1,
            'is_active': True,
            'supports_cod': True,
            'requires_pickup_point': True,
        }
    )
    ShippingMethod.objects.get_or_create(
        code='STANDARD', defaults={
            'name': 'Envío estándar',
            'description': 'Entrega a domicilio estándar',
            'base_cost': 20,
            'transit_days_min': 2,
            'transit_days_max': 5,
            'is_active': True,
            'supports_cod': True,
        }
    )
    # Payment
    PaymentMethod.objects.get_or_create(
        code='COD', defaults={
            'name': 'Contra Entrega',
            'type': 'COD',
            'instructions': 'Paga al recibir tu pedido',
            'is_active': True,
        }
    )
    PaymentMethod.objects.get_or_create(
        code='TRANSFER', defaults={
            'name': 'Transferencia Bancaria',
            'type': 'OFFLINE',
            'instructions': 'Te enviaremos los datos de la cuenta para transferir.',
            'is_active': True,
        }
    )


def unseed_methods(apps, schema_editor):
    ShippingMethod = apps.get_model('orders', 'ShippingMethod')
    PaymentMethod = apps.get_model('orders', 'PaymentMethod')
    ShippingMethod.objects.filter(code__in=['PICKUP','STANDARD']).delete()
    PaymentMethod.objects.filter(code__in=['COD','TRANSFER']).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_methods, unseed_methods),
    ]
