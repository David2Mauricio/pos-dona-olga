# ADR 0007: Impresión térmica vía impresora compartida de Windows, sin librería nativa

## Estado

Aceptado.

## Contexto

Con el hardware físico ya conectado y probado: la impresora térmica de
58mm funciona compartida localmente en Windows con el nombre `POS58`, y
acepta comandos ESC/POS crudos enviados con
`copy /b archivo.bin \\localhost\POS58`. Esto se confirmó con pruebas
reales, no es una suposición.

La alternativa habría sido una librería npm dedicada a impresoras ESC/POS
(`escpos`, `node-thermal-printer` con acceso USB/serial directo, etc.).
Varias de esas librerías dependen de paquetes con compilación nativa
(`node-gyp`) para hablar con el puerto USB/serial directamente.

## Decisión

Usar exactamente el método ya confirmado funcionando, sin introducir
dependencias nuevas:

1. Los comandos ESC/POS se arman a mano como un `Buffer`
   (`src/hardware/comandos-escpos.js`), sin librería de impresión.
2. Ese buffer se escribe a un archivo temporal y se envía con el comando
   nativo de Windows `copy /b`, vía `child_process.exec`
   (`src/hardware/impresion.service.js`).
3. El nombre de la impresora compartida **no va hardcodeado**: es la
   variable de entorno `NOMBRE_IMPRESORA_COMPARTIDA` (default `'POS58'`),
   porque es un dato específico de cómo quede nombrada la impresora en el
   Windows del negocio el día de la instalación — no una constante del
   sistema. Mismo criterio que `DESCONTAR_STOCK_AUTOMATICO` y
   `DIAS_ALERTA_VENCIMIENTO`.

**Misma razón que ya evitó una dependencia nativa para SQLite
(`better-sqlite3` en vez de un driver que necesitara compilar contra la
base de datos):** simplicidad y reproducibilidad en el entorno real de
instalación. Es un portátil Windows de un negocio pequeño, sin garantía de
que quien lo reinstale en el futuro (la propia Dherazo Solutions u otra
persona) tenga Visual Studio Build Tools configurado. Un `copy /b` no
depende de nada que no traiga Windows de fábrica.

## La impresión nunca bloquea ni revierte una venta

La venta ya ocurrió en la realidad — el cliente ya pagó — antes de que el
recibo termine de imprimirse. Imprimir es una consecuencia de la venta,
nunca una condición para que la venta exista. Concretamente:

- `imprimirReciboDeVenta(venta)` se llama en `ventas.service.js`
  **después** de que `db.transaction()` ya hizo commit, nunca dentro de
  ella.
- La llamada es *fire-and-forget*: no se espera (`await`) su resultado
  antes de responder al cliente HTTP. `POST /api/ventas` responde 201 en
  cuanto la venta está guardada, sin importar si la impresión ya terminó,
  sigue en curso, o va a fallar.
- `impresion.service.js` está escrito para **no rechazar nunca** su
  promesa: cualquier error (impresora apagada, sin papel, nombre de
  impresora mal configurado, lo que sea) se atrapa internamente y se
  logea con el logger central. `ventas.service.js` además envuelve la
  preparación del recibo en su propio `try/catch` como red de seguridad
  adicional — ninguna falla de impresión debe poder propagarse hasta la
  transacción de venta.
- Si la impresión falla, el cajero puede reimprimir manualmente con
  `POST /api/ventas/:id/reimprimir`, que reconstruye el recibo a partir de
  la venta ya guardada.

## Cajón monedero: fuera de alcance de software

El puerto DK de la impresora térmica (el que controla el cajón monedero)
está dañado por una caída previa del equipo, confirmado por descarte
durante las pruebas físicas (comandos correctos, ambos pines probados,
pulso al máximo, sin respuesta). No es un problema de código: es hardware
no funcional. El cajón se opera manualmente con la llave física. Se
documenta en ARCHITECTURE.md como limitación de hardware conocida, no
como funcionalidad pendiente.

## Codificación de caracteres: CP850 fijo de fábrica, sin soporte de `ESC t`

