from django.db import IntegrityError, transaction
from rest_framework_simplejwt.tokens import RefreshToken, TokenError

from apps.common.exceptions import ServiceError

from .managers import UserManager
from .models import User


class EmailAlreadyRegistered(ServiceError):
    status_code = 409
    default_code = "EMAIL_ALREADY_REGISTERED"
    default_detail = "Ya existe una cuenta con ese email."


class InvalidRefreshToken(ServiceError):
    status_code = 400
    default_code = "TOKEN_INVALID"
    default_detail = "El refresh token es inválido o expiró."


class AccountService:
    @staticmethod
    def register(email: str, password: str) -> User:
        """Create a user. Password strength is validated by the serializer beforehand."""
        email = UserManager.normalize_email_address(email)
        if User.objects.filter(email__iexact=email).exists():
            raise EmailAlreadyRegistered()
        try:
            with transaction.atomic():
                return User.objects.create_user(email=email, password=password)
        except IntegrityError as exc:  # concurrent registration with the same email
            raise EmailAlreadyRegistered() from exc

    @staticmethod
    def logout(refresh_token: str) -> None:
        """Blacklist the refresh token so it can no longer be used."""
        try:
            RefreshToken(refresh_token).blacklist()
        except TokenError as exc:
            raise InvalidRefreshToken() from exc
