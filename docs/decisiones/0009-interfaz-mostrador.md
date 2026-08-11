# ADR 0009: Interfaz de mostrador — sin CDN, autohospedada, verificada empíricamente

## Estado

Aceptado.

## Contexto

Última pieza del sistema y la única que va a ver y tocar el personal del
negocio todos los días. Hereda la restricción de arquitectura ya fijada
desde el inicio (ADR 0001): el sistema opera sin depender de internet. Eso
tiene una consecuencia directa e ineludible sobre el frontend — nada de
CDN, nada de Google Fonts enlazadas, nada de librerías de íconos externas,
nada de emojis. Si el negocio no tiene internet estable el día de la
instalación (o cualquier día después), la interfaz tiene que funcionar
igual.

## Decisiones

### Sin dependencias de terceros en tiempo de ejecución

- **Tipografía**: Fraunces (500/700) para títulos y nombres de producto,
  Public Sans (400/600/700) para UI y números — ambas descargadas como
  archivos `.woff2` reales a `public/fonts/`, con `@font-face` y
  `font-display: swap`. Licencia SIL Open Font License 1.1 en ambas
  (verificada contra el `OFL.txt` real de cada proyecto, no asumida —
  copiados también a `public/fonts/`), gratis para uso comercial
  autohospedado. Public Sans se eligió específicamente por NO ser
  Inter/Roboto (evita el look genérico de dashboard SaaS) y por su
  legibilidad numérica: los precios son lo que un cajero lee más rápido y
  bajo presión.
- **Íconos**: SVG inline escritos a mano (`public/js/icons.js`), trazo de
  línea consistente (1.75, `currentColor`). Ninguno viene de una
  librería. El placeholder de producto sin foto es un paquete envuelto en
  papel — no un ícono de imagen rota ni un cuadro gris genérico.
- **Sin build ni framework**: HTML/CSS/JS vanilla, módulos ES nativos
  (`type="module"`), organizados por responsabilidad
  (`api.js`/`cart.js`/`render.js`/`main.js`/etc.), no un archivo gigante.

### Paleta verificada con la fórmula de contraste real

Antes de escribir una sola línea de CSS, se calculó el contraste WCAG
(luminancia relativa → ratio) de cada par texto/fondo con un script, no a
ojo. Todos los pares usados pasan AA, la mayoría AAA. La verificación se
repitió después con `axe-core` contra el DOM real renderizado, en ambos
temas — 0 violaciones WCAG 2.0/2.1 A+AA en cada uno. El acento de marca
(vino/embutido curado) y el color de alerta (dorado/mostaza) son familias
de color deliberadamente distintas: alertar sobre stock bajo o
vencimientos nunca usa el mismo color que resalta la marca, para no
confundir "esto es importante para el negocio" con "esto necesita
atención".

### Búsqueda manual: filtro en cliente, no un endpoint nuevo

`GET /api/productos` no expone búsqueda por nombre (solo filtros
`categoriaId`/`activo`). En vez de agregar un endpoint nuevo — que habría
contradicho la instrucción explícita de consumir exactamente los
contratos ya construidos — la búsqueda manual carga los productos activos
una vez y filtra en el cliente (con normalización de tildes) sobre esa
lista, con debounce. Para el tamaño de catálogo de un negocio de este
tipo, es una solución simple y suficiente; no hay necesidad de paginar ni
de un endpoint de búsqueda dedicado.

### Captura del lector de código de barras: velocidad, no un campo dedicado

El lector es HID (teclado). `barcode-scanner.js` escucha `keydown` a
nivel de documento y distingue una ráfaga de lector de tecleo humano por
velocidad: menos de 30ms entre teclas se considera parte de la misma
ráfaga (incluso un tecleo humano muy rápido no baja de ~60-80ms). Solo se
intercepta `Enter` cuando el buffer acumulado ya es lo bastante largo
(4+ caracteres) para tener confianza de que es el terminador de un
escaneo real — así un `Enter` normal en cualquier otro campo del
formulario nunca se ve afectado. Si el lector tipeó sobre un campo de
texto con foco (ej. el buscador), ese campo se limpia al completarse el
escaneo.

### El carrito replica los cálculos del backend, no inventa una fuente de verdad paralela

