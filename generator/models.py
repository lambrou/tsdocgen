from django.db import models
from django.contrib.auth.models import User

from django.contrib.postgres.fields import HStoreField, ArrayField
from django.views import generic
from django.urls import reverse


class Import(models.Model):
    import_name = models.CharField(max_length=50)
    import_path = models.CharField(max_length=100)
    created_date = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.import_name + '(' + self.import_path + ')'

    def get_absolute_url(self):
        return reverse('detail', kwargs={'pk': self.pk})


class Function(models.Model):
    function_name = models.CharField(max_length=50)
    function_parameters = HStoreField(blank=True, null=True)
    function_description = models.CharField(max_length=500, blank=True)
    function_calls = models.ManyToManyField("Function", blank=True, related_name='+', symmetrical=False)
    function_called_by = models.ManyToManyField("Function", blank=True, related_name='+', symmetrical=False)
    function_returns = models.CharField(max_length=200)
    function_examples = models.CharField(max_length=500, blank=True)
    created_date = models.DateTimeField(auto_now_add=True)
    imported_from = models.ForeignKey(Import, blank=True, null=True, on_delete=models.SET_NULL)

    def __str__(self):
        parameter_string = str(self.function_parameters).strip('{}').replace("'", "")
        return self.function_name + '(' + parameter_string + ')'

    def get_absolute_url(self):
        return reverse('detail', kwargs={'pk': self.pk})


class Variable(models.Model):
    variable_name = models.CharField(max_length=50)
    variable_type = models.CharField(max_length=20, blank=True)
    variable_value = models.CharField(max_length=500, blank=True)
    variable_scope = models.CharField(max_length=20)
    used_by = models.ManyToManyField(Function, blank=True, default='global')
    created_date = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.variable_name + ' (' + self.variable_type + '): ' + self.variable_value

    def get_absolute_url(self):
        return reverse('detail', kwargs={'pk': self.pk})


class Interface(models.Model):
    interface_name = models.CharField(max_length=50)
    interface_extends = models.CharField(max_length=50)
    interface_parameters = HStoreField(blank=True, null=True)
    used_by = models.ManyToManyField(Variable, blank=True, default='global')
    created_date = models.DateTimeField(auto_now_add=True)


class Project(models.Model):
    project_name = models.CharField(max_length=50)
    project_description = models.CharField(max_length=500)
    project_path = models.FileField(blank=False, null=False, upload_to='projects/')
    project_owner = models.ForeignKey(User, on_delete=models.CASCADE)
    imports = models.ManyToManyField(Import, blank=True)
    functions = models.ManyToManyField(Function, blank=True)
    variables = models.ManyToManyField(Variable, blank=True)
    created_date = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.project_name + ': ' + self.project_description


class Config(models.Model):
    last_updated = models.DateTimeField(auto_now=True)
    projects = models.ManyToManyField(Project, blank=True)
    active_project = models.ForeignKey(Project, blank=True, null=True, related_name='+', on_delete=models.SET_NULL)

