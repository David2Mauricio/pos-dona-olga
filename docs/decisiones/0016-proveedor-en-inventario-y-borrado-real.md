# ADR 0016: Proveedor en movimientos de inventario, y borrado real de proveedores

## Estado

Aceptado.

## Contexto

Dos puntos verificados/implementados en la misma ronda: si el vínculo
proveedor↔movimiento de inventario (diseñado en un prompt de una sesión
anterior) había quedado implementado, y un borrado real de proveedores
(no solo desactivar) para limpiar altas por error o duplicados.

## Punto 1: proveedor en movimientos de inventario

**Auditado antes de asumir**: no existía nada. `movimientos_inventario` no
tenía `proveedor_id`, el formulario de "Entrada de mercadería" en
Inventario no tenía select de proveedor, y la lista de movimientos no
mostraba ninguno. Confirmado leyendo el schema real de la tabla y el
código de `inventario.js`, no de memoria.

**Implementado**: migración 012 agrega `proveedor_id INTEGER REFERENCES
proveedores(id) ON DELETE RESTRICT` (nullable — solo tiene sentido en
`tipo='entrada'`, ver `inventario.schema.js`). Select opcional
("Sin proveedor" por defecto) en el formulario, poblado solo con
proveedores activos. La lista de movimientos cruza `proveedorId` contra el
catálogo ya cargado (mismo patrón que el cruce de `productoId`) para
mostrar el nombre.

**Bug real encontrado en las propias pruebas de este punto**: el schema y
el repository quedaron bien conectados, pero `inventario.service.js:crear()`
nunca reenviaba `datos.proveedorId` en la llamada a
`repository.crearMovimiento()` — todo movimiento se guardaba con
`proveedor_id = NULL` sin importar lo que se seleccionara en el formulario.
Encontrado con Puppeteer real (el movimiento creado no mostraba el
proveedor en la lista), confirmado leyendo la fila real en la base antes
de asumir dónde estaba el corte, corregido agregando el campo faltante a
esa llamada. Sin este paso de prueba real, el campo hubiera quedado
completamente mudo en producción pese a que schema/repository/UI parecían
correctos por separado.

Proveedores solo se piden/muestran para administrador (mismo criterio que
el resto del módulo Proveedores, admin-only en el backend) — un cajero ve
la lista de movimientos igual, pero sin nombre de proveedor (queda "—"),
para no pedirle `GET /api/proveedores` y recibir un 403 innecesario.

## Punto 2: borrado real de proveedores

Nuevo `DELETE /api/proveedores/:id`, admin-only (heredado del montaje del
router completo en `app.js`, no repetido por ruta). Regla no negociable
confirmada por el cliente: un proveedor con al menos un movimiento de
inventario asociado no se puede borrar — 409 con el mensaje exacto pedido
("Este proveedor ya tiene entradas registradas — desactivalo en vez de
borrarlo, para no perder el historial."). Doble capa: el service valida
explícito antes de intentar el borrado (para dar ese mensaje de negocio
claro), y el FK `ON DELETE RESTRICT` de la migración 012 es la segunda
capa por si algo se le escapara a esa validación.

Frontend: botón "Eliminar" (ícono de basura nuevo, `iconoEliminar`) en
cada fila de proveedor, distinto del toggle activar/desactivar existente,
visible siempre — se deja que el 409 real del backend sea quien explique
por qué no se puede, en vez de adivinar de antemano en el cliente si tiene
movimientos. Confirmación antes de ejecutar con `window.confirm()` nativo
— la instrucción original se cortó a mitad de frase en el mensaje del
cliente ("un diálogo simple,"), así que se tomó la interpretación más
simple y estándar disponible en el stack vanilla; sujeto a corrección si
la intención era otra.

Probado con Puppeteer real: crear dos proveedores, registrar una entrada
con proveedor en uno de ellos, confirmar que el intento de borrado sobre
ese devuelve 409 con el mensaje real (mostrado en un toast, no silencioso)
y que el proveedor sigue en la lista; confirmar que el otro (sin
movimientos) se borra con éxito y desaparece. axe-core: 0 violaciones en
Inventario con proveedor y en Proveedores con el botón nuevo, ambos temas.

## Hallazgo no relacionado, encontrado al auditar (no corregido acá)

`axe-core` marcó `color-contrast` en `.badge-alerta--peligro` (el badge
"Inactivo" de un proveedor) en tema claro: 4.28:1 medido contra el mínimo
de 4.5:1 — un proveedor de prueba preexistente en la base (`id 6, "perro
hpa"`, ya inactivo antes de esta ronda) lo disparó. No es un problema
introducido en este cierre (no se tocó `--color-peligro` ni
`--color-peligro-suave`), y el badge nuevo de este cierre
(`.boton-icono--peligro`) sí pasa limpio en ambos temas. Queda reportado,
no corregido — es un token de color global usado en varios lugares
(Historial, Vencimientos, este badge de proveedores), así que un ajuste
ahí no es un cambio acotado a esta sección.
