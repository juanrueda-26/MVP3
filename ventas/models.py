from django.db import models
from django.contrib.auth.models import User
from inventario.models import Producto

class Cliente(models.Model):
    nombre = models.CharField(max_length=150)
    documento = models.CharField(max_length=50, unique=True)
    telefono = models.CharField(max_length=20, blank=True, null=True)
    direccion = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.nombre} - {self.documento}"

class Descuento(models.Model):
    TIPO_CHOICES = [
        ('porcentual', 'Porcentual'),
        ('fijo', 'Valor Fijo'),
    ]
    nombre = models.CharField(max_length=100)
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    valor = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"{self.nombre} ({self.valor}%)" if self.tipo == 'porcentual' else f"{self.nombre} (${self.valor})"

class Venta(models.Model):
    cliente = models.ForeignKey(Cliente, on_delete=models.PROTECT, null=True, blank=True)
    usuario = models.ForeignKey(User, on_delete=models.PROTECT)
    total = models.DecimalField(max_digits=10, decimal_places=2)
    metodo_pago = models.CharField(max_length=50)
    estado = models.CharField(max_length=20, default='cerrada') # cerrada, abierta
    
    # Campos de auditoría para corrección de ventas cerradas (Guía MVP 3)
    es_corregida = models.BooleanField(default=False)
    corregida_por = models.ForeignKey(User, null=True, blank=True, related_name='ventas_corregidas', on_delete=models.SET_NULL)
    fecha_correccion = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Venta #{self.id} - Total: ${self.total}"

class DetalleVenta(models.Model):
    venta = models.ForeignKey(Venta, related_name='items', on_delete=models.CASCADE)
    producto = models.ForeignKey(Producto, on_delete=models.PROTECT)
    cantidad = models.IntegerField()
    precio_unitario = models.DecimalField(max_digits=10, decimal_places=2)

class Reembolso(models.Model):
    venta = models.ForeignKey(Venta, related_name='reembolsos', on_delete=models.CASCADE)
    usuario = models.ForeignKey(User, on_delete=models.PROTECT)
    total_reembolsado = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

class DetalleReembolso(models.Model):
    reembolso = models.ForeignKey(Reembolso, related_name='items', on_delete=models.CASCADE)
    producto = models.ForeignKey(Producto, on_delete=models.PROTECT)
    cantidad = models.IntegerField()
    retorna_inventario = models.BooleanField(default=True)

class Faltante(models.Model):
    TIPO_CHOICES = [
        ('inexistente', 'Producto Inexistente'),
        ('agotado', 'Producto Agotado'),
    ]
    ESTADO_CHOICES = [
        ('pendiente', 'Pendiente'),
        ('resuelto', 'Resuelto'),
    ]
    producto_descripcion = models.CharField(max_length=200)
    cantidad_solicitada = models.IntegerField()
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    proveedor = models.ForeignKey('inventario.Proveedor', on_delete=models.SET_NULL, null=True, blank=True)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='pendiente')
    created_at = models.DateTimeField(auto_now_add=True)