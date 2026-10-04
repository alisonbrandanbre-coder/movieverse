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
- Modo sorpresa (Sprint 5).

Cada card tiene "¿Por qué?", que muestra la explicación de la API. Botón "Refrescar", estados de carga, error y vacío, y aviso cuando la respuesta es fallback o degradada.

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

Implementado en Sprint 4 (`/universe/:movieId`, React Flow / `@xyflow/react`):

- La ficha lleva al mapa con "Explorar universo".
- Fondo espacial con zoom, pan y minimapa discreto. En mobile el minimapa no se muestra.
- Disposición radial (una elipse, apaisada en escritorio y vertical en teléfonos), con las conexiones más fuertes más cerca del centro.
- Aristas con color por tipo (director dorado, actor azul, similar violeta, género gris azulado punteado) y grosor según la fuerza. Al pasar el mouse muestran una etiqueta corta.
- Leyenda fija abajo a la izquierda.
- Click en un nodo → panel lateral (hoja inferior en mobile) con póster, sinopsis, puntaje, motivos de cada conexión, "Ver ficha" y "Expandir desde acá".
- Expandir reutiliza los nodos que ya están, suma los nuevos animados y centra la vista.
- Miga de pan con el recorrido, "Recentrar" y "Limpiar mapa", y aviso al llegar a ~50 nodos.
- Estados de carga (estrellas que aparecen), error y vacío.

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
