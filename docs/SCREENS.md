# SCREENS.md

# 1. Landing

- logo MovieVerse;
- mensaje principal;
- preview del mapa;
- CTA “Explorar MovieVerse”.

# 2. Login / Registro

# 3. Onboarding

Wizard de 6 pasos (`/onboarding`) con barra de progreso y botones Atrás / Siguiente: géneros favoritos (al menos 1), géneros a evitar, décadas, idiomas, nivel de descubrimiento (Familiar / Equilibrado / Explorador) y valoración rápida (Me gusta / No me interesa) de títulos conocidos. Al registrarse se llega acá; `/discover` redirige acá mientras no esté completo y `/onboarding` redirige a `/discover` una vez completo.

# 4. Discover

Secciones:

- Para vos;
- Joyas para descubrir;
- Continuá explorando;
- Modo sorpresa.

# 5. Buscar

Input + cards.

# 6. Detalle

- poster;
- sinopsis;
- año;
- duración;
- géneros;
- reparto;
- puntuación;
- acciones: Favorita, Pendiente, Vista, Me gusta, No me interesa (activo/inactivo + mensaje de confirmación);
- botón **Explorar universo**.

# 6b. Mi perfil

`/profile?tab=favoritas|pendientes|vistas|preferencias`: tabs con contador; listas paginadas con "Quitar" y estado vacío; Preferencias editables (mismos selectores que el onboarding).

# 7. Mapa Cinematográfico

Elemento central del MVP.

UI:

- fondo oscuro;
- nodos con poster;
- líneas etiquetadas;
- zoom/pan;
- click en nodo;
- panel lateral con datos;
- leyenda de conexión.

Librería sugerida:

- React Flow, o
- Cytoscape.js.

Para MVP se recomienda **React Flow** por simplicidad.

# 8. Mi perfil

Tabs:

- Favoritas;
- Pendientes;
- Vistas;
- Preferencias.

# 9. Modo sorpresa

Una recomendación destacada con:

- poster;
- motivo;
- “otra opción”;
- guardar;
- vista.
