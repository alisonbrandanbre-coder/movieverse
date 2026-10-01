# RBAC.md

El MVP necesita roles simples.

| Rol | Permisos |
|---|---|
| USER | perfil propio, recomendaciones, interacciones, watchlist |
| ADMIN | acceso administrativo Django |

Reglas:

- un USER sólo accede a sus propios datos;
- el user_id nunca se confía desde el frontend;
- se obtiene desde request.user;
- endpoints de recomendaciones requieren autenticación;
- la API key de TMDB jamás se expone.
