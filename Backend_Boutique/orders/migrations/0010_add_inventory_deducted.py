from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0007_add_stripe_method'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='inventory_deducted',
            field=models.BooleanField(default=False, help_text='Si ya se descontó inventario para esta orden'),
        ),
    ]
