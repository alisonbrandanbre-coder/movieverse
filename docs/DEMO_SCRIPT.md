# DEMO_SCRIPT.md

# Demo de MovieVerse — 5 minutos

Guion de presentación del MVP, adaptado a lo que quedó implementado al cierre del Sprint 5. Recorre **intro → onboarding → Descubrir con «¿Por qué?» → mapa de Harry Potter (saga, Wizarding World, actor) → expandir → modo sorpresa**. Cada paso indica **qué hacer** (👉) y **qué decir** (🗣️). Los tiempos son acumulados.

## Antes de presentar (5 minutos antes)

1. Backend y base arriba: `docker compose up -d`, y <http://localhost:8000/api/v1/health> responde `ok`.
2. Datos de demo frescos: `docker compose exec backend python manage.py seed_demo`. Reinicia los dos usuarios y deja calculados los mapas de *Harry Potter y el cáliz de fuego*, *Animales fantásticos* e *Interstellar*, así nada espera a TMDB durante la demo.
3. Frontend: `npm run dev` en `frontend/` y abrir <http://localhost:5173> en una ventana **nueva de incógnito** (así se ve la intro y no hay sesión previa).
4. Navegador a 1440 × 900 aprox., zoom al 100 %, sin otras pestañas a la vista.
5. Tener a mano:
   - Usuario de demo: `explorador@movieverse.example` / `MovieVerse-demo-2026`
   - Un email nuevo para el onboarding en vivo, p. ej. `demo-<hora>@movieverse.example` (cualquier contraseña de 8+ caracteres)

## 0:00 — Problema e intro (30 s)

👉 La ventana abierta en `/`: corre la intro (logo y el texto que se aleja en perspectiva). Si alguien ya la vio, «Saltar intro ›».

🗣️ «Las plataformas nos recomiendan casi siempre lo mismo: lo más popular, en listas infinitas. Elegir qué ver termina siendo más largo que la película. MovieVerse propone otra cosa: **descubrir películas explorando cómo se conectan entre sí**, con recomendaciones que te dicen por qué y que no se quedan sólo con los títulos de siempre.»

## 0:30 — Onboarding (60 s)

👉 En el login, «Creá tu cuenta» → email nuevo + contraseña → «Crear cuenta». Llega solo al onboarding.

🗣️ «Lo primero es conocer tus gustos, en seis pasos cortos.»

👉 Recorrer los pasos rápido, haciendo clic en cada uno:

1. **¿Qué géneros te encantan?** → Ciencia ficción, Suspense.
2. **¿Qué preferís evitar?** → Romance. *(Los favoritos no aparecen acá: no se puede querer y evitar lo mismo.)*
3. **¿Qué épocas te atraen?** → 1990, 2000.
4. **¿En qué idiomas?** → Inglés.
5. **¿Cuánto querés explorar?** → **Explorador**.

🗣️ «Este nivel es clave: en *Familiar* te recomiendo apuestas seguras; en *Explorador*, joyas menos conocidas. La popularidad nunca domina el ranking.»

6. **Valorá algunos títulos** → 👍 en dos o tres conocidos → «Terminar».

🗣️ «Con esto ya hay recomendaciones. Para ver el efecto de un historial real, entro con una cuenta que ya tiene favoritas, vistas y likes.»

👉 «Salir» → iniciar sesión con `explorador@movieverse.example`.

## 1:30 — Descubrir con «¿Por qué?» (60 s)

👉 Entra a la **Home**: el hero rota entre las tendencias de la semana y debajo están «¿Cómo te sentís hoy?» y los carruseles. Sin detenerse (10 s): «Si no sé qué buscar, arranco por acá: tendencias o un estado de ánimo». Menú **Descubrir**.

👉 Señalar las tres secciones: «Para vos», «Joyas para descubrir», «Continuá explorando».

🗣️ «Este usuario ama la ciencia ficción, tiene Interstellar, Blade Runner y La llegada como favoritas y vio Matrix y Origen. Fíjense que no le recomiendo Matrix ni Origen de nuevo: **nunca recomiendo lo que ya viste ni lo que rechazaste**.»

👉 Clic en **«¿Por qué?»** de la primera película de «Para vos».

🗣️ «Cada recomendación explica su motivo: por qué película te la sugerimos, qué géneros compartís y si es menos conocida que la mayoría. Detrás hay un score con afinidad, novedad, calidad y una **penalización por popularidad**, y un re-ranking que cuida la diversidad.»

👉 Bajar hasta «Joyas para descubrir».

