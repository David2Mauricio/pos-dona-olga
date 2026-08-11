const db = require('../../config/database');

// Traduce una fila de SQLite (snake_case) al objeto de dominio (camelCase)
// que usa el resto de la aplicación. `activo` se expone como boolean real,
// no como el 0/1 que exige el motor.
function mapearFila(fila) {
  if (!fila) return undefined;

  return {
    id: fila.id,
    categoriaId: fila.categoria_id,
    nombre: fila.nombre,
    tipoVenta: fila.tipo_venta,
    codigoBarras: fila.codigo_barras,
    precioPublico: fila.precio_publico,
    precioMayorista: fila.precio_mayorista,
    stockUnidades: fila.stock_unidades,
    stockGramos: fila.stock_gramos,
    fotoNombreArchivo: fila.foto_nombre_archivo,
    activo: fila.activo === 1,
    stockMinimo: fila.stock_minimo,
    creadoEn: fila.creado_en,
    actualizadoEn: fila.actualizado_en,
  };
}

// Mapa campo de dominio -> columna SQL. Se usa tanto para armar el UPDATE
// dinámico como para validar que un campo recibido realmente corresponde
// a una columna conocida.
const COLUMNA_POR_CAMPO = {
  categoriaId: 'categoria_id',
  nombre: 'nombre',
  codigoBarras: 'codigo_barras',
  precioPublico: 'precio_publico',
  precioMayorista: 'precio_mayorista',
  stockUnidades: 'stock_unidades',
  stockGramos: 'stock_gramos',
  fotoNombreArchivo: 'foto_nombre_archivo',
  activo: 'activo',
  stockMinimo: 'stock_minimo',
};

function crear(producto) {
  const resultado = db
    .prepare(
      `INSERT INTO productos (
         categoria_id, nombre, tipo_venta, codigo_barras,
         precio_publico, precio_mayorista, stock_unidades, stock_gramos,
         foto_nombre_archivo, activo, stock_minimo
       ) VALUES (
         @categoriaId, @nombre, @tipoVenta, @codigoBarras,
         @precioPublico, @precioMayorista, @stockUnidades, @stockGramos,
         @fotoNombreArchivo, @activo, @stockMinimo
       )`
    )
    .run({
      categoriaId: producto.categoriaId,
      nombre: producto.nombre,
      tipoVenta: producto.tipoVenta,
      codigoBarras: producto.codigoBarras ?? null,
      precioPublico: producto.precioPublico,
      precioMayorista: producto.precioMayorista ?? null,
      stockUnidades: producto.stockUnidades ?? null,
      stockGramos: producto.stockGramos ?? null,
      fotoNombreArchivo: producto.fotoNombreArchivo ?? null,
      activo: producto.activo ? 1 : 0,
      stockMinimo: producto.stockMinimo ?? null,
    });

  return obtenerPorId(resultado.lastInsertRowid);
}

function obtenerPorId(id) {
  const fila = db.prepare('SELECT * FROM productos WHERE id = ?').get(id);
  return mapearFila(fila);
}

function obtenerPorCodigoBarras(codigoBarras) {
  const fila = db.prepare('SELECT * FROM productos WHERE codigo_barras = ?').get(codigoBarras);
  return mapearFila(fila);
}

function existeCategoria(categoriaId) {
  return db.prepare('SELECT 1 FROM categorias WHERE id = ?').get(categoriaId) !== undefined;
}

function listar({ categoriaId, activo } = {}) {
  const condiciones = [];
  const parametros = {};

  if (categoriaId !== undefined) {
    condiciones.push('categoria_id = @categoriaId');
    parametros.categoriaId = categoriaId;
  }

  if (activo !== undefined) {
    condiciones.push('activo = @activo');
    parametros.activo = activo ? 1 : 0;
  }

  const clausulaWhere = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
  const filas = db.prepare(`SELECT * FROM productos ${clausulaWhere} ORDER BY nombre`).all(parametros);

  return filas.map(mapearFila);
}

// `cambios` trae solo las claves que el cliente quiso modificar (el
// esquema de actualización es parcial), así que el UPDATE se arma
// dinámicamente a partir de esas claves.
function actualizar(id, cambios) {
  const asignaciones = [];
  const parametros = { id };

  for (const [campo, valor] of Object.entries(cambios)) {
    const columna = COLUMNA_POR_CAMPO[campo];
    if (!columna) continue;

    asignaciones.push(`${columna} = @${campo}`);
    parametros[campo] = campo === 'activo' ? (valor ? 1 : 0) : valor;
  }

  if (asignaciones.length === 0) return obtenerPorId(id);

  db.prepare(
    `UPDATE productos
     SET ${asignaciones.join(', ')}, actualizado_en = datetime('now')
     WHERE id = @id`
  ).run(parametros);

  return obtenerPorId(id);
}

// Descuenta `cantidad` de la columna de stock que corresponda según
// tipo_venta (stock_unidades o stock_gramos), en una sola sentencia
// atómica. El WHERE exige stock suficiente, así que la fila no se toca
// si no alcanza: 0 filas afectadas es la señal de "no había suficiente"
// (o de que el producto no existe), sin necesidad de una transacción
// propia de este repository — la transacción la define quien orquesta
// esta llamada (ver ventas.service.js).
function descontarStock(id, cantidad) {
  const resultado = db
    .prepare(
      `UPDATE productos
       SET
         stock_unidades = CASE WHEN tipo_venta = 'unidad' THEN stock_unidades - @cantidad ELSE stock_unidades END,
         stock_gramos = CASE WHEN tipo_venta = 'peso' THEN stock_gramos - @cantidad ELSE stock_gramos END,
         actualizado_en = datetime('now')
       WHERE id = @id
         AND (
           (tipo_venta = 'unidad' AND stock_unidades >= @cantidad)
           OR
           (tipo_venta = 'peso' AND stock_gramos >= @cantidad)
         )`
    )
    .run({ id, cantidad });

  return resultado.changes;
}

// Suma `cantidad` (siempre positiva) a la columna de stock que corresponda
// según tipo_venta. No necesita guarda de suficiencia: aumentar stock
// nunca puede fallar por falta de stock.
function aumentarStock(id, cantidad) {
  const resultado = db
    .prepare(
      `UPDATE productos
       SET
         stock_unidades = CASE WHEN tipo_venta = 'unidad' THEN stock_unidades + @cantidad ELSE stock_unidades END,
         stock_gramos = CASE WHEN tipo_venta = 'peso' THEN stock_gramos + @cantidad ELSE stock_gramos END,
         actualizado_en = datetime('now')
       WHERE id = @id`
    )
    .run({ id, cantidad });

  return resultado.changes;
}

// Fija la columna de stock que corresponda a un valor absoluto (usado por
// los ajustes de inventario, ver ADR 0005): no suma ni resta, reemplaza.
function fijarStock(id, valorAbsoluto) {
  const resultado = db
    .prepare(
      `UPDATE productos
       SET
         stock_unidades = CASE WHEN tipo_venta = 'unidad' THEN @valorAbsoluto ELSE stock_unidades END,
         stock_gramos = CASE WHEN tipo_venta = 'peso' THEN @valorAbsoluto ELSE stock_gramos END,
         actualizado_en = datetime('now')
       WHERE id = @id`
    )
    .run({ id, valorAbsoluto });

  return resultado.changes;
}

module.exports = {
  crear,
  obtenerPorId,
  obtenerPorCodigoBarras,
  existeCategoria,
  listar,
  actualizar,
  descontarStock,
  aumentarStock,
  fijarStock,
};
