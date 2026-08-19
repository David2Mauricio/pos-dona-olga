# ADR 0019: Exportación a CSV, módulo de gastos, redondeo de vuelto, gráficos de tendencia/medio de pago

## Estado

Aceptado, cerrado. Cinco puntos: cuatro features de negocio pedidas en una
sola ronda (exportación CSV, gastos, redondeo de vuelto, gráficos nuevos en
Indicadores) más un quinto que surgió a mitad de camino (logging de acceso
HTTP), motivado por una investigación real documentada acá mismo. Mismas
reglas de proceso y de CSS que ADR 0017 (verificar contra el proceso real
antes de cerrar, nunca `opacity` para señalar estado) y misma disciplina de
auditoría que ADR 0018 (punto único de escritura, sin DELETE/UPDATE
expuesto nunca) — no se repiten acá, ver esos ADR para el porqué de cada
una.

## Punto 1 — Exportación de ventas a CSV

`GET /api/reportes/ventas/exportar?desde&hasta` (admin-only). Confirmado
con el cliente: incluye ventas anuladas, con `estado`/`motivoAnulacion`
como columnas — el contador necesita el cuadro completo, no solo lo
facturado. Columnas: `Fecha, Hora, Total, Medio de pago, Monto recibido,
Vuelto, Estado, Motivo de anulación`.

Fuente de datos: `ventas.repository.js:listar()` (la misma función que ya
usa Historial, incluye anuladas por diseño) — no
`reportes.repository.js:construirFiltro()`, que excluye anuladas a
propósito para los totales agregados. Son dos fuentes con semánticas
distintas, cada una correcta para su propio consumidor.

CSV generado a mano (`src/utils/csv.js`, sin librería): escapado RFC 4180
(comillas si el campo tiene coma/comilla/salto de línea), BOM UTF-8 al
inicio — sin el BOM, Excel en Windows interpreta mal los acentos
("Doña Olga", "anulación") al abrir el archivo directo. `Content-Disposition:
attachment; filename="ventas-{desde}-a-{hasta}.csv"`.

Frontend: botón "Exportar CSV" en la cabecera de Indicadores, usa el mismo
rango que ya se está viendo (`rangoActualParaHistorial`, la misma variable
que ya alimenta el link "Ver detalle en Historial"). Descarga vía blob +
`<a>` sintético, no navegación directa a la URL — así un 401 por sesión
vencida se resuelve con el mismo toast de siempre en vez de que el
navegador abandone la SPA mostrando el JSON crudo del error.

## Punto 2 — Módulo de gastos

**Modelo** (`migrations/015_gastos.sql`): `gastos(id, concepto, monto,
fecha, categoria, usuario_id, activo, creado_en)`. `fecha` es la fecha del
gasto en sí (la elige quien lo registra), separada de `creado_en` (cuándo
quedó cargado en el sistema) — un gasto real suele registrarse días
después de ocurrido. Categorías fijas: `proveedores | servicios | arriendo
| otro`, opcional. Mismo patrón "no borrar, desactivar" que
usuarios/proveedores/productos — sin edición tampoco: un gasto mal
registrado se desactiva y se carga de nuevo bien, no se corrige en el
mismo registro (mismo criterio de integridad que justifica el punto
siguiente).

**Permisos: admin-only**, confirmado con el cliente con el mismo
razonamiento que ajuste manual de inventario (`inventario.service.js:
crear()`, también admin-only): un gasto inventado u omitido esconde o
infla la ganancia real mostrada al dueño — mismo nivel de confianza que
caja y usuarios, no el de un movimiento de stock rutinario.

**Auditoría**: dos acciones nuevas, `registro_gasto` y `baja_gasto`, mismo
criterio que `alta_usuario`/`baja_usuario` — único punto de escritura
(`gastos.service.js`), dentro de la misma transacción que la escritura
real.

**Navegación**: sección propia en la sidebar ("Gastos"), no una pestaña
dentro de una sección existente. Es una entidad de negocio de primer nivel
(como ventas o proveedores), no un aspecto secundario de otra — meterlo en
Indicadores mezclaría "ver métricas" (hoy 100% lectura) con "registrar
datos"; meterlo bajo Inventario no tiene relación conceptual.

**Indicadores**: dos tarjetas nuevas, "Gastos del período" (suma de gastos
activos en el rango) y "Ganancia real" (ventas totales − gastos del
período). `reportes.service.js:reporteVentas()` llama a
`gastos.service.js:obtenerTotalPorRango()`, mismo patrón que ya usa
`reporteInventario()` con inventario/vencimientos — reutiliza el service
ajeno en vez de duplicar su lógica.

