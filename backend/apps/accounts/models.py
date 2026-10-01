from django.contrib.auth.base_user import AbstractBaseUser
from django.contrib.auth.models import PermissionsMixin
from django.db import models
from django.utils import timezone

from .managers import UserManager


class User(AbstractBaseUser, PermissionsMixin):
    """MovieVerse user. Authenticates by email (unique, stored lowercased)."""

    email = models.EmailField(unique=True, max_length=254)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "email"
    EMAIL_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    class Meta:
        ordering = ["id"]

    def __str__(self) -> str:
        return self.email

    def save(self, *args, **kwargs):
        self.email = UserManager.normalize_email_address(self.email)
        super().save(*args, **kwargs)
