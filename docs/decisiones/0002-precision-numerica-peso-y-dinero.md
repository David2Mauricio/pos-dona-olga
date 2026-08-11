# ADR 0002: Precisión numérica — peso en gramos, dinero en pesos COP, redondeo único por línea

## Estado

Aceptado.

## Contexto

El negocio vende por peso (ej. 1.250 kg de pechuga) y también por unidad. Guardar
el peso como kilos en `REAL` (punto flotante IEEE 754) puede acumular pequeños
errores de redondeo, el mismo problema clásico que existe al guardar dinero como
decimal. En Colombia, además, no circulan fracciones del peso (no hay centavos
en la calle), así que no hace falta modelar subunidades de moneda.

## Decisión

- **Peso: entero en gramos**, no `REAL` en kilos. 1.250 kg se guarda como `1250`.
- **Dinero: entero en pesos COP**, sin centavos (`precio_publico`, `precio_mayorista`,
  totales de venta, etc.).
- **Consecuencia directa**: si un producto se vende por peso, el precio se define
  por kilo pero el stock/la cantidad vendida está en gramos. El cálculo de una
  línea de venta es:

  ```
  total_linea = round(precio_por_kg * gramos_vendidos / 1000)
  ```

  Aunque `precio_por_kg` y `gramos_vendidos` son ambos enteros, la división por
  1000 puede dar un resultado con decimales (ej. 12000 * 350 / 1000 = 4200.0,
  pero 12500 * 333 / 1000 = 4162.5). Por eso el redondeo (`Math.round`) es
  necesario incluso trabajando solo con enteros.

- **Regla de redondeo — se aplica una sola vez, al final del cálculo de cada
  línea de venta.** Nunca se redondean pasos intermedios (por ejemplo, no se
  redondea un "precio por gramo" antes de multiplicarlo por la cantidad).
  Redondear en varios pasos acumula un error distinto — y potencialmente mayor
  — que redondear una sola vez al final. Esta regla aplica en el service de
  ventas cuando se implemente (no en el repository ni en el controller).

## Consecuencias

- Todas las columnas de peso/cantidad-por-peso en el esquema son `INTEGER`
  (gramos), no `REAL`.
- Todas las columnas de dinero en el esquema son `INTEGER` (pesos COP).
- El módulo de ventas debe centralizar el cálculo de `total_linea` en un único
  punto del service, precisamente para poder garantizar que la regla de
  "redondear una sola vez" se cumpla siempre y no se disperse en varios lugares
  del código.
