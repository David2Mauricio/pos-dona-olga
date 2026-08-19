# ADR 0017: Correcciones de UX reales, precio único, y desglose en Indicadores

## Estado

Aceptado. Cierra por completo la ronda de correcciones de UX/UI previa a
la instalación final (bloques A-I de un mismo pedido consolidado, en tres
pasadas: la primera dejó D, G1 y H2 como propuesta; la segunda implementó
D, H2 y los dos ítems abiertos del Bloque C; la tercera implementó G1 ya
confirmado). No queda ningún bloque pendiente de esta ronda — lo único en
cola, fuera de este ADR, es la auditoría inmutable (cierres de caja,
anulaciones, cambios de precio).

## Regla de proceso: verificar contra el servidor real, no una instancia temporal

Agregada a partir del hallazgo de la primera pasada (ver más abajo). De
ahora en más, **antes de dar cualquier bloque de backend por cerrado**:
reiniciar el proceso real administrado por la Tarea Programada (no alcanza
con una instancia temporal en otro puerto) y correr la verificación contra
ese proceso. Una instancia temporal prueba que el código es correcto; no
prueba que esté desplegado. Costo real de este paso: al reiniciar,
`express-session` (`MemoryStore`, sin backing persistente) desloguea
cualquier sesión activa — aceptado explícitamente por el cliente como
parte del proceso, no un efecto secundario a evitar.

## Regla de CSS: nunca opacity para señalar estado inactivo sobre texto o badges

Agregada tras el tercer hallazgo del mismo bug (ver Bloque B4/hallazgo de
contraste más abajo, y ADR 0013 para los dos primeros). Atenuar con
`opacity` un contenedor que tiene texto o badges adentro es, en los hechos,
una apuesta: funciona hasta que el color de base ya estaba cerca del
mínimo de 4.5:1, y entonces cae por debajo — silenciosamente, sin que nada
lo avise salvo una auditoría de contraste real. Pasó tres veces en este
proyecto (Vencimientos, la sidebar navy, y ahora dos veces más en esta
misma ronda: Historial y la clase compartida de fila inactiva). Regla
explícita de acá en adelante: el estado inactivo/anulado/deshabilitado se
comunica con badges de texto explícito, bordes, o tokens de color con
contraste ya verificado (mismo criterio que ya se usó para la sidebar
navy) — nunca con `opacity` sobre un contenedor que tiene texto adentro.
Auditado el resto del CSS del proyecto buscando otros casos no detectados
todavía por axe-core: un solo uso adicional de `opacity` estático,
`.boton-primario:disabled` — no es el mismo caso (WCAG exime
explícitamente a los controles deshabilitados del requisito de contraste,
y axe-core no lo marca), así que se dejó sin cambios.

## Bloque A — Verificaciones que ya estaban hechas

NIT en el recibo (ADR 0016... en realidad agregado antes de ese ADR, ver
`comandos-escpos.js`) y proveedor en movimientos de inventario (ADR 0016)
ya estaban implementados — reconfirmado leyendo el código real, no
asumido, tal como se pidió.

## Hallazgo crítico: el backend real nunca había corrido el código nuevo

Verificando el Bloque F (borrado de proveedores) con evidencia real,
`DELETE /api/proveedores/999999` contra el servidor real (puerto 3000)
devolvió 404 de Express (ruta inexistente), no el 404 de negocio esperado.
Causa: todo el trabajo de backend de las últimas rondas (ADR 0015, 0016)
se había probado exclusivamente contra instancias temporales aisladas en
otros puertos — el proceso real, administrado por la Tarea Programada,
nunca se reinició, así que seguía corriendo el código de antes de esas
rondas. El frontend (sin paso de build) ya estaba sirviendo la UI nueva,
así que cualquier uso real de esas features durante ese lapso habría
fallado. Confirmado con el cliente antes de reiniciar (implica desloguear
cualquier sesión activa — `express-session` con `MemoryStore`, sin backing
persistente); reiniciado con su autorización explícita, verificado
después con el mismo `DELETE` (esta vez el 404 fue el de negocio real,
`proveedores.service.js`, con su stack trace propio en el log).

