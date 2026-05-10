from rest_framework import serializers

"""
Serializadores para la API de Usuarios.

Este módulo define los serializers que validan y transforman los datos
de entrada para los endpoints de autenticación del sistema.

Cada serializer define la estructura esperada de los datos recibidos
y las reglas de validación asociadas a cada campo.

Serializers:
- LoginSerializer: Valida email y contraseña para inicio de sesión.
- RegisterSerializer: Valida datos para registro de nuevos usuarios.
- ResetPasswordSerializer: Valida email para solicitar recuperación de contraseña.

05/05/26
"""

class LoginSerializer(serializers.Serializer):
    """
    Serializer para validar credenciales de inicio de sesión.
    
    Campos:
    - email (EmailField, requerido): Email del usuario.
    - password (CharField, requerido, write_only): Contraseña del usuario.
      El atributo write_only asegura que nunca se devuelva en respuestas.
    """
    email = serializers.EmailField(required=True)
    password = serializers.CharField(required=True, write_only=True)


class RegisterSerializer(serializers.Serializer):
    """
    Serializer para validar datos de registro de nuevos usuarios.
    
    Campos:
    - email (EmailField, requerido): Email del usuario.
    - password (CharField, requerido, write_only, min_length=6): Contraseña.
      El atributo write_only asegura que nunca se devuelva en respuestas.
    - nombre (CharField, requerido, max_length=100): Nombre completo del usuario.
    - rol (ChoiceField, opcional, default='usuario'): Rol del usuario.
      Por defecto es 'usuario'. Los valores válidos son:
      'chef', 'administrador', 'usuario'.
    """
    email = serializers.EmailField(required=True)
    password = serializers.CharField(required=True, write_only=True, min_length=6)
    nombre = serializers.CharField(required=True, max_length=100)
    rol = serializers.ChoiceField(
    choices=['chef', 'administrador', 'gerente', 'usuario'],
    default='usuario', # Rol por defecto
    required=False
)


class ResetPasswordSerializer(serializers.Serializer):
    """
    Serializer para validar solicitud de recuperación de contraseña.
    
    Campos:
    - email (EmailField, requerido): Email del usuario que solicita la recuperación.
    """
    email = serializers.EmailField(required=True)
