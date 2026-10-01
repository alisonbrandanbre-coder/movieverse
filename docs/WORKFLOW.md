# WORKFLOW.md

# Flujo principal

```text
Landing
↓
Registro
↓
Onboarding
↓
Home / Discover
├── recomendaciones
├── búsqueda
├── modo sorpresa
└── mapa
```

# Flujo diferencial

```text
Buscar "Interstellar"
↓
Detalle
↓
Explorar universo
↓
Interstellar en centro
↓
Nodos conectados
├── Inception — mismo director
├── The Martian — género/similitud
└── Memento — mismo director
↓
Click en Inception
↓
Inception pasa a ser foco
↓
Se cargan conexiones nuevas
```

# Onboarding

1. géneros favoritos;
2. géneros a evitar;
3. décadas;
4. idiomas;
5. nivel de descubrimiento;
6. valoración rápida de títulos.

# Discovery level

- Familiar
- Equilibrado
- Explorador

`Explorador` incrementa el peso de novelty y penaliza más la popularidad.

# Feedback

Like:
- aumenta afinidad con atributos relacionados.

Dislike:
- reduce afinidad;
- se excluye el título.

Watched:
- excluido de recomendaciones futuras.

Favorite:
- fuerte señal positiva.

Watchlist:
- señal de interés moderada.

# Modo sorpresa

No debe ser un random puro.

Pipeline:

```text
candidatos compatibles
→ excluir vistos/rechazados
→ ponderar discovery
→ muestreo aleatorio entre top candidatos
```
