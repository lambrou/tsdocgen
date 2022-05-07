from django.forms import ModelForm, Form, FileField, ClearableFileInput
from generator.models import Project, Config


class SettingsForm(ModelForm):
    class Meta:
        model = Config
        fields = ['projects', 'active_project']


class ProjectForm(ModelForm):
    class Meta:
        model = Project
        file_field = FileField(widget=ClearableFileInput(attrs={'multiple': True}))
        fields = ['project_name', 'project_description', 'project_path', 'project_owner']
        exclude = ['created_date']
