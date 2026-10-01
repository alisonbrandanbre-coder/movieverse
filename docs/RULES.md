# RULES.md

- Backend source of truth.
- Lógica de recomendación sólo en backend.
- No exponer TMDB_API_KEY.
- No agregar dependencias sin necesidad.
- No microservicios.
- No ML complejo durante MVP.
- Toda interacción pertenece al request.user.
- Toda regla nueva debe documentarse.
- Cada feature debe incluir criterios de aceptación.
- Evitar duplicar scoring en múltiples módulos.
- RecommendationService concentra ranking.
- TasteProfileService concentra actualización de gustos.
- Tests obligatorios para scoring y exclusiones.
