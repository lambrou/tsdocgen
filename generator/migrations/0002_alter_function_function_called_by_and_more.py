# Generated by Django 4.0.4 on 2022-05-06 05:33

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('generator', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='function',
            name='function_called_by',
            field=models.ManyToManyField(blank=True, related_name='function_called_by', to='generator.function'),
        ),
        migrations.AlterField(
            model_name='function',
            name='function_calls',
            field=models.ManyToManyField(blank=True, related_name='function_calls', to='generator.function'),
        ),
    ]