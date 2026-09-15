# ADR 0029: Tarjeta del carrito reorganizada (precio/ajuste y cantidad)

## Estado

Aceptado, cerrado.

## Contexto

Con el scroll interno del carrito ya eliminado (ADR 0028), la tarjeta de
cada ítem por peso quedaba organizada en 4 líneas verticales
independientes: nombre, precio/kg, "Ajustar precio" (su propia línea
completa) y el campo de cantidad (con "kg" como único indicio de qué
representa). Se pidió compactar precio + "Ajustar precio" en una sola
fila, y agregar una etiqueta visible "Cantidad" sobre el campo.

## Decisión

- `crearAjustePrecio()` (`render.js`) pasó de devolver un único
  `<div>` contenedor (botón + formulario juntos) a devolver
  `{boton, formulario}` por separado. Esto permite que el LLAMADOR
  decida el layout: el botón ahora comparte una fila nueva
  (`.item-carrito__fila-precio`, flex + `justify-content: space-between`)
  con el precio/kg existente; el formulario expandible sigue yendo
  debajo, a lo ancho, sin cambios en su propio comportamiento.
- El patrón se aplica a **ambos** tipos de ítem (peso y unidad), no solo
  a peso: la fila precio+ajuste es código compartido entre los dos
  (`filaPrecio`/`crearAjustePrecio` no dependían de `esPeso`), así que
  unificarla mejora la lectura de ambos por igual sin ningún costo — no
  se justificaba bifurcar el código para excluir a los ítems por unidad
  de una mejora que les cabe igual de bien.
- Cantidad por peso: el `<label>` que antes era `visualmente-oculto`
  ahora es visible, con texto corto "Cantidad", puesto en su propia línea
  arriba del campo (`.item-carrito__detalle--peso`, `flex-direction:
  column`). El nombre accesible completo y más específico ("Peso de
  {producto} en kilos" — útil para quien navega por teclado/lector con
  varios ítems en el carrito) se conserva vía `aria-label` en el mismo
  `<label>`, que le gana al texto visible al calcular el nombre accesible
  del campo asociado.
- La variante por **unidad** no cambia: el label se queda oculto (los
  botones +/- ya hacen obvio qué es el campo sin necesitar el texto), y
  el layout sigue en una sola fila (`.item-carrito__detalle` sin el
  modificador `--peso`).
- Fila superior (nombre / subtotal / botón quitar) sin tocar, como se
  pidió explícitamente.

## Verificación

Contra una copia aislada de la base real, un producto por peso y uno por
unidad en el mismo carrito:

- Precio/kg y "Ajustar precio" en la misma fila, el botón a la derecha
  (confirmado con coordenadas reales, no a ojo) — en ambos tipos de
  ítem.
- Label "Cantidad" visible, arriba del campo, con el `aria-label`
  específico intacto.
- Fila superior (nombre, subtotal, quitar) sin cambios.
- Funcional, no solo visual: "Ajustar precio" sigue abriendo el
  formulario y aplicando el precio real (verificado: el precio mostrado
  cambió de $14.000/kg a $12.000/kg tras guardar el ajuste). Editar el
  campo de kg sigue recalculando el subtotal (2kg × $12.000/kg =
  $24.000, exacto). El stepper +/- del ítem por unidad sigue
  recalculando su propio subtotal.
- axe-core sin violaciones, ambos temas.
