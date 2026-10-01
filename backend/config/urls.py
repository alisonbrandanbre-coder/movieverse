from django.contrib import admin
from django.urls import include, path

api_v1 = [
    path("", include("apps.common.urls")),
    path("auth/", include("apps.accounts.urls")),
    path("movies/", include("apps.movies.urls")),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include(api_v1)),
]
