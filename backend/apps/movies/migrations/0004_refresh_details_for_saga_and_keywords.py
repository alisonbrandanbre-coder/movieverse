"""Movies cached before 0003 have no saga or keywords: mark their details as stale so the
next access fetches them again (with `belongs_to_collection` and keywords)."""

from django.db import migrations


def mark_details_stale(apps, schema_editor):
    Movie = apps.get_model("movies", "Movie")
    Movie.objects.filter(metadata_synced_at__isnull=False).update(metadata_synced_at=None)


class Migration(migrations.Migration):
    dependencies = [("movies", "0003_movie_saga_and_keywords")]

    operations = [migrations.RunPython(mark_details_stale, migrations.RunPython.noop)]
