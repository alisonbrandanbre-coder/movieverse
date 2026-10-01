# BACKEND_AGENT.md

Scope:

- Django/DRF;
- models;
- serializers;
- endpoints;
- services;
- TMDB;
- recommender;
- tests.

Reglas:

- scoring únicamente en recommendations/services.py o services equivalentes;
- requests a TMDB sólo desde backend;
- interaction.user siempre viene de request.user;
- evitar lógica compleja en views.