## Punto 3 — Redondeo de vuelto configurable

**Activación**: variable de entorno `REDONDEAR_VUELTO` (booleano, default
`false`), mismo patrón que `DESCONTAR_STOCK_AUTOMATICO` — una política de
negocio que se fija una vez, no algo que se alterna seguido, así que no
amerita una tabla de configuración nueva. Redondeo fijo a la unidad de
$100 (no configurable aparte, para no sumar una perilla que no se pidió).

**El problema técnico planteado por el cliente, resuelto así**: columna
nueva `redondeo_vuelto` en `ventas` (entero con signo = vuelto redondeado
− vuelto exacto; `0` si el redondeo está apagado o el medio de pago no es
efectivo). El campo `vuelto` que ya devolvían la API y el recibo pasa a
ser el valor REDONDEADO (lo que realmente se entrega en la mano).
`caja.repository.js:obtenerTotalEfectivo` cambia de `SUM(total)` a
`SUM(total - redondeo_vuelto)`, así `montoTeoricoEfectivo` sigue siendo
exacto con redondeo incluido, sin arrastrar un desvío sistemático. El
reporte de cierre expone el ajuste agregado como su **propio renglón
explícito** ("Ajuste por redondeo de vuelto: −$150"), separado de
"Sobra/Falta" — para que "Sobra/Falta" siga significando exactamente lo
mismo que antes (una diferencia real sin explicación conocida) y el
redondeo nunca se confunda con eso. El renglón se oculta cuando el ajuste
es 0 (redondeo apagado, o ninguna venta en efectivo del período lo
disparó), para no meter ruido en el caso de siempre.

**Sin auditoría por venta** (confirmado con el cliente): el redondeo es un
cálculo determinístico y automático, no una decisión discrecional de una
persona — auditar cada venta redondeada inundaría el registro con ruido
rutinario, y el dato ya queda transparente en la propia venta y en el
desglose de cierre. Si en el futuro existiera un toggle en UI que un admin
prenda/apague, ESE sí sería el momento discrecional a auditar, no cada
venta.

Comportamiento por defecto (`REDONDEAR_VUELTO` sin definir) verificado
byte a byte idéntico al de antes de este cambio: `vuelto` exacto,
`redondeo_vuelto` siempre 0.

## Punto 4 — Gráficos de tendencia y medio de pago

Confirmado el hueco de backend que se sospechaba:
`reportes.repository.js:obtenerTotalesVentas()` agregaba todo el rango en
una sola fila — no existía ningún query agrupado por día. Nueva
`obtenerVentasPorDia(filtros)` (`GROUP BY substr(creada_en, 1, 10)`, mismo
estilo de texto que el resto del archivo). `reportes.service.js` rellena
los días sin ventas en $0 (`enumerarFechas`, aritmética en UTC para evitar
corrimientos por huso horario) — sin esto la línea saltaría directo entre
los días que sí tuvieron ventas y daría una forma falsa.

**Tendencia**: `<polyline>` SVG a mano (mismo patrón que
`renderizarGraficoComparativa`, sin librería). Etiquetas de fecha
repartidas (máximo ~6), no una por punto — un trimestre son ~90 puntos,
una etiqueta por día sería ilegible. Un solo día (período "Día" del
selector) no tiene tendencia que mostrar: mensaje vacío explícito en vez
de una línea degenerada de un solo punto.

**Donut de medio de pago**: reutiliza `desglosePorMedioPago`, que el
backend ya devolvía — cero cambio de backend para este gráfico. Círculos
con `stroke-dasharray`/`stroke-dashoffset` acumulado, rotados −90° para
que el primer segmento arranque a las 12. Leyenda con swatch + porcentaje
+ monto debajo.

## Punto 5 — Logging de acceso HTTP (surgido de una investigación real)

### El incidente

A mitad de la implementación del Punto 1, se encontró que la sesión de
caja real (id 52), abierta de forma continua durante gran parte del
proyecto, aparecía cerrada, con dos sesiones adicionales (53, 54) de
existencia breve. Investigación pedida explícitamente por el cliente antes
de asumir causa, con tres preguntas puntuales:

1. **¿Había algún log de acceso que registrara TODAS las peticiones,
   exitosas incluidas?** No — `logger.js` solo escribe lo que el código
   llama explícitamente (`info`/`warn`/`error`); `error-handler.js` solo
   deja rastro cuando algo falla. Ninguna petición exitosa quedaba
   registrada en ningún lado. Confirmado como un hueco de visibilidad real,
   independiente de cómo terminara la investigación.
