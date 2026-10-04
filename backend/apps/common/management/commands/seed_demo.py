"""`python manage.py seed_demo`: two demo users with opposite tastes, ready to log in.

- explorador@movieverse.example: science fiction and suspense, Explorer level.
- familiar@movieverse.example: comedy, romance and family, Familiar level.

Each one finishes the onboarding and gets favorites, watched movies, likes, a pending one
and a "No me interesa", so Descubrir looks right from the first login. Movies come from
TMDB (by tmdb id) through MovieService, so `TMDB_API_KEY` must be set. Running it again
resets both users to this same state. Recommendations are generated right away and the
map of the demo movies is warmed up (skip it with `--skip-warm`).
"""

from dataclasses import dataclass

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.accounts.models import User
from apps.graph.services import GraphService
from apps.interactions.models import Interaction, InteractionType
from apps.interactions.services import InteractionService
from apps.movies.exceptions import CatalogRateLimited, CatalogUnavailable, MovieNotFound
from apps.movies.models import Genre, Movie
from apps.movies.services.movie_service import MovieService
from apps.movies.services.tmdb_client import TMDBError
from apps.preferences.models import DiscoveryLevel, UserTasteProfile
from apps.preferences.services import TasteProfileService
from apps.recommendations.models import RecommendationRun
from apps.recommendations.services.recommendation_service import RecommendationService

DEMO_PASSWORD = "MovieVerse-demo-2026"

# TMDB genre ids.
SCIFI, THRILLER, MYSTERY, ROMANCE, COMEDY, FAMILY, HORROR = 878, 53, 9648, 10749, 35, 10751, 27
DOCUMENTARY, TV_MOVIE = 99, 10770


@dataclass(frozen=True)
class DemoUser:
    email: str
    preferred_genres: tuple[int, ...]
    disliked_genres: tuple[int, ...]
    decades: tuple[int, ...]
    languages: tuple[str, ...]
    level: str
    # TMDB movie ids per interaction.
    favorites: tuple[int, ...]
    watched: tuple[int, ...]
    likes: tuple[int, ...]
    watchlist: tuple[int, ...] = ()
    dislikes: tuple[int, ...] = ()


DEMO_USERS = (
    DemoUser(
        email="explorador@movieverse.example",
        preferred_genres=(SCIFI, THRILLER, MYSTERY),
        # TV specials and documentaries would crowd the science fiction picks.
        disliked_genres=(ROMANCE, COMEDY, DOCUMENTARY, TV_MOVIE),
        decades=(1990, 2000, 2010),
        languages=("en",),
        level=DiscoveryLevel.EXPLORER,
        favorites=(157336, 78, 329865),  # Interstellar, Blade Runner, Arrival
        watched=(603, 27205, 62),  # The Matrix, Inception, 2001: A Space Odyssey
        likes=(17431, 264660, 782, 14337),  # Moon, Ex Machina, Gattaca, Primer
        watchlist=(438631,),  # Dune
        # Notting Hill, and two TV specials TMDB files as movies (Doctor Who: The Day of the
        # Doctor, Twice Upon a Time): rejected, so the demo shows they never come back.
        dislikes=(509, 313106, 317182),
    ),
    DemoUser(
        email="familiar@movieverse.example",
        preferred_genres=(COMEDY, ROMANCE, FAMILY),
        disliked_genres=(HORROR, SCIFI, TV_MOVIE),
        decades=(1990, 2000, 2010),
        languages=("en", "es"),
        level=DiscoveryLevel.FAMILIAR,
        favorites=(509, 508, 11631),  # Notting Hill, Love Actually, Mamma Mia!
        watched=(18240, 50646),  # The Proposal, Crazy, Stupid, Love
        likes=(122906, 313369, 346648, 350),  # About Time, La La Land, Paddington 2, Prada
        watchlist=(458423,),  # Mamma Mia! Here We Go Again
        dislikes=(138843,),  # The Conjuring
    ),
)

# The demo script's maps (docs/DEMO_SCRIPT.md): Harry Potter and the Goblet of Fire, the
# node expanded from it (Fantastic Beasts and Where to Find Them) and Interstellar.
WARM_GRAPH_TMDB_IDS = (674, 259316, 157336)


