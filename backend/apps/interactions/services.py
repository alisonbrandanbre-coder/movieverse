"""InteractionService: favorites, watchlist, watched and like/dislike of the request's user.

Every method receives the authenticated `User` from the view (`request.user`); a user id
coming from the client is never trusted (docs/RBAC.md).

Rules (documented in docs/SPRINT_2_REPORT.md):
- Adding a flag is idempotent: (user, movie, type) is unique, so nothing is duplicated.
- Removing a flag that is not set is a no-op.
- Contradictory flags are cleared: LIKE ↔ DISLIKE; DISLIKE also clears FAVORITE and
  WATCHLIST; FAVORITE / WATCHLIST clear DISLIKE; WATCHED clears WATCHLIST.
- `REMOVE_WATCHLIST` is an action equivalent to removing WATCHLIST.
"""

from dataclasses import dataclass

from django.core.paginator import Paginator
from django.db import IntegrityError, transaction
from django.db.models import F, QuerySet

from apps.accounts.models import User
from apps.common.exceptions import ServiceError
from apps.movies.models import Movie
from apps.movies.services.movie_service import MovieService

from .models import Interaction, InteractionType

T = InteractionType
STATE_TYPES = [T.FAVORITE, T.WATCHLIST, T.WATCHED, T.LIKE, T.DISLIKE]
CONFLICTS: dict[str, set[str]] = {
    T.LIKE: {T.DISLIKE},
    T.DISLIKE: {T.LIKE, T.FAVORITE, T.WATCHLIST},
    T.FAVORITE: {T.DISLIKE},
    T.WATCHLIST: {T.DISLIKE},
    T.WATCHED: {T.WATCHLIST},
}
LIST_PAGE_SIZE = 24


class InvalidInteraction(ServiceError):
    default_code = "INVALID_INTERACTION"
    default_detail = "Esa acción no se puede quitar."


@dataclass(frozen=True)
class MovieInteractionState:
    movie_id: int
    favorite: bool
    watchlist: bool
    watched: bool
    reaction: str | None  # "LIKE" | "DISLIKE" | None


@dataclass(frozen=True)
class MoviePage:
    page: int
    total_pages: int
    total_results: int
    movies: list[Movie]


class InteractionService:
    @classmethod
    def add(cls, user: User, movie_id: int, type_: str) -> MovieInteractionState:
        if type_ == T.REMOVE_WATCHLIST:
            return cls.remove(user, movie_id, T.WATCHLIST)
        movie = MovieService.get_movie(movie_id)
        with transaction.atomic():
            Interaction.objects.filter(user=user, movie=movie, type__in=CONFLICTS[type_]).delete()
            try:
                with transaction.atomic():
                    Interaction.objects.get_or_create(user=user, movie=movie, type=type_)
            except IntegrityError:
                pass  # created concurrently by a double click: the flag is set either way
        return cls.state(user, movie.pk)

    @classmethod
    def remove(cls, user: User, movie_id: int, type_: str) -> MovieInteractionState:
        if type_ not in STATE_TYPES:
            raise InvalidInteraction()
        movie = MovieService.get_movie(movie_id)
        Interaction.objects.filter(user=user, movie=movie, type=type_).delete()
        return cls.state(user, movie.pk)

    @staticmethod
    def state(user: User, movie_id: int) -> MovieInteractionState:
        movie = MovieService.get_movie(movie_id)
        types = set(
            Interaction.objects.filter(user=user, movie=movie).values_list("type", flat=True)
        )
        reaction = T.LIKE if T.LIKE in types else T.DISLIKE if T.DISLIKE in types else None
        return MovieInteractionState(
            movie_id=movie.pk,
            favorite=T.FAVORITE in types,
            watchlist=T.WATCHLIST in types,
            watched=T.WATCHED in types,
            reaction=reaction.value if reaction else None,
        )

    @staticmethod
    def movies(user: User, type_: str, page: int = 1) -> MoviePage:
        """The user's movies with a flag, most recently added first (`movie.added_at`)."""
        queryset: QuerySet[Movie] = (
            Movie.objects.filter(interactions__user=user, interactions__type=type_)
            .annotate(added_at=F("interactions__created_at"))
            .order_by("-added_at", "-id")
        )
        paginator = Paginator(queryset, LIST_PAGE_SIZE)
        current = paginator.get_page(page)
        return MoviePage(
            page=current.number,
            total_pages=paginator.num_pages if paginator.count else 0,
            total_results=paginator.count,
            movies=list(current.object_list),
        )

    @staticmethod
    def movie_ids(user: User, types: list[str]) -> list[int]:
        return list(
            Interaction.objects.filter(user=user, type__in=types)
            .values_list("movie_id", flat=True)
            .distinct()
        )
