from django.db import migrations


def add_stripe_method(apps, schema_editor):
    PaymentMethod = apps.get_model('orders', 'PaymentMethod')
    # Create or update Stripe payment method
    pm, created = PaymentMethod.objects.get_or_create(
        code='STRIPE',
        defaults={
            'name': 'Tarjeta (Stripe)',
            'type': 'GATEWAY',
            'instructions': 'Paga de forma segura con tarjeta usando Stripe (modo prueba)'.strip(),
            'gateway_provider': 'stripe',
            'is_active': True,
            'fee_percent': 0,
            'fee_fixed': 0,
            'supports_refund': True,
        }
    )
    if not created:
        pm.name = 'Tarjeta (Stripe)'
        pm.type = 'GATEWAY'
        pm.gateway_provider = 'stripe'
        pm.is_active = True
        pm.supports_refund = True
        pm.save()
    # Optionally deactivate Transferencia if desired
    try:
        transfer = PaymentMethod.objects.get(code='TRANSFER')
        transfer.is_active = False
        transfer.save(update_fields=['is_active'])
    except PaymentMethod.DoesNotExist:
        pass


def remove_stripe_method(apps, schema_editor):
    PaymentMethod = apps.get_model('orders', 'PaymentMethod')
    PaymentMethod.objects.filter(code='STRIPE').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0006_address_label_alter_address_full_name'),
    ]

    operations = [
        migrations.RunPython(add_stripe_method, remove_stripe_method),
    ]
