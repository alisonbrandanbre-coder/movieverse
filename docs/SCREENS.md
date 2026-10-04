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

- La ficha lleva al mapa con "Explorar universo", igual que el chip de las tarjetas de Buscar, Descubrir y Mi perfil.
- "Universo" en el menú principal lleva a `/universe`: buscador para elegir la película de inicio, tus favoritas y «Me gusta» como punto de partida o, si no tenés, películas muy conocidas.
- Fondo espacial con zoom, pan y minimapa discreto. En mobile el minimapa no se muestra.
- Disposición radial (una elipse con la forma de la pantalla; en teléfonos, tres columnas compactas), sin superposiciones y con las conexiones más fuertes más cerca del centro. En escritorio los pósters se ven de ~90 px (vecinos) y ~150 px (centro).
- Aristas que se distinguen por color y trazo: saga coral sólida y la más gruesa, universo verde menta en trazos largos, director dorado sólido, actor celeste sólido, similar violeta punteado y género gris azulado discontinuo y fino; el grosor crece con la fuerza.
- Cada arista lleva un chip con ícono y sólo el nombre ("Saga Harry Potter", "Universo Marvel", "Mike Newell", "Michael Gambon", "Similar", "Fantasía"); el texto completo va en el tooltip y en el panel. Los chips nunca se cortan ni pisan pósters u otros chips: los que no entran aparecen al pasar el mouse por su línea.
- Sagas: como máximo 3 películas de la misma saga (y 4 entre saga y universo). En el panel del nodo central, "Ver saga completa (8)" suma las que faltan.
- Hover sobre una película: se resaltan sus conexiones y se atenúa el resto.
- Los vecinos se agrupan por tipo de conexión alrededor del centro (zonas).
- Leyenda abajo a la izquierda que también filtra (click en un tipo lo oculta o muestra) y se puede colapsar. La leyenda y el minimapa no tapan películas: el encuadre les deja lugar.
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
