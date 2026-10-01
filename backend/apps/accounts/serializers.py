from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .managers import UserManager
from .models import User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email"]
        read_only_fields = fields


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(write_only=True, min_length=8, max_length=128)

    def validate_email(self, value: str) -> str:
        return UserManager.normalize_email_address(value)

    def validate(self, attrs: dict) -> dict:
        try:
            validate_password(attrs["password"], user=User(email=attrs["email"]))
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)}) from exc
        return attrs


class LoginSerializer(TokenObtainPairSerializer):
    """Email + password login returning {access, refresh, user}."""

    default_error_messages = {"no_active_account": "Email o contraseña incorrectos."}

    def validate(self, attrs: dict) -> dict:
        attrs[self.username_field] = UserManager.normalize_email_address(
            attrs.get(self.username_field, "")
        )
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()
