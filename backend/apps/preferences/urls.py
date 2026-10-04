from django.urls import path

from .views import OnboardingSampleView, OnboardingView, PreferenceOptionsView, PreferencesView

urlpatterns = [
    path("preferences", PreferencesView.as_view(), name="preferences"),
    path("preferences/onboarding", OnboardingView.as_view(), name="preferences-onboarding"),
    path("preferences/options", PreferenceOptionsView.as_view(), name="preferences-options"),
    path("movies/onboarding-sample", OnboardingSampleView.as_view(), name="onboarding-sample"),
]
