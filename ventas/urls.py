from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ClienteViewSet, DescuentoViewSet, VentaViewSet, FaltanteViewSet

router = DefaultRouter()
router.register(r'clientes', ClienteViewSet)
router.register(r'descuentos', DescuentoViewSet)
router.register(r'ventas', VentaViewSet)
router.register(r'faltantes', FaltanteViewSet)

urlpatterns = [
    path('', include(router.urls)),
]   