`cart.js` aplica exactamente las mismas reglas que `ventas.service.js`
(ADR 0002 y 0003): redondeo único por línea, fallback a precio público
cuando no hay mayorista diferenciado. Esto es solo para que el total en
pantalla coincida con lo que se va a cobrar de verdad — el backend sigue
siendo la única autoridad real, y vuelve a calcular todo al confirmar la
venta.

### Cantidad de productos por peso: `type="text"`, no `type="number"`

Bug real encontrado probando con Puppeteer: un `<input type="number">`
del navegador solo acepta punto como separador decimal (parte del
estándar HTML, sin importar el idioma) y descarta en silencio cualquier
valor con coma — exactamente la convención colombiana que usa el resto
del sistema (incluido el recibo impreso, ADR 0007). La cantidad de
productos por peso usa `type="text"` con `inputmode="decimal"`;
`kilosTextoAGramos()` ya acepta coma o punto al leer el valor.

### La impresión y el cajón son best-effort del backend — la UI no espera nada de eso

`POST /api/ventas` responde apenas la venta queda guardada. La interfaz
confirma el éxito de la venta en ese momento, sin esperar (ni poder
esperar: no hay endpoint que exponga el estado de la impresión) a que el
recibo termine de imprimirse o el cajón se abra — mismo criterio que ya
fija ADR 0007 del lado del servidor.

### Rendimiento: compresión + un solo archivo CSS

La primera auditoría Lighthouse dio Performance 99 por dos hallazgos
concretos y accionables: sin compresión de texto (~32KiB) y 5 archivos
CSS separados bloqueando el render (~560ms estimados). Se agregó
`compression` (gzip, dependencia real y liviana) y se combinaron los 5
CSS en un solo `estilos.css` (con comentarios de sección que preservan la
organización original: tokens/base/layout/componentes/animaciones) sin
introducir ninguna herramienta de build. El puntaje final quedó en
**Performance 99, Accessibility 100, Best Practices 100, SEO 100**.

El punto que falta en Performance es intrínseco a tener *cualquier*
`<link rel="stylesheet">` (bloquea el primer render por especificación,
en todo navegador) bajo la simulación de red lenta que usa Lighthouse por
defecto — no representativo del despliegue real (navegador y servidor en
el mismo equipo, sin red de por medio). Eliminarlo del todo requeriría
inlinear ~19KB de CSS en cada respuesta HTML, perdiendo el cacheo del
archivo entre cargas, a cambio de un punto en una métrica de laboratorio
que no aplica a esta instalación. Se decidió no perseguirlo — el objetivo
pedido era "90+, idealmente cerca de 100", y 99 lo cumple sin ese
sacrificio.

### Verificación: tres herramientas independientes, no una sola opinión

1. **Puppeteer** (Chrome real, headless, instalado temporalmente sin
   agregarlo a `package.json`): flujo completo de principio a fin —
   abrir caja desde el formulario real, buscar, agregar productos por
   peso y por unidad, editar cantidades, cambiar tipo de precio, cobrar,
   simular una ráfaga de teclado como la de un lector físico, abrir/cerrar
   el panel de alertas, togglear tema, navegación por teclado. 31/31
   verificaciones, incluyendo confirmar en la base de datos que la venta
   automatizada quedó guardada con los valores correctos.
2. **Lighthouse**: las 4 categorías, en el estado representativo real de
   la aplicación (caja abierta, catálogo cargado).
3. **axe-core**: 0 violaciones WCAG 2.0/2.1 nivel A y AA, corridas por
   separado en tema claro y en tema oscuro contra el DOM ya renderizado.

Ninguna de las tres herramientas quedó como dependencia del proyecto —
se instalaron con `--no-save` solo para esta verificación.

## Consecuencias

- `public/` no tiene build step. Si el CSS combinado (`estilos.css`)
  crece mucho más adelante, dividirlo de nuevo es válido, pero entonces sí
  amerita evaluar un paso de build mínimo en vez de mantenerlo a mano.
- El filtro de búsqueda en cliente deja de ser suficiente si el catálogo
  crece a varios miles de productos; en ese punto sí se justificaría un
  endpoint de búsqueda por nombre en el backend. No es el caso hoy.
- La foto de producto (`foto_nombre_archivo`) se sirve desde `/uploads`
  vía `express.static`, agregado en `app.js` junto con el estático de
  `public/`.
