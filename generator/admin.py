from django.contrib import admin

from .models import *

admin.site.register(Import)
admin.site.register(Function)
admin.site.register(Variable)
admin.site.register(Project)
admin.site.register(Config)