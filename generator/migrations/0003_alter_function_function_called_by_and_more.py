# Generated by Django 4.0.4 on 2022-05-06 19:30

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('generator', '0002_alter_function_function_called_by_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='function',
            name='function_called_by',
            field=models.ManyToManyField(blank=True, related_name='+', to='generator.function'),
        ),
        migrations.AlterField(
            model_name='function',
            name='function_calls',
            field=models.ManyToManyField(blank=True, related_name='+', to='generator.function'),
        ),
    ]