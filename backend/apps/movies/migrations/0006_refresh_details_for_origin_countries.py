"""Movies cached before 0005 have no countries of origin: mark their details as stale so
the next access fetches them again (same approach as 0004)."""

from django.db import migrations


def mark_details_stale(apps, schema_editor):
    Movie = apps.get_model("movies", "Movie")
    Movie.objects.filter(metadata_synced_at__isnull=False).update(metadata_synced_at=None)


class Migration(migrations.Migration):
    dependencies = [("movies", "0005_watch_providers_and_countries")]

    operations = [migrations.RunPython(mark_details_stale, migrations.RunPython.noop)]
