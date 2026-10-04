from django.contrib import admin
from django.urls import include, path

api_v1 = [
    path("", include("apps.common.urls")),
    path("auth/", include("apps.accounts.urls")),
    # Before `movies/` so `movies/onboarding-sample` is not shadowed.
    path("", include("apps.preferences.urls")),
    path("", include("apps.interactions.urls")),
    path("movies/", include("apps.movies.urls")),
    path("", include("apps.recommendations.urls")),
    path("", include("apps.graph.urls")),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include(api_v1)),
]
