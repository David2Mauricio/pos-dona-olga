// Generador de CSV mínimo, sin dependencia externa (ver ADR de exportación
// de reportes): un CSV es texto plano simple, no amerita una librería.

// RFC 4180: un campo se entrecomilla si contiene la coma separadora, una
// comilla, o un salto de línea; las comillas internas se duplican.
function escaparCampo(valor) {
  const texto = valor === null || valor === undefined ? '' : String(valor);
  if (/[",\r\n]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

// BOM UTF-8 al inicio: sin esto, Excel en Windows abre el archivo
// interpretando los acentos mal (Latin-1 en vez de UTF-8) — confirmado con
// texto real ("Doña Olga", "anulación").
const BOM_UTF8 = '﻿';

function generarCsv(encabezados, filas) {
  const lineas = [encabezados.map(escaparCampo).join(','), ...filas.map((fila) => fila.map(escaparCampo).join(','))];
  return BOM_UTF8 + lineas.join('\r\n');
}

module.exports = { generarCsv };
