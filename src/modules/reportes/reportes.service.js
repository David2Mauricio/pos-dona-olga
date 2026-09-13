const repository = require('./reportes.repository');
const inventarioService = require('../inventario/inventario.service');
const vencimientosService = require('../vencimientos/vencimientos.service');
const ventasRepository = require('../ventas/ventas.repository');
const gastosService = require('../gastos/gastos.service');
const { generarCsv } = require('../../utils/csv');

const LIMITE_TOP_PRODUCTOS = 10;

// Todas las fechas del rango, con o sin ventas -- para el gráfico de
// tendencia (ver ADR de exportación CSV/gastos/redondeo/gráficos): sin
// rellenar los días sin ventas en $0, la línea saltaría directo entre los
// días que sí tuvieron, dando una forma falsa. Aritmética en UTC a
// propósito (T00:00:00Z + 24h): desde/hasta son fechas de calendario
// simples, no momentos con huso horario -- construir en UTC evita
// cualquier corrimiento de día por el huso horario del servidor.
function enumerarFechas(desde, hasta) {
  const fechas = [];
  let actual = new Date(`${desde}T00:00:00Z`);
  const fin = new Date(`${hasta}T00:00:00Z`);
  while (actual <= fin) {
    fechas.push(actual.toISOString().slice(0, 10));
    actual = new Date(actual.getTime() + 24 * 60 * 60 * 1000);
  }
  return fechas;
}

function reporteVentas({ desde, hasta, cajaSesionId }) {
  const filtros = { desde, hasta, cajaSesionId };
  const totales = repository.obtenerTotalesVentas(filtros);

  const filasPorDia = repository.obtenerVentasPorDia(filtros);
  const mapaPorDia = new Map(filasPorDia.map((fila) => [fila.fecha, fila]));
  const ventasPorDia = enumerarFechas(desde, hasta).map((fecha) => ({
    fecha,
    total: mapaPorDia.get(fecha)?.total ?? 0,
    cantidadVentas: mapaPorDia.get(fecha)?.cantidadVentas ?? 0,
  }));

  // Gastos del período + ganancia real (ver ADR de exportación CSV/gastos/
  // redondeo/gráficos, punto confirmado con el cliente): reutiliza
  // gastos.service.js en vez de duplicar su lógica, mismo criterio que
  // reporteInventario() ya hace con inventario/vencimientos. Solo gastos
  // ACTIVOS entran acá (ver gastos.repository.js:obtenerTotalPorRango).
  const totalGastos = gastosService.obtenerTotalPorRango({ desde, hasta });

  return {
    ...totales,
    // Redondeado como las demás cifras de dinero (entero COP, ADR 0002) —
    // null si no hubo ventas, no 0, para que el frontend pueda distinguir
    // "ticket promedio de $0" (imposible) de "todavía no hay ventas".
    ticketPromedio: totales.cantidadVentas > 0 ? Math.round(totales.totalVentas / totales.cantidadVentas) : null,
    desglosePorMedioPago: repository.obtenerDesglosePorMedioPago(filtros),
    ventasPorDia,
    topProductos: repository.obtenerTopProductos(filtros, LIMITE_TOP_PRODUCTOS),
    ventasPorCategoria: repository.obtenerVentasPorCategoria(filtros),
    unidadesVendidas: repository.obtenerUnidadesVendidas(filtros),
    totalGastos,
    gananciaReal: totales.totalVentas - totalGastos,
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

const ENCABEZADOS_EXPORTACION = ['Fecha', 'Hora', 'Total', 'Medio de pago', 'Monto recibido', 'Vuelto', 'Estado', 'Motivo de anulación'];

// Incluye ventas anuladas a propósito (confirmado con el cliente): el
// contador necesita el cuadro completo, no solo lo que quedó facturado —
// `estado`/`motivoAnulacion` como columnas lo dejan auto-explicativo.
// Fuente: ventas.repository.js:listar(), la misma función que ya usa
// Historial (a diferencia de reportes.repository.js:construirFiltro, que
// excluye anuladas a propósito para los totales agregados).
function exportarVentasCsv({ desde, hasta }) {
  const ventas = ventasRepository.listar({ desde, hasta }).slice().reverse(); // cronológico, no el DESC de Historial

  const filas = ventas.map((venta) => {
    const [fecha, hora] = venta.creadaEn.split(' ');
    return [fecha, hora, venta.total, venta.medioPago, venta.montoRecibido ?? '', venta.vuelto ?? '', venta.estado, venta.motivoAnulacion ?? ''];
  });

  return generarCsv(ENCABEZADOS_EXPORTACION, filas);
}

module.exports = { reporteVentas, reporteInventario, exportarVentasCsv };
