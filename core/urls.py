from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('about/', views.about, name='about'),
    path('register/', views.register, name='register'),
    path('login/', views.user_login, name='login'),
    path('logout/', views.user_logout, name='logout'),
    path('helpline/', views.helpline, name='helpline'),
    path('panic-alert/', views.panic_alert, name='panic_alert'),
    path('profile/', views.profile, name='profile'),
    path('send-otp/<str:otp_type>/', views.send_otp, name='send_otp'),
    path('verify-otp/<str:otp_type>/', views.verify_otp, name='verify_otp'),
    path('panic/send/', views.panic_alert, name='panic_send'),           # POST for sending panic
    path('api/panic-alerts/', views.api_panic_alerts, name='api_panic_alerts'),  # GET for dashboard polling
    path('dashboard/', views.dashboard, name='dashboard'),
]
