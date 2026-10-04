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

### SAGA

Las dos películas son de la misma colección de TMDB (`belongs_to_collection`): "Harry Potter", "Iron Man", "El Señor de los Anillos".

- Es la conexión más fuerte: si dos películas son de la misma saga, la arista es SAGA aunque también compartan director o actores (esos motivos van detrás, en `reasons`).
- Motivo: "De la saga Harry Potter"; chip: "Saga Harry Potter". El nombre se limpia del sufijo de TMDB ("Harry Potter - Colección" → "Harry Potter").
- Fuente: `/collection/{id}` (sus `parts`), cacheada como cualquier lista de TMDB. La colección queda guardada en `Movie` (`collection_tmdb_id`, `collection_name`), también en las películas de la saga que llegan como resumen.
- Diversidad: como máximo **3 películas de la misma saga** en un vecindario. La respuesta trae `saga: {name, total}` y, si faltan películas, el panel del nodo central ofrece "Ver saga completa (8)", que pide `GET /graph/movies/{id}/saga` (todas las películas estrenadas, en orden) y las suma al mapa.

### UNIVERSO (`UNIVERSE`)

Comparten un universo, sin ser de la misma saga: Iron Man y Capitán América (Universo Marvel), Harry Potter y Animales fantásticos (Wizarding World).

- Motivo: "Del Universo Marvel"; chip: "Universo Marvel". Si además son de la misma saga, gana SAGA y el universo no se repite.
- Diversidad: SAGA y UNIVERSO juntos, como máximo **4** por vecindario, para dejar lugar a descubrimientos. Estos topes no se relajan nunca (los de tipo y persona sí, para llegar a 8 aristas).
- Las keywords de cada película quedan guardadas en `Movie.keyword_ids` (el detalle se pide con `append_to_response=keywords`).

#### Lista de universos

Está en `backend/apps/graph/universes.py` (configuración, sin lógica repetida). Una película pertenece a un universo si tiene una de sus **keywords** de TMDB o es de una de sus **colecciones**:

| Universo | Definido por | Verificación |
| --- | --- | --- |
| Universo Marvel | keyword 180547 "marvel cinematic universe (mcu)" | `/discover/movie?with_keywords=180547`: 80 películas (Los Vengadores, Iron Man, Pantera Negra…) |
| Universo DC | keyword 229266 "dc extended universe (dceu)" | 17 películas (El hombre de acero, Mujer Maravilla, Aquaman, ¡Shazam!…) |
| Wizarding World | colecciones 1241 (Harry Potter) y 435259 (Animales fantásticos) | `belongs_to_collection` de esas películas |
| MonsterVerse | keyword 380322 "monsterverse" | 6 películas (Godzilla 2014, Kong: La isla calavera, Godzilla vs. Kong…) |
| Universo de El Conjuro | colecciones 313086 (El Conjuro), 402074 (Annabelle) y 968052 (La monja) | `belongs_to_collection` de esas películas |

Wizarding World y El Conjuro no tienen una keyword utilizable: "harry potter" (377309) y "conjuring" (323553) marcan documentales y películas ajenas, y las películas de cada universo sólo comparten keywords genéricas ("witch", "halloween"). Por eso se definen por sus colecciones.

#### Cómo agregar un universo

1. Buscar la keyword con `/search/keyword?query=…` y comprobar con `/discover/movie?with_keywords=<id>&sort_by=vote_count.desc` que trae las películas del universo y nada más. Si no hay una keyword confiable, usar las colecciones de sus sagas (el `belongs_to_collection` de sus películas). **No inventar IDs.**
2. Agregar una entrada `Universe(key, name, keywords=…, collections=…)` en `UNIVERSES`, con un comentario de qué se verificó.
3. Sumar un test en `backend/tests/graph/test_franchises.py` (una película del universo se conecta con otra como `UNIVERSE`).

No hace falta tocar el frontend: el tipo, su color y su ícono son los mismos para todos los universos.

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
same saga (SAGA) = 1.00
same universe (UNIVERSE) = 0.95
same director = 0.92
same lead actor = 0.90
TMDB similar = 0.80
2+ shared genres = 0.60
1 shared genre = 0.35
```

Cada motivo extra de la misma arista suma 0,05, con tope 0,99: sólo una saga llega a 1,00. A igual fuerza desempata el orden de tipos SAGA → UNIVERSE → DIRECTOR → ACTOR → SIMILAR → GENRE.

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
- conexión por guionistas;
- clusters visuales.
