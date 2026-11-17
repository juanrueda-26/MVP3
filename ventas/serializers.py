from rest_framework import serializers
from .models import Cliente, Descuento, Venta, DetalleVenta, Faltante
from inventario.serializers import ProductoSerializer

class ClienteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cliente
        fields = '__all__'

class DescuentoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Descuento
        fields = '__all__'

class DetalleVentaSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.ReadOnlyField(source='producto.nombre')

    class Meta:
        model = DetalleVenta
        fields = ['id', 'producto', 'producto_nombre', 'cantidad', 'precio_unitario']

class VentaSerializer(serializers.ModelSerializer):
    items = DetalleVentaSerializer(many=True)
    cliente_nombre = serializers.ReadOnlyField(source='cliente.nombre')
    usuario_nombre = serializers.ReadOnlyField(source='usuario.username')

    class Meta:
        model = Venta
        fields = '__all__'

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        venta = Venta.objects.create(**validated_data)
        for item_data in items_data:
            DetalleVenta.objects.create(venta=venta, **item_data)
        return venta

class FaltanteSerializer(serializers.ModelSerializer):
    proveedor_nombre = serializers.ReadOnlyField(source='proveedor.nombre')

    class Meta:
        model = Faltante
        fields = '__all__'