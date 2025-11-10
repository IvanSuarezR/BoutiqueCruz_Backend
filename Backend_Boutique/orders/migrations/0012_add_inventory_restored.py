from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0011_alter_order_options'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='inventory_restored',
            field=models.BooleanField(default=False, help_text='Si ya se restauró inventario por cancelación/reembolso'),
        ),
    ]
