from django.forms import DateTimeInput
from django.shortcuts import render, get_object_or_404
from django.urls import reverse, reverse_lazy
from django.utils import timezone
from django.views import generic, View
from django.db.models import Count

from .models import Import, Function, Variable, Project, Config
from generator.forms import SettingsForm
from tsdocgen.settings import BASE_DIR
from .forms import ProjectForm
from django.core.files.storage import default_storage
import time

import json
import re
import subprocess


class IndexView(generic.ListView):
    template_name = 'generator/index.html'
    context_object_name = 'object_list'

    def get_context_data(self, **kwargs):
        context = super(IndexView, self).get_context_data(**kwargs)
        context['importFields'] = [field.name.replace("function", "").replace("id", "") for field in
                                   Import._meta.get_fields()]
        context['functionFields'] = [field.name.replace("variable", "").replace("function_calls", "").replace("id", "")
                                     for field in Function._meta.get_fields()]
        context['variableFields'] = [field.name.replace("id", "") for field in Variable._meta.get_fields()]
        return context

    def get_queryset(self):
        request_dict = self.request.GET.dict()
        order_by_date = '-created_date'
        ordered_import_objects = Import.objects.order_by(order_by_date)
        ordered_function_objects = Function.objects.order_by(order_by_date)
        ordered_variable_objects = Variable.objects.order_by(order_by_date)
        desc = ''
        if 'import-sort' in request_dict:
            sort_imports_by = request_dict['import-sort'].replace(" ", '_').lower()
            if sort_imports_by == 'created_date':
                desc = '-'
            ordered_import_objects = Import.objects \
                .order_by(desc + sort_imports_by)

        if 'function-sort' in request_dict:
            sort_functions_by = request_dict['function-sort'].replace(" ", '_').lower()
            if sort_functions_by == 'created_date':
                desc = '-'
            if sort_functions_by == 'function_called_by':
                ordered_function_objects = Function.objects \
                    .annotate(count_by=Count('function_called_by')) \
                    .order_by('-count_by')
            else:
                ordered_function_objects = Function.objects \
                    .order_by(desc + sort_functions_by)

        if 'variable-sort' in request_dict:
            sort_variables_by = request_dict['variable-sort'].replace(" ", '_').lower()
            if sort_variables_by == 'created_date':
                desc = '-'
            if sort_variables_by == 'used_by':
                ordered_variable_objects = Variable.objects \
                    .annotate(count_by=Count('used_by')) \
                    .order_by('-count_by')
            else:
                ordered_variable_objects = Variable.objects \
                    .order_by(desc + sort_variables_by)

        return {
            'imports': ordered_import_objects,
            'functions': ordered_function_objects,
            'variables': ordered_variable_objects
        }


class ImportDetailView(generic.DetailView):
    model = Import
    template_name = 'generator/detail.html'


class FunctionDetailView(generic.DetailView):
    model = Function
    template_name = 'generator/detail.html'


class VariableDetailView(generic.DetailView):
    model = Variable
    template_name = 'generator/detail.html'


class ProjectView(generic.ListView):
    template_name = 'generator/projects.html'
    context_object_name = 'object_list'

    def get_queryset(self):
        ordered_projects = Project.objects.order_by('-created_date')
        return ordered_projects


class ProjectDetailView(generic.DetailView):
    model = Project
    template_name = 'generator/project_detail.html'


def addProjectView(request):
    if request.method == 'POST':
        form = ProjectForm(request.POST, request.FILES)
        files = request.FILES.items()
        if form.is_valid():
            for file in files:
                filename = 'file-' + str(time.time())
                with default_storage.open('tmp/' + filename, 'wb+') as destination:
                    for chunk in file[1].chunks():
                        destination.write(chunk)

                ast = getAST(str(BASE_DIR) + '\\tmp\\' + filename)
                saveObjects(ast, request.user)

            return render(request, 'generator/project_form.html', {'form': form})
        else:
            return render(request, 'generator/project_form.html', {'form': form})

    if request.method == 'GET':
        form = ProjectForm()
        return render(request, 'generator/project_form.html', {'form': form})


def getAST(file):
    parsed_ts = subprocess.run(['node', str(BASE_DIR) + '\\generator\\static\\generator\\js\\parseTypeScriptFile.js',
                                str(file)], stdout=subprocess.PIPE)
    file_json = json.loads(parsed_ts.stdout.decode('utf-8'))
    # with open('ast.txt', 'w+') as file:
    #     file.write(parsed_ts.stdout.decode('utf-8'))
    return file_json


def saveObjects(objects, user):
    print(objects)

    saveFunctions(objects)
    saveCalls(objects)
    saveVariables(objects)


def saveVariables(objects):
    for variable in objects['file']['variables']:
        try:
            new_variable = Variable(
                variable_name=variable['name'],
                variable_type=variable['type'],
                variable_value=variable['value']
            )
            new_variable.save()
        except KeyError:
            new_variable = Variable(
                variable_name=variable['name'],
                variable_type=variable['type']
            )


def saveFunctions(objects):
    for func in objects['file']['functions']:
        new_function = Function(
            function_name=func['name'],
            function_parameters=func['parameters'],
        )
        new_function.save()


def saveCalls(objects):
    for func in objects['file']['functions']:
        for callee in func['calls']:
            callee_object = Function.objects.filter(function_name=callee)
            if callee_object:
                func_object = Function.objects.get(function_name=func['name'])
                func_object.function_calls.add(callee_object[0])
                callee_object[0].function_called_by.add(func_object)
                callee_object[0].save()
                func_object.save()


class DeleteImportView(generic.DeleteView):
    model = Import
    success_url = reverse_lazy('generator:index')


class DeleteFunctionView(generic.DeleteView):
    model = Function
    success_url = reverse_lazy('generator:index')


class DeleteVariableView(generic.DeleteView):
    model = Variable
    success_url = reverse_lazy('generator:index')


class DeleteProjectView(generic.DeleteView):
    model = Project
    success_url = reverse_lazy('generator:index')


class SettingsView(generic.UpdateView):
    template_name = 'generator/settings.html'
    form_class = SettingsForm
    success_url = '/settings/'
    model = Config

    def form_valid(self, form):
        self.object = form.save(commit=False)
        self.object.save()
        return super().form_valid(form)
