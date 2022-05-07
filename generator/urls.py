from django.urls import path, include
from . import views

app_name = 'generator'

urlpatterns = [
    path('', views.IndexView.as_view(), name='index'),
    path('projects/', views.ProjectView.as_view(), name='projects_index'),
    path('projects/add', views.addProjectView, name='add_projects'),
    path('accounts/', include('django.contrib.auth.urls')),

    path('settings/<int:pk>/', views.SettingsView.as_view(), name='settings'),
    path('imports/<int:pk>/', views.ImportDetailView.as_view(), name='imports'),
    path('functions/<int:pk>/', views.FunctionDetailView.as_view(), name='functions'),
    path('variables/<int:pk>/', views.VariableDetailView.as_view(), name='variables'),
    path('projects/<int:pk>/', views.ProjectDetailView.as_view(), name='projects'),
    path('delete/import/<int:pk>/', views.DeleteImportView.as_view(), name='delete-imports'),
    path('delete/function/<int:pk>/', views.DeleteFunctionView.as_view(), name='delete-functions'),
    path('delete/variable/<int:pk>/', views.DeleteVariableView.as_view(), name='delete-variables'),
    path('delete/project/<int:pk>/', views.DeleteProjectView.as_view(), name='delete-projects')
]