2. **¿Alguna prueba de esta sesión de trabajo apuntó por error al puerto
   real (3000)?** Se auditaron los 15 scripts del historial completo que
   mencionan `localhost:3000`; solo uno se había ejecutado ese día
   (`test-real-server.js`), releído línea por línea: solo login, lectura
   del badge, click en Cancelar (`type="button"`, sin ningún `fetch`
   asociado) y lectura de Auditoría — ninguna acción que pudiera cerrar
   una caja.
3. **Timestamps exactos**: las sesiones 53/54 resultaron ser del día
   ANTERIOR (corrección sobre el reporte inicial, que las había mirado por
   hora sin fijarse en la fecha), en un horario sin ningún script propio
   corriendo. El cierre de la sesión 52 sí fue el mismo día, pero con una
   brecha de ~7 minutos respecto a cuándo terminó de correr el único
   script que tocó el puerto real — sin superposición de horarios.

**Conclusión**: sin evidencia de que las pruebas hayan causado el cierre.
Patrón (apertura temprano en la mañana, monto redondo, cierre casi
inmediato) consistente con actividad real de apertura/corrección del
negocio. El cliente confirmó que no podía descartarlo con certeza absoluta
pero aceptó la investigación como suficiente para seguir adelante, con el
pedido explícito de cerrar el hueco de visibilidad para la próxima vez.

### El fix

`src/middlewares/access-log.js`, montado como el primer middleware de
`app.js` (antes que cualquier otro, para que el status final quede
correcto sin importar en qué capa se resuelva o rechace la petición).
Registra método, ruta, status, timestamp, duración, y el usuario de sesión
si lo hay (`req.session.usuario.usuario` — nunca credenciales, nunca el
body de la petición). Archivo propio por día (`logs/acceso/acceso-AAAA-MM-DD.log`),
separado de `logs/app.log` a propósito: no mezclar el log de aplicación
(eventos explícitos, bajo volumen) con el de acceso (cada petición, alto
volumen). Retención de 14 días, mismo criterio que
`backup.service.js:RETENCION_MAXIMA`, limpiada una vez al iniciar el
proceso.

Verificado contra el servidor real tras el reinicio: cada petición queda
registrada con el usuario correcto (`usuario=demo_test_admin` en las
peticiones autenticadas de esta misma verificación), sin excepción.

## Verificación

Contra una copia aislada de la base real (puerto 3001, mismo criterio que
ADR 0017/0018 — nunca contra la caja real, ni siquiera para abrir/cerrar
de prueba, hasta que el cliente confirmó explícitamente que la copia
aislada estaba fuera del alcance de "no tocar la caja"):

- **Punto 1**: endpoint verificado directo (BOM correcto, columnas,
  filename, 401/403/400), 6/6 Puppeteer (descarga real vía CDP
  `Page.setDownloadBehavior`, contenido del archivo verificado byte a
  byte), Lighthouse accesibilidad/mejores prácticas/SEO 100.
- **Middleware de acceso**: verificado que cada petición (incluido login,
  sin filtrar la contraseña) queda registrada; retención de 14 días
  verificada con archivos simulados.
- **Punto 4**: backend verificado directo (15 días, relleno en $0
  correcto), 14/14 Puppeteer (caso "Día" sin tendencia, caso "Trimestre"
  con etiquetas repartidas, ambos temas), Lighthouse 100/100/100.
- **Punto 3**: matemática del redondeo verificada directo (vuelto exacto
  5030 → redondeado 5000 → delta −30 → montoTeoricoEfectivo ajustado
  correctamente a 55030), 4/4 Puppeteer (renglón visible con signo
  correcto, monto teórico correcto, axe-core limpio), comportamiento
  default-off verificado idéntico al de antes.
- **Punto 2**: 19/19 verificaciones funcionales (permisos, validaciones,
  filtro por categoría, desactivación, auditoría de ambas acciones,
  `totalGastos`/`gananciaReal` en reportes), 12/12 Puppeteer (alta desde
  la UI, sin botón de borrado en ningún lado, ambos temas), Lighthouse
  100/100/100.

**Contra el servidor real, tras reiniciar el proceso de la Tarea
Programada**: 10/10 verificaciones de solo lectura — badge de caja leído
sin interactuar con él (ver el incidente de arriba: precaución extra en
esta ronda), botón de exportación, ambos gráficos, ambas tarjetas de
gastos, sección Gastos, axe-core sin violaciones en Indicadores/Gastos/
página completa. Sin crear ninguna venta, gasto, ni tocar la caja real en
ningún momento de esta verificación final.

## Cierre de la ronda

Los cinco puntos (CSV, gastos, redondeo, gráficos, logging de acceso)
quedan cerrados. Sin trabajo pendiente conocido de esta ronda.
