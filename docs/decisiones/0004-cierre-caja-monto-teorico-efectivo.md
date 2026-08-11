# ADR 0004: Cierre de caja — monto teórico de efectivo sin catálogo de medios de pago

## Estado

Aceptado.

## Contexto

El cierre de caja necesita comparar lo que el cajero cuenta físicamente
contra lo que debería haber en la caja. Pero la caja física solo contiene
efectivo — una venta por transferencia o tarjeta no mueve un billete que
alguien pueda contar. Para calcular ese monto teórico hace falta saber
cuánto de las ventas de la sesión fue en efectivo.

El problema: `ventas.medio_pago` es texto libre a propósito (ver ADR 0003),
porque el cliente todavía no define qué medios de pago acepta. No hay un
enum controlado contra el cual comparar.

## Decisión

- El monto teórico de efectivo se calcula como:

  ```
  monto_teorico_efectivo = monto_apertura + SUM(ventas.total)
                            WHERE caja_sesion_id = X
                              AND TRIM(LOWER(medio_pago)) = 'efectivo'
  ```

  La comparación es case-insensitive y tolera espacios extra
  (`TRIM(LOWER(medio_pago)) = 'efectivo'`) para cubrir variaciones obvias
  de escritura ("Efectivo", "EFECTIVO ", " efectivo").

- **Esto es frágil por diseño y es deuda técnica intencional.** Cualquier
  variación que no sea razonablemente "efectivo" (ej. "cash", "contado",
  un error de tipeo) no se contará como efectivo y distorsionará el monto
  teórico. Se acepta esa fragilidad ahora porque no existe todavía un
  catálogo cerrado de medios de pago — eso depende de cómo la dueña reciba
  pagos en la práctica (Nequi, Daviplata, tarjeta, etc.), dato que sigue
  pendiente de confirmar.

  Cuando el cliente confirme sus medios de pago reales, la solución
  correcta es convertir `medio_pago` en un enum controlado (con su
  correspondiente CHECK constraint, como `tipo_venta` o `tipo_precio`) y
  cambiar esta comparación de `TRIM(LOWER(medio_pago)) = 'efectivo'` a una
  igualdad exacta contra el valor del enum. Puede requerir una migración
  de datos si ya hay ventas registradas con variaciones de escritura.

- **El monto teórico y la diferencia contra lo declarado NO se persisten.**
  Son valores derivables de datos que ya existen (`monto_apertura`, las
  ventas de la sesión, y `monto_cierre` una vez declarado), así que se
  calculan al vuelo en `GET /api/caja/:id` (reporte) y en
  `PATCH /api/caja/:id/cierre` (respuesta del cierre). Persistir un valor
  derivado sin necesidad real sería la misma sobre-ingeniería que ya se
  descartó con Docker/microservicios/ORM pesado.

## Consecuencias

- El reporte de caja (`GET /api/caja/:id`) recalcula el desglose por medio
  de pago y el monto teórico de efectivo en cada consulta, agrupando por
  `TRIM(LOWER(medio_pago))`. Para el volumen de un solo punto de venta esto
  no es un problema de rendimiento.
- Variaciones que `TRIM(LOWER(...))` no puede resolver (sinónimos como
  "cash" o "contado", o errores de tipeo) seguirán distorsionando el
  monto teórico hasta que exista el enum controlado.
- La tabla `caja_sesiones` no gana columnas nuevas por esta decisión.
