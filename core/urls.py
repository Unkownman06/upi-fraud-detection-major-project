from django.contrib import admin
from django.urls import path, include
from django.http import HttpResponse

# ✅ simple home view
def home(request):
    return HttpResponse("🚀 API is running successfully!")

urlpatterns = [
    path('', home),  # ✅ THIS FIXES YOUR ERROR
    path('admin/', admin.site.urls),
    path('api/', include('frauds.urls')),  # 👈 make sure app name correct
]