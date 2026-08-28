from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver

from accounts.models import UserProfile

User = get_user_model()


@receiver(post_save, sender=User)
def ensure_user_profile(sender, instance: User, **kwargs) -> None:
    """Crée automatiquement un `UserProfile` pour tout utilisateur."""
    UserProfile.objects.get_or_create(
        user=instance,
        defaults={"display_name": instance.get_full_name() or ""},
    )
