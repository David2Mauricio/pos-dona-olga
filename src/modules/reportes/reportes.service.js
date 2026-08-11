const repository = require('./reportes.repository');
const inventarioService = require('../inventario/inventario.service');
const vencimientosService = require('../vencimientos/vencimientos.service');

const LIMITE_TOP_PRODUCTOS = 10;

function reporteVentas({ desde, hasta, cajaSesionId }) {
  const filtros = { desde, hasta, cajaSesionId };

  return {
    ...repository.obtenerTotalesVentas(filtros),
    desglosePorMedioPago: repository.obtenerDesglosePorMedioPago(filtros),
    topProductos: repository.obtenerTopProductos(filtros, LIMITE_TOP_PRODUCTOS),
  };
}

// Reutiliza los services de inventario y vencimientos en vez de duplicar
// su lógica de alertas acá — este módulo no agrega reglas de negocio
// nuevas, solo agrega lecturas que ya existen.
function reporteInventario() {
  return {
    valorEstimadoInventario: repository.obtenerValorEstimadoInventario(),
    notaValorEstimado:
      'Estimación de valor de venta potencial (stock actual × precio público). ' +
      'No es una valorización contable: no considera el costo de compra, que el ' +
      'sistema no captura todavía.',
    productosStockBajo: inventarioService.obtenerAlertas(),
    lotesPorVencer: vencimientosService.obtenerAlertas(),
  };
}

module.exports = { reporteVentas, reporteInventario };
