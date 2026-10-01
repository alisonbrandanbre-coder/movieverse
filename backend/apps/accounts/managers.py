from django.contrib.auth.base_user import BaseUserManager


class UserManager(BaseUserManager):
    use_in_migrations = True

    @staticmethod
    def normalize_email_address(email: str) -> str:
        return (email or "").strip().lower()

    def _create_user(self, email: str, password: str | None, **extra_fields):
        if not email:
            raise ValueError("El email es obligatorio")
        user = self.model(email=self.normalize_email_address(email), **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email: str, password: str | None = None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email: str, password: str | None = None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        if not extra_fields["is_staff"] or not extra_fields["is_superuser"]:
            raise ValueError("Un superusuario debe tener is_staff=True e is_superuser=True")
        return self._create_user(email, password, **extra_fields)

    def get_by_natural_key(self, username: str):
        return self.get(email__iexact=self.normalize_email_address(username))