## Bloque B — Bugs confirmados

**B1**: el lector de código de barras (`barcode-scanner.js`, global desde
ADR 0015) no llenaba el campo "Código de barras" del formulario de
Productos — solo alimentaba la búsqueda del carrito del mostrador, sin
importar qué pantalla estuviera activa. `main.js` ahora enruta el código
escaneado según contexto: si `#overlay-form-producto` está abierto, lo
escribe en `#input-producto-codigo-barras`; si no, sigue el comportamiento
de siempre (buscar y agregar al carrito). Verificado que la búsqueda por
nombre del mostrador sigue intacta (no toca ese camino).

**B2**: el formulario de alta de Productos se veía roto (campo superior
cortado, fondo filtrándose). Causa real, confirmada con captura y medición
antes de asumir: `.overlay__panel` no tenía `max-height` ni `overflow-y`
— un panel más alto que el viewport (el formulario de alta tiene ocho
campos) se centraba sin límite, empujando la mitad de arriba por encima de
`y=0`, inalcanzable, con el fondo de la página visible en esa franja
porque ahí no había caja del panel cubriéndola (medido: panel de 944px en
viewport de 800px, `top: -72px`). Fix: `max-height: calc(100vh - 3rem)` +
`overflow-y: auto` — el panel ahora se achica y scrollea internamente.
Confirmado visualmente antes y después.

**B3**: reconfirmado ya corregido (ver ADR 0015/0016: `overflow-x: auto`
en `.catalogo__tabla`).

**B4**: el gráfico "Comparativa contra ayer" cortaba la etiqueta de monto
de la barra más alta contra el badge de arriba. Causa: cuando una barra
alcanzaba el 100% de `ALTO_BARRAS`, su etiqueta caía en `y≈2` del viewBox
SVG, casi en el borde — se recortaba por el propio SVG y quedaba encimada
con el badge. Fix: `MARGEN_ETIQUETA` reserva espacio arriba incluso para
la barra más alta posible. Confirmado con captura antes/después.

## Bloque C — Auditoría responsive: los dos ítems abiertos, cerrados

**Botones de Usuarios/Proveedores**: `.catalogo__fila-acciones
.boton-secundario` tenía `min-height: 36px`, por debajo del estándar de
44px del resto del proyecto — el override se quitó, quedan al mismo
mínimo que cualquier otro botón.

**Sidebar en anchos chicos**: a 375px, `.nav-lateral` (220px fijos) le
dejaba 155px al contenido (59% ocupado, medido con Puppeteer real, no a
ojo). Por debajo de 768px pasa de barra fija a cajón (drawer): oculta por
defecto (`transform: translateX(-100%)`), un botón de hamburguesa nuevo en
la cabecera la abre, un fondo semitransparente la cierra al tocarlo afuera
(mismo patrón de overlay ya usado en el resto de la interfaz, sin agregar
un mecanismo nuevo) — también cierra con Escape y al navegar a otra
sección. Verificado con Puppeteer real: con el cajón cerrado, el
`scrollWidth` de la página a 375px pasó a coincidir exactamente con el
`clientWidth` (0px de excedente, antes 131-361px según la sección) — la
sidebar era la causa dominante del scroll horizontal que quedaba
pendiente desde la auditoría anterior.

## Bloque D — Rediseño del formulario de Productos (implementado)

Verificado antes de asumir: el formulario de alta **no** arrancaba con un
selector de producto existente — era un formulario en blanco real (nombre
y precio vacíos). La confusión reportada era enteramente el bug B2 (el
título "Nuevo producto" quedaba invisible, cortado arriba del viewport) —
con B2 corregido, el formulario ya se veía como lo que es.