La primera versión de este ADR mandaba `ESC t 16` como "mejor esfuerzo" de
selección de codepage, sin poder verificarlo contra hardware real. Con la
impresora física delante, se diagnosticó empíricamente en vez de seguir
adivinando: `src/hardware/diagnostico-codepages.js` imprimió los mismos 12
bytes crudos (la zona donde viven las vocales acentuadas y la `ñ`) bajo 10
valores distintos de `ESC t n` (0-5, 16-19). **Las 10 líneas salieron
idénticas** — el comando no tiene ningún efecto en este modelo, y la
impresora usa siempre su tabla fija de fábrica: **CP850**, confirmado
porque esos mismos bytes ya imprimían á/é/í/ó/ú/ñ/Ñ correctamente sin
ningún comando de selección.

En consecuencia:

- `inicializar()` ya **no** manda `ESC t` — no tiene efecto en este
  hardware, es ruido.
- Todo el texto se codifica a CP850 con `iconv-lite`
  (`iconv.encode(cadena, 'cp850')`), dentro de la función `texto()` de
  `comandos-escpos.js` — el único punto por el que pasa cualquier texto
  antes de convertirse en bytes. `iconv-lite` es JS puro (sin
  compilación nativa), consistente con la misma razón del resto de este
  ADR.

**Bug encontrado y corregido en el proceso — advertencia para quien toque
este archivo más adelante:** la primera implementación de `texto()`
codificaba con `'latin1'`, no con `'cp850'`. Son tablas completamente
distintas para los caracteres acentuados (el byte de `á` es `0xE1` en
Latin-1 pero `0xA0` en CP850, la tabla real de esta impresora). El síntoma
era exactamente el reportado: tildes y `ñ` mal impresas, mientras números
y texto sin acentos se veían perfectos, porque ASCII puro es idéntico en
ambas tablas — lo que hizo parecer, al principio, que el problema era el
comando `ESC t` y no la codificación del texto en sí. **Si en el futuro
el ticket vuelve a imprimir tildes mal, lo primero que hay que revisar es
que `texto()` siga usando `CODEPAGE_IMPRESORA` (`'cp850'`) y que ningún
texto nuevo se arme con `Buffer.from(str, ...)` directo sin pasar por
`texto()`/`iconv.encode`.**

Antes de tocar el código se descartó `iconv-lite` como sospechoso:
`src/hardware/diagnostico-encoding.js` compara los bytes que produce la
librería para `cp850`/`ibm850` contra los valores ya confirmados en el
diagnóstico físico, y coinciden exactos — la librería nunca fue el
problema, era la elección de codec en `texto()`.

## Herramientas de diagnóstico (para el próximo cambio de impresora)

Si en el futuro se reemplaza esta impresora por otro modelo o clon, es
probable que su tabla de caracteres fija sea distinta. Quedan dos scripts
permanentes en `src/hardware/` para repetir este mismo diagnóstico sin
adivinar número por número:

- `diagnostico-codepages.js`: imprime la misma cadena de bytes crudos bajo
  10 valores de `ESC t n`, para leer directo del papel cuál (si alguno)
  corresponde a la tabla real de la impresora nueva.
- `diagnostico-encoding.js`: compara lo que produce `iconv-lite` para
  `cp850`/`ibm850` contra los bytes ya confirmados, para descartar la
  librería antes de sospechar de `comandos-escpos.js`.

Se corren manualmente (`node src/hardware/diagnostico-codepages.js`,
`node src/hardware/diagnostico-encoding.js`); no forman parte de ningún
flujo automático de la aplicación.

## Consecuencias

- Si en el futuro se cambia de impresora o de método de conexión (ej. USB
  directo sin compartir por Windows), el único archivo que debería
  cambiar es `src/hardware/impresion.service.js`; `comandos-escpos.js`
  (los comandos en sí) no depende de cómo se transporta el buffer.
- Si la impresora nueva usa una tabla de caracteres distinta a CP850,
  `CODEPAGE_IMPRESORA` en `comandos-escpos.js` es el único valor que
  debería cambiar (previo diagnóstico con las herramientas de arriba).
