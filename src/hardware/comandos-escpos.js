// Funciones puras que arman buffers de comandos ESC/POS crudos. No tocan
// disco ni red — eso es responsabilidad de impresion.service.js. Separar
// "qué se manda a la impresora" de "cómo se manda" es lo que permite
// cambiar el método de transporte (ver ADR 0007) sin tocar este archivo.

const iconv = require('iconv-lite');

const ESC = 0x1b;
const GS = 0x1d;

// Tabla de caracteres FIJA de fábrica de esta impresora (confirmada con
// diagnóstico físico en test-codepages.js): CP850, sin importar qué se le
// mande con ESC t — el comando no tiene ningún efecto en este modelo, así
// que no se envía (ver más abajo). Todo el texto tiene que codificarse a
// mano en CP850 antes de convertirse en bytes.
const CODEPAGE_IMPRESORA = 'cp850';

// Ancho típico de una impresora térmica de 58mm en modo texto (Font A).
const ANCHO_TICKET = 32;

// Nombre fijo del negocio: a diferencia de NOMBRE_IMPRESORA_COMPARTIDA,
// esto no varía según cómo quede configurado el equipo — es el mismo para
// toda la vida de esta instalación, así que no amerita variable de entorno.
// Partido en dos líneas a propósito: completo (33 caracteres) no cabe en
// una sola línea de 32 — se detectó probando este archivo antes de darlo
// por terminado.
const NOMBRE_NEGOCIO_LINEA_1 = 'Avícola y Salsamentaria';
const NOMBRE_NEGOCIO_LINEA_2 = 'Doña Olga';

// Mismos datos fijos que el nombre — no varían por instalación, así que
// tampoco van a variable de entorno. Ambas líneas miden bien menos que
// ANCHO_TICKET (21 y 17 caracteres respectivamente), no hace falta
// partirlas como el nombre.
const DIRECCION_NEGOCIO = 'Calle 33A Sur # 78-23';
const TELEFONO_NEGOCIO = 'Tel: 312 501 2879';

function inicializar() {
  // Solo ESC @ (reset). Se probó ESC t con varios valores (0-5, 16-19)
  // contra la impresora física y no cambia nada: este modelo ignora el
  // comando y usa siempre su tabla de fábrica (CP850). Mandarlo sería
  // ruido sin efecto — ver ADR 0007.
  return Buffer.from([ESC, 0x40]);
}

function texto(cadena) {
  return iconv.encode(`${cadena}\n`, CODEPAGE_IMPRESORA);
}

function negrita(activar) {
  return Buffer.from([ESC, 0x45, activar ? 1 : 0]);
}

// ESC p 0 25 250: pulso de apertura del cajón monedero, por el pin 2
// (m=0) — confirmado con prueba física aislada mandando un solo pin a la
// vez (ver ADR 0007 y diagnostico-cajon.js). t1=25/t2=250 son unidades de
// 2ms: 50ms de pulso encendido, 500ms apagado, el valor estándar para
// este comando. NO se manda también el pin 1 "por si acaso" — ya se
// confirmó cuál es, mandar los dos sería ruido.
function abrirCajon() {
  return Buffer.from([ESC, 0x70, 0x00, 25, 250]);
}

// GS V 1: corte parcial. Muchas impresoras de 58mm baratas no traen
// cuchilla (son de rasgado manual); si el modelo no la tiene, el comando
// simplemente no produce ningún efecto visible, sin causar error.
function cortar() {
  return Buffer.from([GS, 0x56, 0x01]);
}

function formatearMoneda(pesos) {
  const signo = pesos < 0 ? '-' : '';
  const conSeparadores = Math.abs(pesos).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${signo}$${conSeparadores}`;
}

function centrar(linea) {
  // Trunca antes de centrar: el nombre del negocio ("Avícola y
  // Salsamentaria Doña Olga", 33 caracteres) es justo un caso real que se
  // pasa por uno del ancho de 32 — lo detecté probando este archivo.
  const lineaAjustada = linea.length > ANCHO_TICKET ? linea.slice(0, ANCHO_TICKET) : linea;
  const espacios = Math.max(0, Math.floor((ANCHO_TICKET - lineaAjustada.length) / 2));
  return ' '.repeat(espacios) + lineaAjustada;
}

// Alinea dos textos en una línea de ANCHO_TICKET caracteres: izquierda
// pegada al margen izquierdo, derecha pegada al margen derecho. Si no
// caben los dos, trunca la izquierda en vez de desbordar la línea.
function lineaDosColumnas(izquierda, derecha) {
  const espacioDisponible = ANCHO_TICKET - derecha.length - 1;
  const izquierdaAjustada = izquierda.length > espacioDisponible ? izquierda.slice(0, Math.max(0, espacioDisponible)) : izquierda;
  const relleno = Math.max(1, ANCHO_TICKET - izquierdaAjustada.length - derecha.length);
  return izquierdaAjustada + ' '.repeat(relleno) + derecha;
}

// item.cantidad viene en gramos para productos por peso; en el recibo se
// muestra en kilos con coma decimal (convención colombiana: el punto ya
// se usa como separador de miles en formatearMoneda).
function formatearCantidadYPrecioUnitario(item) {
  if (item.tipoVentaProducto === 'peso') {
    const kilos = (item.cantidad / 1000).toFixed(3).replace('.', ',');
    return `  ${kilos} kg x ${formatearMoneda(item.precioUnitarioAplicado)}/kg`;
  }
  return `  ${item.cantidad} x ${formatearMoneda(item.precioUnitarioAplicado)}`;
}

// `venta` debe traer los items ya enriquecidos con nombreProducto y
// tipoVentaProducto (ver ventas.service.js) — ventas_items solo guarda
// productoId, no el nombre, porque el snapshot de venta es de precio, no
// de datos descriptivos del producto (ver ADR 0003).
function construirRecibo(venta) {
  const partes = [
    inicializar(),
    negrita(true),
    texto(centrar(NOMBRE_NEGOCIO_LINEA_1)),
    texto(centrar(NOMBRE_NEGOCIO_LINEA_2)),
    negrita(false),
    texto(centrar(DIRECCION_NEGOCIO)),
    texto(centrar(TELEFONO_NEGOCIO)),
    texto('-'.repeat(ANCHO_TICKET)),
    texto(`Fecha: ${venta.creadaEn}`),
    texto(`Pago: ${venta.medioPago}`),
    texto('-'.repeat(ANCHO_TICKET)),
  ];

  for (const item of venta.items) {
    partes.push(texto(item.nombreProducto.slice(0, ANCHO_TICKET)));
    partes.push(texto(lineaDosColumnas(formatearCantidadYPrecioUnitario(item), formatearMoneda(item.subtotal))));
  }

  partes.push(
    texto('-'.repeat(ANCHO_TICKET)),
    negrita(true),
    texto(lineaDosColumnas('TOTAL:', formatearMoneda(venta.total))),
    negrita(false),
    texto(''),
    texto(centrar('Gracias por su compra')),
    texto(''),
    texto(''),
    cortar()
  );

  return Buffer.concat(partes);
}

module.exports = {
  ANCHO_TICKET,
  inicializar,
  texto,
  negrita,
  cortar,
  abrirCajon,
  formatearMoneda,
  construirRecibo,
};