class Command(BaseCommand):
    help = "Crea (o reinicia) los 2 usuarios de demo con onboarding, favoritas, vistas y likes."

    def add_arguments(self, parser):
        parser.add_argument(
            "--skip-warm",
            action="store_true",
            help="No precalcular el mapa de las películas del guion de demo.",
        )

    def handle(self, *args, skip_warm: bool = False, **options):
        movies = MovieService()
        movies.ensure_genre_catalog()
        if not Genre.objects.exists():
            raise CommandError(
                "No se pudo cargar el catálogo de géneros de TMDB. ¿Está TMDB_API_KEY?"
            )

        for demo in DEMO_USERS:
            user = self._reset_user(demo.email)
            catalog = self._movies(movies, demo)
            genre = Genre.objects.in_bulk(field_name="tmdb_id")
            TasteProfileService.complete_onboarding(
                user,
                {
                    "preferred_genres": [genre[g].pk for g in demo.preferred_genres if g in genre],
                    "disliked_genres": [genre[g].pk for g in demo.disliked_genres if g in genre],
                    "preferred_decades": list(demo.decades),
                    "preferred_languages": list(demo.languages),
                    "discovery_level": demo.level,
                },
                [{"movie_id": catalog[t].pk, "reaction": "LIKE"} for t in demo.likes],
            )
            for tmdb_ids, kind in (
                (demo.favorites, InteractionType.FAVORITE),
                (demo.watched, InteractionType.WATCHED),
                (demo.watchlist, InteractionType.WATCHLIST),
                (demo.dislikes, InteractionType.DISLIKE),
            ):
                for tmdb_id in tmdb_ids:
                    InteractionService.add(user, catalog[tmdb_id].pk, kind)

            result = RecommendationService().refresh(user)
            shown = sum(len(rows) for rows in result.sections.values())
            self.stdout.write(
                self.style.SUCCESS(
                    f"{demo.email} · {DiscoveryLevel(demo.level).label} · "
                    f"{Interaction.objects.filter(user=user).count()} marcas · "
                    f"{shown} recomendaciones"
                )
            )

        if not skip_warm:
            self._warm_graph(movies)
        self.stdout.write(f"Contraseña de ambos usuarios: {DEMO_PASSWORD}")

    # ------------------------------------------------------------ steps

    @staticmethod
    @transaction.atomic
    def _reset_user(email: str) -> User:
        user = User.objects.filter(email=email).first()
        if user is None:
            return User.objects.create_user(email=email, password=DEMO_PASSWORD)
        user.set_password(DEMO_PASSWORD)
        user.is_active = True
        user.save()
        Interaction.objects.filter(user=user).delete()
        UserTasteProfile.objects.filter(user=user).delete()
        RecommendationRun.objects.filter(user=user).delete()
        return user

    def _movies(self, movies: MovieService, demo: DemoUser) -> dict[int, Movie]:
        """Every movie of the profile, fetched from TMDB the first time (details + credits)."""
        tmdb_ids = {
            *demo.favorites,
            *demo.watched,
            *demo.likes,
            *demo.watchlist,
            *demo.dislikes,
        }
        catalog = {}
        for tmdb_id in sorted(tmdb_ids):
            try:
                movie = movies.get_details(movies.get_or_create_from_tmdb(tmdb_id).pk)
                movies.get_credits(movie.pk)  # directors and cast: seeds for recommendations
            except MovieNotFound as exc:
                raise CommandError(f"TMDB no tiene la película {tmdb_id}.") from exc
            except (CatalogUnavailable, CatalogRateLimited, TMDBError) as exc:
                raise CommandError(
                    f"TMDB no respondió al cargar la película {tmdb_id}. Revisá TMDB_API_KEY "
                    "y la conexión, y volvé a correr el comando."
                ) from exc
            catalog[tmdb_id] = movie
        return catalog

    def _warm_graph(self, movies: MovieService) -> None:
        """Best effort: the demo's maps answer instantly (TMDB lists end up cached)."""
        for tmdb_id in WARM_GRAPH_TMDB_IDS:
            try:
                movie = movies.get_or_create_from_tmdb(tmdb_id)
                neighborhood = GraphService(movies).neighborhood(movie.pk)
            except (MovieNotFound, CatalogUnavailable, CatalogRateLimited, TMDBError) as exc:
                self.stdout.write(
                    self.style.WARNING(f"No se pudo precalcular el mapa de {tmdb_id}: {exc}")
                )
                continue
            self.stdout.write(
                f"Mapa listo: {movie.title} ({len(neighborhood.connections)} conexiones)"
            )
