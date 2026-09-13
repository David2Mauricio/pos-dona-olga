const db = require('../../config/database');

// `hasta` se extiende al final del día para que el filtro sea inclusivo,
// mismo criterio que ventas.repository.js e inventario.repository.js.
// `prefijo` es el alias de tabla a usar cuando la consulta hace JOIN (ver
// obtenerTopProductos) y necesita distinguir de qué tabla son las columnas.
//
// Fase 3 (ver ADR 0012): estado='activa' acá también, para que ninguno de
// los tres reportes que usan este filtro (totales, desglose por medio de
// pago, top productos) cuente una venta anulada.
function construirFiltro({ desde, hasta, cajaSesionId }, prefijo = '') {
  const p = prefijo ? `${prefijo}.` : '';
  const condiciones = [`${p}creada_en >= @desde`, `${p}creada_en <= @hasta`, `${p}estado = 'activa'`];
  const parametros = { desde, hasta: `${hasta} 23:59:59` };

  if (cajaSesionId !== undefined) {
    condiciones.push(`${p}caja_sesion_id = @cajaSesionId`);
    parametros.cajaSesionId = cajaSesionId;
  }

  return { clausulaWhere: condiciones.join(' AND '), parametros };
}

function obtenerTotalesVentas(filtros) {
  const { clausulaWhere, parametros } = construirFiltro(filtros);
  const fila = db
    .prepare(
      `SELECT COUNT(*) AS cantidadVentas, COALESCE(SUM(total), 0) AS totalVentas
       FROM ventas
       WHERE ${clausulaWhere}`
    )
    .get(parametros);

  return { totalVentas: fila.totalVentas, cantidadVentas: fila.cantidadVentas };
}

// Mismo criterio que caja.repository.js: TRIM(LOWER(medio_pago)) porque
// no hay todavía un catálogo cerrado de medios de pago (ADR 0004).
function obtenerDesglosePorMedioPago(filtros) {
  const { clausulaWhere, parametros } = construirFiltro(filtros);
  return db
    .prepare(
      `SELECT TRIM(LOWER(medio_pago)) AS medioPago, SUM(total) AS total, COUNT(*) AS cantidadVentas
       FROM ventas
       WHERE ${clausulaWhere}
       GROUP BY TRIM(LOWER(medio_pago))
       ORDER BY total DESC`
    )
    .all(parametros);
}

// Totales agrupados por día dentro del rango, para el gráfico de tendencia
// (ver ADR de exportación CSV/gastos/redondeo/gráficos): a diferencia de
// obtenerTotalesVentas(), que agrega el rango completo en una sola fila,
// esto arma un punto por día. substr(creada_en, 1, 10), no strftime: mismo
// estilo de texto que ya usa el resto de este archivo (creada_en es
// 'YYYY-MM-DD HH:MM:SS', los primeros 10 caracteres ya son la fecha).
function obtenerVentasPorDia(filtros) {
  const { clausulaWhere, parametros } = construirFiltro(filtros);
  return db
    .prepare(
      `SELECT substr(creada_en, 1, 10) AS fecha, COALESCE(SUM(total), 0) AS total, COUNT(*) AS cantidadVentas
       FROM ventas
       WHERE ${clausulaWhere}
       GROUP BY substr(creada_en, 1, 10)
       ORDER BY fecha`
    )
    .all(parametros);
}

// Mismo JOIN/filtro que obtenerTopProductos, sin LIMIT ni GROUP BY --
// unidades vendidas del período completo, no solo del top (rediseño
// visual, Fase 6). Solo productos tipo_venta='unidad': sumar unidades
// junto con gramos de productos por peso daría un número sin significado
// real (2 "unidades" de gaseosa + 500 "unidades" de pechuga no es una
// cifra que diga nada) -- se deja fuera de este total, no se inventa una
// conversión que no existe en el resto del sistema.
function obtenerUnidadesVendidas(filtros) {
  const { clausulaWhere, parametros } = construirFiltro(filtros, 'v');
  const fila = db
    .prepare(
      `SELECT COALESCE(SUM(vi.cantidad), 0) AS unidades
       FROM ventas_items vi
       JOIN ventas v ON v.id = vi.venta_id
       JOIN productos p ON p.id = vi.producto_id
       WHERE ${clausulaWhere} AND p.tipo_venta = 'unidad'`
    )
    .get(parametros);
  return fila.unidades;
}

// Mismo molde que obtenerTopProductos, agrupado por categoría en vez de
// producto, sin LIMIT (rediseño visual, Fase 6 -- donut de distribución
// por categoría). No se deriva de topProductos en el cliente porque ese
// solo trae el top 10: una categoría con muchos productos chicos podría
// vender más en total que el top 10 y quedar subrepresentada.
function obtenerVentasPorCategoria(filtros) {
  const { clausulaWhere, parametros } = construirFiltro(filtros, 'v');
  return db
    .prepare(
      `SELECT c.id AS categoriaId, c.nombre AS nombre, SUM(vi.subtotal) AS total
       FROM ventas_items vi
       JOIN ventas v ON v.id = vi.venta_id
       JOIN productos p ON p.id = vi.producto_id
       JOIN categorias c ON c.id = p.categoria_id
       WHERE ${clausulaWhere}
       GROUP BY c.id, c.nombre
       ORDER BY total DESC`
    )
    .all(parametros);
}

function obtenerTopProductos(filtros, limite) {
  const { clausulaWhere, parametros } = construirFiltro(filtros, 'v');
  return db
    .prepare(
      `SELECT vi.producto_id AS productoId, p.nombre AS nombre,
              SUM(vi.cantidad) AS cantidadVendida, SUM(vi.subtotal) AS totalVendido
       FROM ventas_items vi
       JOIN ventas v ON v.id = vi.venta_id
       JOIN productos p ON p.id = vi.producto_id
       WHERE ${clausulaWhere}
       GROUP BY vi.producto_id, p.nombre
       ORDER BY totalVendido DESC
       LIMIT @limite`
    )
    .all({ ...parametros, limite });
}

// Estimación de venta potencial (stock actual * precio_publico), NO una
// valorización contable (no considera costo de compra). Solo productos
// activos. Para tipo_venta='peso', precio_publico es por kilo pero el
// stock está en gramos, así que se divide entre 1000 (mismo criterio de
// conversión que en el cálculo de subtotal de venta, ADR 0002).
function obtenerValorEstimadoInventario() {
  const fila = db
    .prepare(
      `SELECT COALESCE(SUM(
         CASE
           WHEN tipo_venta = 'unidad' THEN stock_unidades * precio_publico
           WHEN tipo_venta = 'peso' THEN ROUND(stock_gramos * precio_publico / 1000.0)
         END
       ), 0) AS valorEstimado
       FROM productos
       WHERE activo = 1`
    )
    .get();

  return fila.valorEstimado;
}

module.exports = {
  obtenerTotalesVentas,
  obtenerDesglosePorMedioPago,
  obtenerVentasPorDia,
  obtenerTopProductos,
  obtenerVentasPorCategoria,
  obtenerUnidadesVendidas,
  obtenerValorEstimadoInventario,
};