Implementado, confirmado por el cliente: agrupación en tres secciones
visuales (Información básica → Precio → Stock, con encabezados en
mayúscula sin convertir el formulario en un asistente de varios pasos —
sigue siendo un único formulario que scrollea). `tipoVenta` ahora es
editable tanto en alta como en edición (revierte la decisión original,
documentada en `productos.schema.js` y en el comentario de cabecera de
`catalogo.js`). Como gramos y unidades no son convertibles entre sí,
cambiar el tipo de venta en edición revela una advertencia inline y un
campo de "stock actual (formato nuevo)" **obligatorio** — nunca queda en
blanco o en 0 sin que la persona lo note. El campo del tipo anterior
(`stockUnidades`/`stockGramos`) se limpia a `NULL` explícito en
`productos.service.js` (no alcanza con "no mandarlo": dejaría el CHECK de
exclusión mutua de la migración 002 violado apenas se guarde el tipo
nuevo) — doble validado, en el cliente y en el servidor, cada uno
independiente. `stockMinimo` se limpia por el mismo motivo (queda en la
unidad vieja, sería un umbral de alerta silenciosamente equivocado).
"Stock inicial" del producto activo (el normal, sin cambio de tipoVenta)
sigue sin ser editable acá — corregirlo sigue siendo tarea de un
movimiento de ajuste en Inventario (ADR 0005), sin cambios en ese punto.

## Bloque E — Eliminación de precio_mayorista y "Tipo de precio"

Auditoría de datos reales antes de tocar nada: los 13 productos con
`precio_mayorista` no nulo y las 2 ventas históricas con
`tipo_precio='mayorista'` son enteramente datos de demo de este mismo
cierre (inactivos, en la caja de prueba ya cerrada) — cero datos reales
afectados, confirmado por consulta directa antes de proceder.