🗣️ «Acá aparecen las joyas: películas bien valoradas que casi nadie ve. Y si marco algo como vista o «No me interesa», la próxima vez que entro las recomendaciones ya cambiaron.»

## 2:30 — El mapa: Harry Potter (75 s)

👉 Menú **Universo** → en el buscador escribir «cáliz de fuego» → clic en *Harry Potter y el cáliz de fuego*.

🗣️ «Esta es la parte diferencial: el **mapa cinematográfico**. La película queda en el centro y cada línea es una conexión que se puede verificar.»

👉 Señalar, sin hacer clic, los chips de las líneas:

- **«Saga Harry Potter»** (coral): «Tres películas de su saga, no más: el mapa no se llena con la misma franquicia.»
- **«Wizarding World»** (verde menta, punteado largo) hacia *Animales fantásticos*: «Esto no es la misma saga, es el **mismo universo**: Harry Potter y Animales fantásticos comparten el mundo mágico.»
- **«Daniel Radcliffe», «Emma Watson», «Michael Gambon», «Brendan Gleeson»** (celeste): «Conexiones por **actor**: por ejemplo, Emma Watson te lleva a *La bella y la bestia*.»
- **«Mike Newell»** (dorado): «Y por **director**: Newell también dirigió *Prince of Persia*.»

👉 Pasar el mouse sobre *La bella y la bestia*: se ilumina su conexión y el resto se atenúa.

🗣️ «La leyenda de abajo a la izquierda también filtra: puedo ocultar un tipo de conexión con un clic.»

*(Opcional, si sobra tiempo: clic en el centro → «Ver saga completa (8)» suma las cuatro películas que faltaban.)*

## 3:45 — Expandir (40 s)

👉 Clic en *Animales fantásticos y dónde encontrarlos* → en el panel se ve el motivo («Del Wizarding World») → **«Expandir desde acá»**.

🗣️ «Elijo una película conectada y sigo explorando desde ella, sin recargar la página. Aparecen diez películas nuevas: sus secuelas, otras de Eddie Redmayne, de David Yates… Las que ya estaban se reutilizan.»

👉 Señalar la miga de pan de arriba a la izquierda (*Harry Potter y el cáliz de fuego › Animales fantásticos*) y «Recentrar».

🗣️ «Arriba queda el recorrido para volver atrás, y con «Recentrar» vuelvo al punto de partida. El mapa se limita a unas cincuenta películas para que siga fluido.»

## 4:25 — Modo sorpresa (25 s)

👉 Menú **«Sorprendeme»**.

🗣️ «¿Y si no sé qué quiero ver? El **modo sorpresa** elige al azar entre mis mejores recomendaciones, pero nunca la número uno, que ya la vi arriba, y le da más chances a las menos conocidas. No es un dado sobre todo el catálogo.»

👉 Leer el «¿Por qué?» del modal → **«Otra»** → (opcional) **«Explorar universo»**.

🗣️ «Si no me convence, pido otra, y nunca me repite la anterior ni algo que ya vi o rechacé.»

## 4:50 — Cierre (10 s)

🗣️ «MovieVerse combina recomendación personalizada con exploración visual para encontrar películas más allá de los títulos de siempre. Lo que sigue en el roadmap: maratones, estadísticas, compatibilidad con amigos y el camino entre dos películas.»

---

## Si algo falla

| Situación | Qué hacer |
|---|---|
| El onboarding en vivo tarda o falla | Saltarlo: entrar directo con `explorador@movieverse.example` y mostrar el onboarding con la captura `docs/screenshots/onboarding.jpg`. |
| TMDB no responde (aviso «TMDB no respondió del todo») | Los mapas del guion ya están en caché gracias a `seed_demo`; quedarse en Harry Potter, Animales fantásticos o Interstellar. |
| El mapa queda chico o desordenado | «Limpiar mapa» y volver a empezar desde la película central. |
| Una película tapa algo en el mapa | Botón de la esquina del minimapa para ocultarlo; la leyenda se colapsa con su título. |
| Quedó feedback de una prueba anterior | Volver a correr `seed_demo` (reinicia ambos usuarios). |

## Recorrido alternativo (perfil opuesto)

Para mostrar que las recomendaciones dependen del usuario, entrar con `familiar@movieverse.example` (comedia, romance y familia, nivel Familiar): en Descubrir aparecen *Pretty Woman*, *Paddington* o *Family Man* en lugar de la ciencia ficción del explorador, con explicaciones del tipo «Porque te gustó Paddington 2…».
