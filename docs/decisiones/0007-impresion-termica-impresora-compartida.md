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

## Consecuencias

- No hay garantía de codepage entre lo que este proyecto envía (texto
  codificado como Latin-1/CP1252) y lo que la impresora interpreta
  internamente para tildes y `ñ`. Se envía `ESC t 16` al inicializar
  (selección de codepage, comúnmente Windows-1252 en impresoras
  compatibles ESC/POS) como mejor esfuerzo, pero debe verificarse
  visualmente contra la impresora física — no hay forma de confirmar esto
  sin el hardware delante.
- Si en el futuro se cambia de impresora o de método de conexión (ej. USB
  directo sin compartir por Windows), el único archivo que debería
  cambiar es `src/hardware/impresion.service.js`; `comandos-escpos.js`
  (los comandos en sí) no depende de cómo se transporta el buffer.
