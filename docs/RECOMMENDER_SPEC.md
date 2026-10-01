# RECOMMENDER_SPEC.md

# Objetivo

Generar recomendaciones relevantes sin convertir MovieVerse en un ranking de películas populares.

# Estrategia

Content-Based + Discovery Re-ranking.

# Score

```text
final =
0.55 affinity
+ 0.20 novelty
+ 0.10 quality
+ 0.10 diversity
+ 0.05 exploration
- popularity_penalty
```

# Afinidad

Coincidencia con:

- géneros;
- décadas;
- idiomas;
- likes;
- favoritas;
- películas exploradas.

# Discovery

Favorece contenido menos obvio.

No significa recomendar películas malas o desconocidas sin señal.

# Quality

Combina:

- vote_average;
- vote_count.

Se recomienda rating ponderado tipo IMDb para evitar títulos con 10 puntos y sólo 3 votos.

# Popularidad

Bucket sugerido:

```text
VERY_POPULAR
POPULAR
MEDIUM
HIDDEN
```

En modo equilibrado:

- máximo aproximado 25% VERY_POPULAR.

En modo explorador:

- máximo aproximado 10–15% VERY_POPULAR;
- mayor presencia MEDIUM/HIDDEN.

# Diversidad

Evitar 10 películas seguidas del mismo género/director.

# Exploration score

Pequeño factor para introducir resultados cercanos pero no idénticos al perfil actual.

Esto ayuda a descubrir intereses nuevos.

# Explicación

Ejemplo:

> “Porque te gustó Interstellar, preferís ciencia ficción y esta película comparte elementos de exploración espacial, pero tiene bastante menos popularidad.”

# Modo sorpresa

Usar weighted random entre candidatos de score alto.

No usar `random.choice()` sobre todo el catálogo.
