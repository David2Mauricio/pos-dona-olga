# ADR 0027: Indicadores orientados a decisión

## Estado

Aceptado, cerrado.

## Contexto

Tarea 4 del rediseño (la última, dejada para el final por ser la más
grande): las tarjetas compactas de Indicadores mostraban su explicación
siempre visible como texto fijo, ocupando espacio; solo la cifra hero
(Ventas totales) tenía flecha/color de variación real, aunque las otras
4 ya mostraban un badge con signo y color (heredado de la ronda de
mejoras visuales anterior); no había ninguna señal automática que
avisara cuándo una cifra ameritaba mirarla de cerca; y el desglose de
ventas (dentro de la tarjeta hero) seguía mostrando su estado vacío como
texto plano, a diferencia de los 4 gráficos Chart.js que ya usaban
ícono+mensaje desde la ronda anterior.

## Decisión

- **Descripciones → tooltip ⓘ**: las 4 `<p class="indicadores__descripcion">`
  (siempre visibles) se retiran; el mismo texto se mueve a un
  `crearInfoTooltip()` junto al título de cada tarjeta compacta — mismo
  componente que ya usa el resto de la app (Productos, Usuarios).
- **Flechas de variación en las 5 cifras**: los badges de variación ya
  existían con color; se les agrega el ícono de flecha arriba/abajo
  (mismo `iconoFlechaArriba`/`iconoFlechaAbajo` que ya usa Inventario
  para entrada/salida — mismo significado, subió o bajó) para que la
  dirección se lea de un vistazo, no solo por el color o el signo.
- **Advertencias automáticas**: alcance deliberado a **Ganancia real**
  (el "margen" del pedido original) y **Gastos** (su contraparte directa).
  Ticket promedio/Unidades vendidas quedan afuera a propósito: una baja
  ahí no es necesariamente mala (una venta grande sube el ticket un día y
  lo baja al siguiente sin que pase nada raro) — inventar un umbral
  "preocupante" sin un criterio de negocio real detrás sería una alarma
  falsa. Reglas:
  - Ganancia real negativa → "Pérdida en este período" (tono peligro).
  - Ganancia real positiva pero ≥30% menor que el período anterior →
    "Bajó más de 30% vs {período anterior}" (tono alerta).
  - Gastos ≥40% mayores que el período anterior → "Subió más de 40% vs
    {período anterior}" (tono alerta).
  - Sin período anterior con datos (0), no se dispara ninguna
    advertencia — mismo criterio que ya usa `renderizarVariacion` para
    no comparar contra una base de $0.
  Conviven con el badge de variación normal (uno da el contexto exacto en
  %, el otro resalta que amerita atención) — no lo reemplazan.
- **Desglose de ventas**: mismo tratamiento ícono+mensaje que los 4
  gráficos (`mostrarResumenVacio`), antes solo texto.

## Bug encontrado y corregido en el camino

Al verificar el estado vacío (sin advertencias que mostrar), las
cápsulas de advertencia aparecían vacías y visibles igual, en vez de no
mostrarse: `.indicadores__advertencia { display: inline-flex; ... }`
le ganaba en especificidad al `hidden` del navegador — el mismo bug ya
documentado dos veces antes en este archivo (`.overlay__panel
form[hidden]`, `.item-carrito__ajuste-form[hidden]`). Se agregó
`.indicadores__advertencia[hidden] { display: none; }`. Encontrado
verificando visualmente el estado vacío con una captura real, no
asumiendo que "hidden=true en el JS" bastaba.

## Verificación

Contra dos copias aisladas de la base real:

1. **Con datos reales** (ventas hoy $50.000 vs ayer $100.000, gastos hoy
   $80.000 vs ayer $20.000): las 5 cifras muestran flecha+color
   correctos; Ganancia real (-$30.000) dispara "Pérdida en este
   período"; Gastos (+300%) dispara "Subió más de 40%"; los tooltips ⓘ
   muestran el texto movido; cambiar de período (Semana) sigue
   funcionando sin romper nada (Fase 6 intacta); axe-core sin
   violaciones, ambos temas.
2. **Base completamente vacía** (0 ventas, 0 gastos): los 5 estados
   vacíos (4 gráficos + desglose) muestran ícono+mensaje; ninguna
   advertencia se dispara (0 vs 0 no es una caída real); sin la cápsula
   vacía del bug de arriba; axe-core sin violaciones, ambos temas.
