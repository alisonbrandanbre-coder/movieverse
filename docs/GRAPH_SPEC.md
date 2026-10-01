# GRAPH_SPEC.md

# Mapa Cinematográfico Interactivo

Feature diferencial de MovieVerse.

# Objetivo

Transformar el descubrimiento en exploración visual.

# Nodo

Cada nodo representa una película.

Datos mínimos:

- id;
- title;
- poster;
- year;
- score opcional.

# Arista

Representa una conexión comprobable.

## MVP

### DIRECTOR

Dos películas comparten director.

### ACTOR

Comparten un actor relevante.

Para evitar ruido, considerar sólo actores principales.

### GENRE

Comparten uno o más géneros.

Debe tener menor peso que actor/director.

### SIMILAR

TMDB u otra regla de similitud las relaciona.

# Strength

Ejemplo:

```text
same director = 1.00
same lead actor = 0.90
TMDB similar = 0.80
2+ shared genres = 0.60
1 shared genre = 0.35
```

# Selección de vecinos

No devolver todos.

1. calcular candidatos;
2. asignar strength;
3. eliminar duplicados;
4. combinar tipos;
5. ordenar;
6. aplicar diversidad;
7. devolver top 8–12.

# UX

Al hacer click en un nodo:

- se puede centrar;
- se carga su vecindario;
- nodos existentes se reutilizan;
- nuevos nodos aparecen animados.

# Rendimiento

- máximo 50 nodos activos sugeridos;
- posibilidad de limpiar/recentrar;
- no precargar una red infinita;
- expansión bajo demanda.

# Ejemplo

```text
Interstellar
├─ Inception
│  └─ DIRECTOR: Christopher Nolan
├─ The Dark Knight
│  └─ DIRECTOR: Christopher Nolan
├─ The Martian
│  └─ SIMILAR / GENRE
└─ Gravity
   └─ SIMILAR / GENRE
```

# Futuro

- caminos entre dos películas;
- temática semántica;
- universos/franquicias;
- conexión por guionistas;
- clusters visuales.