Implementado: `precioMayorista` removido de `productos.schema.js`
(crear/actualizar) y `productos.repository.js` (mapeo, columnas, INSERT).
Frontend: campo quitado del formulario de Productos (label "Precio
público" pasa a "Precio", sin nada que contrastar), columna de precios en
la tabla ya no muestra el segundo valor, selector "Tipo de precio" quitado
del mostrador. `cart.js` ya no mantiene estado de tipoPrecio — el precio
de una línea es siempre el de catálogo, salvo override explícito.

**Alcance deliberadamente acotado, no tocado**: `ventas.schema.js` /
`ventas.service.js` siguen aceptando `tipoPrecio` como antes (el
mostrador ahora lo manda fijo en `'publico'`) — no se tocó el contrato de
ventas, `resolverPrecioAplicado`, ni la tabla `ventas` (`tipo_precio`
sigue existiendo, ya inalcanzable desde la UI real). Ampliar ese alcance
implicaría tocar reportes/historial sin necesidad real hoy.

**Opinión técnica sobre la columna `precio_mayorista` de la base**: se
dejó en su lugar, sin usar, en vez de correr una migración de `DROP
COLUMN`. Un DROP es efectivamente irreversible (recuperar la columna
requeriría restaurar desde backup); dejarla ahí, ya sin ningún código que
la lea o escriba, tiene costo real cero — nunca vuelve a aparecer en
ningún response de la API ni en ninguna pantalla. Si en algún momento se
quiere el DROP físico igual, es una migración chica y aislada que se puede
pedir aparte, sin apuro ni riesgo de quedar a mitad de camino.

## Bloque F — Borrado real de proveedores

Ya implementado (ADR 0016) — la duda del cliente era legítima: el backend
real nunca había corrido ese código (ver más arriba, "hallazgo crítico").
Reverificado con evidencia real contra el servidor ya reiniciado.

## Bloque G — Imágenes de producto (removido por completo — ver ADR 0020)

**Toda esta sección queda como registro histórico.** La funcionalidad
descrita abajo se implementó, se probó con el mismo rigor que el resto de
este ADR (Puppeteer + axe-core + Lighthouse contra el servidor real) y
funcionó correctamente en las tres pantallas donde se integró (Mostrador,
Productos, Inventario). Se retiró por completo más adelante — decisión de
negocio, no un fallo técnico ni algo que dejara de andar: la complejidad
operativa real de fotografiar todo el catálogo del negocio no se
justificaba frente al valor que aportaba. Ver ADR 0020 para el detalle
completo de qué se quitó y por qué.

**G1** (subida real, implementado): `multer` (única dependencia nueva,
exclusivamente de backend) sobre un endpoint dedicado, `POST
/api/productos/foto` (admin-only, `multipart/form-data` — el resto del
módulo de productos sigue siendo JSON puro). Guardado en `uploads/` (la
carpeta ya provisionada desde ADR 0009/0013, no una nueva), con nombre de
archivo generado con `crypto.randomUUID()` — nunca el nombre original que
manda el navegador, evita colisiones y cualquier intento de path
traversal por el nombre. Validación de tipo (JPG/PNG) y tamaño (3MB)
duplicada en cliente (feedback inmediato) y servidor (la que realmente
importa — mimetype declarado por el cliente más extensión real del
archivo, no solo uno de los dos). El frontend sube el archivo primero, y
recién con el `fotoNombreArchivo` real que devuelve el servidor arma el
resto del payload de `POST`/`PATCH /api/productos` — ese contrato no
cambió, `fotoNombreArchivo` ya lo aceptaba.

Reemplazo de foto: `productos.service.js` borra el archivo viejo de
`uploads/` (best-effort, nunca tumba la operación si falla) **solo
después** de que el `UPDATE` en la base ya tuvo éxito — si el guardado
fallara, el archivo viejo sigue siendo el que la fila todavía referencia,
borrarlo antes dejaría una foto rota. Verificado con Puppeteer real contra
el servidor real (no una instancia temporal, ver regla de proceso):
subir una foto real, confirmar que aparece un único archivo nuevo en
`uploads/`, editar el mismo producto con una foto distinta, confirmar que
sigue habiendo un único archivo (nombre nuevo, el viejo genuinamente
desaparecido del disco) — no una inferencia, una lectura directa del
directorio antes y después.

**G2** (implementado): la lista de movimientos de Inventario ahora muestra
la foto del producto (`/uploads/${fotoNombreArchivo}`) o el mismo
placeholder ya usado en el mostrador (`iconoPaqueteVacio`) si no tiene una
— tamaño fijo (2.5rem cuadrado) para que la ausencia de imagen nunca
descuadre la fila, mismo criterio que la grilla del mostrador (con el
mismo fallback a placeholder si el archivo referenciado no carga).

## Bloque H — Indicadores más completos

**H1** (implementado): la tarjeta "Ventas totales" ahora incluye debajo un
desglose (hora, medio de pago, monto) de hasta 8 ventas del período
seleccionado, excluyendo anuladas (mismo filtro que ya aplica el total de
arriba) — con un contador de "+N venta(s) más" si hay más. El link "Ver
detalle en Historial" abre Historial ya filtrado por ese mismo rango de
fecha (`historial.js` ahora acepta un rango opcional; sin rango, mismo
comportamiento de siempre — "hoy" — así que un click normal de la sidebar
no queda pegado a un filtro viejo). `main.js` expone `mostrarVista` para
que Indicadores pueda navegar a Historial sin duplicar la lógica de
cambio de sección.

**H2** (descripciones cortas, implementado): texto exacto confirmado por
el cliente, sin modificar, debajo de cada título:
"El monto promedio que dejó cada venta en este período." (Ticket
promedio) y "Cuánto más (o menos) se vendió comparado con el período
anterior equivalente." (Comparativa).

## Bloque I — Checkbox de impresión

Reverificado tras los cambios del Bloque E (que sí toca el flujo de cobro
del mostrador): el checkbox sigue presente, marcado por defecto, y
`ventas.service.js` sigue respetando el flag sin cambios — Bloque E no
tocó `ventas.service.js` en absoluto.

## Dos bugs de contraste preexistentes, encontrados y corregidos de paso

Mismo patrón ya documentado dos veces antes (ADR 0013: Vencimientos,
sidebar navy) — atenuar con `opacity` sobre un fondo sólido puede bajar un
badge ya al límite por debajo de 4.5:1. Encontrado dos veces más con
axe-core real durante las pruebas de este cierre, no buscado a propósito:

- `.historial__fila--anulada { opacity: 0.7 }` bajaba el badge "Anulada" y
  la hora a 3.55:1 / 4.02:1 en tema oscuro.
- `.catalogo__fila--inactivo { opacity: 0.85 }` (compartida por
  Productos/Usuarios/Vencimientos/Proveedores) bajaba el badge "Inactivo"
  a 4.28:1 en tema claro — disparado por un proveedor de prueba ya
  inactivo de antes en la base ("perro hpa").

Mismo fix en ambos casos: quitar la opacity, reemplazar por un borde más
marcado (`--color-borde-fuerte`) — el badge de texto explícito ("Anulada"
/ "Inactivo") ya es la señal real, la opacity nunca fue necesaria para
comunicar el estado. Verificado con axe-core en los cuatro consumidores de
la clase compartida (Productos, Usuarios, Vencimientos, Proveedores) más
Historial, ambos temas, sin nuevas violaciones.

## Verificación

**Primera pasada** (Puppeteer + axe-core contra una instancia aislada, ver
regla de proceso de arriba): 14/14 verificaciones funcionales tras el
ajuste de los dos bugs de contraste.

**Segunda pasada** (D, C, H2 ya confirmados por el cliente): reiniciado el
proceso real de la Tarea Programada (con autorización explícita, cada vez
— ver regla de proceso), verificado contra ese proceso, no una instancia
temporal. 16/16 verificaciones: login real, las dos descripciones exactas
de H2 presentes, los tres grupos del formulario de Productos, `tipoVenta`
editable y habilitado tanto en alta como en edición, la advertencia +
campo de stock nuevo apareciendo y desapareciendo correctamente al cambiar
y revertir el tipo de venta, botones de Usuarios/Proveedores en 44x44
real, la sidebar arrancando oculta a 375px con el botón de menú visible,
cero scroll horizontal de página con el cajón cerrado, apertura/cierre
correctos del cajón (botón y click en el fondo). axe-core: 0 violaciones
en todas las superficies tocadas, ambos temas. Lighthouse contra el
servidor real: accesibilidad 100, mejores prácticas 96 (mismo hallazgo ya
conocido, 401/404 esperados), rendimiento 98, SEO 100.

**Tercera pasada** (G1, ya confirmado por el cliente): reiniciado el
proceso real otra vez (`multer` es una dependencia nueva, hace falta que
el proceso la cargue), verificado contra ese proceso. 10/10
verificaciones: rechazo real de un archivo de 4MB (por encima del límite)
sin llegar a subirlo, preview con un archivo válido, creación real de un
producto con foto (un archivo nuevo y real aparece en `uploads/`, leído
directo del directorio, no inferido), la edición muestra la foto ya
guardada como referencia, reemplazo de foto deja exactamente un archivo
en disco con nombre distinto al anterior (el viejo confirmado ausente).
axe-core: 0 violaciones en Productos con foto real y en Inventario tras
la subida. Lighthouse contra el servidor real: accesibilidad 100,
rendimiento 98. Datos y archivos de prueba de esta pasada limpiados
después de verificar (producto de prueba borrado de la base, su archivo
borrado de `uploads/`).

## Cierre de la ronda

Con G1 implementado, los nueve bloques (A-I) de este pedido consolidado
quedan cerrados. Lo único que sigue en cola, fuera de este ADR, es la
auditoría inmutable (cierres de caja, anulaciones, cambios de precio) —
pendiente de que el cliente pida seguir con eso.
