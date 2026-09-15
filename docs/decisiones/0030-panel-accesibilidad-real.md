# ADR 0030: Panel de accesibilidad real (tamaño de texto + alto contraste)

## Estado

Aceptado, cerrado.

## Contexto

Tres rondas seguidas asumieron que ya existía un panel de accesibilidad
("Fase 8", "Fase 8.3") que el botón flotante debía abrir. Se volvió a
verificar de forma exhaustiva antes de tocar código, esta vez incluyendo
**todo el historial de git** (`git log --oneline --all | grep -i "fase
8\|accesib"`), no solo el estado actual de los archivos: el único
resultado es el commit de este mismo proyecto que construyó el toggle de
tema (ADR 0026). No hay ningún "Fase 8" en la historia real — las fases
del rediseño van de 1 a 7, después vienen las Tareas de esta ronda de
correcciones. Confirmado: el panel nunca existió. El cliente, avisado de
esto, confirmó que sí quiere el botón real y eligió el alcance: tamaño de
texto (3 niveles) + alto contraste.

## Decisión

### Botón flotante

Se reconvierte por completo (no se agrega un tercer botón):

- Ícono: figura humana simplificada en círculo (símbolo de accesibilidad
  reconocible), reemplaza el sol/luna que mostraba cuando togleaba tema.
  Estático en el HTML (ya no cambia dinámicamente), a diferencia de
  antes.
- Handler de clic: abre `#overlay-accesibilidad` (mismo patrón `.overlay`
  que el resto de los modales del sistema — login, producto, caja, etc.)
  en vez de alternar `data-tema`.
- Posición: sin cambios (`bottom-left`, despeja los 220px de la sidebar
  en desktop) — el problema nunca fue dónde estaba, era qué hacía.

`theme.js:iniciarTema()` vuelve a aceptar un solo botón (ya no una
lista): el toggle de tema vuelve a ser función exclusiva de `#boton-tema`
en la sidebar, sin nada que sincronizar.

### Panel — `public/js/accesibilidad.js` (nuevo módulo)

- **Tamaño de texto** (Normal / Grande / Muy grande, mismo patrón de
  grupo de botones que el selector de período de Indicadores, reusando
  sus clases `.selector-periodo`/`.selector-periodo__boton`): escala el
  `font-size` de `<html>` (18px / 20px, normal = sin atributo = default
  del navegador). Como toda la interfaz mide en `rem`, un solo valor
  reescala tipografía, padding y gaps de forma proporcional en toda la
  app — el mismo mecanismo que ya usa el zoom nativo del navegador.
- **Alto contraste** (checkbox): refuerza específicamente
  `--color-borde` y `--color-texto-muted`, los dos tokens que, medidos
  con la fórmula WCAG real (mismo método que el resto de este archivo),
  quedan más lejos de un contraste alto en el modo normal:

  | Token | Antes (claro) | Alto contraste (claro) | Antes (oscuro) | Alto contraste (oscuro) |
  |---|---|---|---|---|
  | `--color-borde` | 1.27:1 | **7.86:1** (#4a5261) | 1.26:1 | **8.41:1** (#aab2c0) |
  | `--color-texto-muted` | 5.90–6.38:1 | **12.40–13.41:1** (#2b2f38) | 7.06–7.69:1 | **12.78–13.94:1** (#d5dae2) |

  El resto de la paleta (acento, botones, badges) ya cumple AA con
  margen (ver ADR de la paleta terracota) y no se toca — alto contraste
  no es "otro tema", es un refuerzo puntual de los dos puntos más
  débiles medidos.
- Ambos ajustes se persisten en `localStorage`
  (`pos-dona-olga:tamano-texto`, `pos-dona-olga:alto-contraste`) y se
  aplican al importar el módulo (no dentro de un handler), para no
  arrancar en el tamaño/contraste por defecto y "saltar" recién al abrir
  el panel.

## Verificación

Contra una copia aislada de la base real, servidor de prueba en puerto
3001:

- El clic en el botón flotante **ya no cambia** `data-tema` (confirmado:
  igual antes y después).
- Overlays visibles: **0 antes → 1 después** del clic, y es
  específicamente `#overlay-accesibilidad` — el panel realmente abre.
- El botón de tema de la sidebar **sigue funcionando de forma
  independiente** (togleó `data-tema` con normalidad, sin depender del
  flotante).
- Tamaño de texto: `font-size` real de `<html>` confirmado en 16px
  (normal) → 18px (grande) → 20px (muy grande) → 16px (vuelta a normal).
  Captura real en Mostrador con "Muy grande" activo: el texto de toda la
  pantalla (chips, buscador, tarjetas, carrito) creció visiblemente, sin
  romper el layout.
- Alto contraste: valores reales de `--color-borde`/`--color-texto-muted`
  leídos vía `getComputedStyle` confirman el cambio a los tokens
  reforzados. Persiste tras recargar la página (localStorage).
- axe-core sin violaciones sobre el panel abierto, ambos temas.
- Barrido completo: presente, visible, con el ícono correcto, y **el
  panel abre correctamente** desde las 10 pantallas reales (Vencimientos
  ya no cuenta, ADR 0023) — 20/20 checks.
- Sin errores de consola en todo el recorrido.
