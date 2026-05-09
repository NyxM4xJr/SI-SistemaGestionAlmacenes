# ============================================================
# ARCHIVO: backend/usuarios/insumo_serializer.py
# CASO DE USO: CU07 - Gestionar Insumos
# CICLO: 2
# FECHA: 09/05/26
# AUTOR: Karen Ortega Mancilla
# DESCRIPCIÓN: Valida los datos de la tabla insumo y los transforma
# ============================================================

from rest_framework import serializers

class InsumoSerializer(serializers.Serializer):
    """
    Serializer para validar y transformar datos de la tabla INSUMO.
    
    Campos:
    - id: Entero autogenerado (solo lectura).
    - nombre: Texto requerido (máx 100 caracteres).
    - categoria: Texto requerido (máx 50 caracteres).
    - origen: Texto requerido (máx 50 caracteres).
    - conservado: Texto requerido (máx 50 caracteres).
    - vencimiento_dias: Entero requerido (días hasta caducidad).
    - proteinas, calorias, grasas, calcio, hierro: Decimales requeridos
      (valores nutricionales por 100g).
    
    Fecha: 09/05/26
    """

    id = serializers.IntegerField(read_only=True)
    nombre = serializers.CharField(max_length=100, required=True)
    categoria = serializers.CharField(max_length=50, required=True)
    origen = serializers.CharField(max_length=50, required=True)
    conservado = serializers.CharField(max_length=50, required=True)
    vencimiento_dias = serializers.IntegerField(required=True, min_value=1)
    proteinas = serializers.DecimalField(max_digits=10, decimal_places=2, required=True)
    calorias = serializers.DecimalField(max_digits=10, decimal_places=2, required=True)
    grasas = serializers.DecimalField(max_digits=10, decimal_places=2, required=True)
    calcio = serializers.DecimalField(max_digits=10, decimal_places=2, required=True)
    hierro = serializers.DecimalField(max_digits=10, decimal_places=2, required=True)