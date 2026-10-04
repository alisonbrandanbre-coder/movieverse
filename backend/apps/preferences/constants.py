"""Choices offered by the onboarding. The backend is the source of truth: the frontend
renders whatever `GET /preferences/options` returns and the serializers validate against it.
"""

from .models import DiscoveryLevel

# Decade start years: 1950 = "los 50".
DECADES = list(range(1950, 2030, 10))

# ISO 639-1 codes as used by TMDB's `original_language`, with their Spanish names.
LANGUAGES: dict[str, str] = {
    "es": "Español",
    "en": "Inglés",
    "fr": "Francés",
    "it": "Italiano",
    "de": "Alemán",
    "pt": "Portugués",
    "ja": "Japonés",
    "ko": "Coreano",
    "zh": "Chino",
    "hi": "Hindi",
    "sv": "Sueco",
    "da": "Danés",
}

DISCOVERY_LEVEL_DESCRIPTIONS: dict[str, str] = {
    DiscoveryLevel.FAMILIAR: "Títulos conocidos y apuestas seguras.",
    DiscoveryLevel.BALANCED: "Una mezcla de clásicos y algunas sorpresas.",
    DiscoveryLevel.EXPLORER: "Joyas menos conocidas, lejos de lo más popular.",
}

MAX_RATINGS = 30
