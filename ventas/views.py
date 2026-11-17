from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.utils import timezone
from .models import Cliente, Descuento, Venta, DetalleVenta, Faltante, Reembolso, DetalleReembolso
from .serializers import ClienteSerializer, DescuentoSerializer, VentaSerializer, FaltanteSerializer
from inventario.models import Producto

class ClienteViewSet(viewsets.ModelViewSet):
    queryset = Cliente.objects.all()
    serializer_class = ClienteSerializer

class DescuentoViewSet(viewsets.ModelViewSet):
    queryset = Descuento.objects.all()
    serializer_class = DescuentoSerializer

class FaltanteViewSet(viewsets.ModelViewSet):
    queryset = Faltante.objects.all()
    serializer_class = FaltanteSerializer

class VentaViewSet(viewsets.ModelViewSet):
    queryset = Venta.objects.all().order_by('-created_at')
    serializer_class = VentaSerializer

    def create(self, request, *args, **kwargs):
        data = request.data
        items_data = data.get('items', [])

        try:
            with transaction.atomic():
                # 1. Validar stock antes de descontar
                for item in items_data:
                    producto = Producto.objects.select_for_update().get(id=item['producto'])
                    cantidad_vendida = int(item['cantidad'])
                    
                    if producto.stock < cantidad_vendida:
                        return Response(
                            {"error": f"Stock insuficiente para el producto: {producto.nombre}. Stock actual: {producto.stock}"},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                    
                    # Descontar stock
                    producto.stock -= cantidad_vendida
                    producto.save()

                # 2. Crear la venta y sus detalles usando el serializer
                serializer = self.get_serializer(data=data)
                serializer.is_valid(raise_exception=True)
                venta = serializer.save()

                return Response(serializer.data, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['put'])
    def corregir(self, request, pk=None):
        """Endpoint para corrección de ventas cerradas (MVP 3)"""
        venta = self.get_object()
        data = request.data
        nuevos_items = data.get('items', [])
        
        try:
            with transaction.atomic():
                # Revertir stock de la venta original temporalmente
                for item_viejo in venta.items.all():
                    prod = item_viejo.producto
                    prod.stock += item_viejo.cantidad
                    prod.save()

                # Validar y aplicar stock de los nuevos ítems
                for item_nuevo in nuevos_items:
                    prod = Producto.objects.select_for_update().get(id=item_nuevo['producto'])
                    cant = int(item_nuevo['cantidad'])
                    if prod.stock < cant:
                        raise Exception(f"Stock insuficiente para corregir el producto: {prod.nombre}")
                    prod.stock -= cant
                    prod.save()

                # Borrar ítems viejos y actualizar detalles
                venta.items.all().delete()
                for item_nuevo in nuevos_items:
                    DetalleVenta.objects.create(
                        venta=venta,
                        producto_id=item_nuevo['producto'],
                        cantidad=item_nuevo['cantidad'],
                        precio_unitario=item_nuevo['precio_unitario']
                    )

                # Actualizar datos generales de la venta y auditoría
                venta.total = data.get('total', venta.total)
                venta.metodo_pago = data.get('metodo_pago', venta.metodo_pago)
                venta.es_corregida = True
                venta.corregida_por = request.user if request.user.is_authenticated else None
                venta.fecha_correccion = timezone.now()
                venta.save()

                serializer = self.get_serializer(venta)
                return Response(serializer.data, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)