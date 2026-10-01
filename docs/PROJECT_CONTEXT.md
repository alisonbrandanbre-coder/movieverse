# PROJECT_CONTEXT.md

# 1. Nombre

**MovieVerse — Universo de Películas**

# 2. Descripción

Plataforma web de descubrimiento cinematográfico que permite buscar películas, recibir recomendaciones personalizadas y explorar un universo visual de conexiones entre obras.

A diferencia de un buscador tradicional, MovieVerse intenta que el usuario descubra títulos que probablemente no buscaría por su cuenta y evita que la recomendación esté dominada únicamente por popularidad.

# 3. Problema

Las plataformas actuales presentan varios problemas:

- recomendaciones repetitivas;
- exceso de contenido popular;
- dificultad para descubrir películas menos conocidas;
- navegación basada casi exclusivamente en listas;
- poca explicación sobre por qué se recomienda un título;
- exceso de tiempo invertido en elegir qué ver.

## Dolor principal

> “Quiero encontrar algo que realmente me guste sin terminar viendo siempre las mismas películas que aparecen en todos lados.”

# 4. Propuesta de valor

MovieVerse combina:

- preferencias personales;
- historial;
- similitud cinematográfica;
- descubrimiento;
- conexiones visuales.

El usuario no solamente recibe una lista: **explora cómo una película lo puede llevar hacia otra**.

# 5. Usuarios

| Actor | Necesidad |
|---|---|
| Visitante | Comprender la propuesta |
| Usuario nuevo | Configurar gustos |
| Usuario registrado | Descubrir películas |
| Administrador | Mantener/observar el sistema |

# 6. MVP

## Funcionalidades obligatorias

1. Registro/login.
2. Onboarding de gustos.
3. Búsqueda.
4. Detalle.
5. Favoritos.
6. Pendientes.
7. Vistas.
8. Recomendaciones personalizadas.
9. Recomendaciones menos obvias.
10. Mapa Cinematográfico Interactivo.
11. Explicación de conexiones.
12. Modo sorpresa.

## Fuera del MVP

Las siguientes ideas del documento original quedan como roadmap:

- series;
- búsqueda por estado de ánimo;
- maratones automáticas;
- estadísticas;
- sistema de logros;
- compatibilidad con amigos;
- camino cinematográfico entre dos películas;
- múltiples listas personalizadas;
- plataformas de streaming;
- estrenos/notificaciones.

# 7. Reglas principales

| Regla | Descripción |
|---|---|
| R1 | No recomendar películas vistas |
| R2 | No repetir rechazadas |
| R3 | Popularidad no puede dominar el ranking |
| R4 | Toda recomendación debe tener motivo |
| R5 | El mapa sólo muestra conexiones justificables |
| R6 | Cada arista debe indicar el tipo de conexión |
| R7 | Se limita la expansión del mapa para preservar rendimiento |
| R8 | El frontend no calcula lógica de recomendación |
| R9 | TMDB se consume únicamente desde backend |
| R10 | El historial modifica recomendaciones futuras |

# 8. Métricas

- onboarding completado;
- búsqueda funcional;
- 10+ recomendaciones por usuario;
- recomendaciones con explicación;
- porcentaje controlado de títulos altamente populares;
- mapa generado desde una película;
- expansión de nodos sin recargar la página;
- like/dislike modifica recomendaciones;
- demo completa sin operaciones manuales.

# 9. Criterios de aceptación

El MVP se considera terminado si un usuario puede:

1. crear cuenta;
2. indicar gustos;
3. buscar `Interstellar`;
4. abrir su ficha;
5. visualizar conexiones;
6. hacer clic en una película conectada;
7. continuar explorando el mapa;
8. recibir recomendaciones personales;
9. guardar/ver/rechazar contenido;
10. observar cambios posteriores en recomendaciones.
