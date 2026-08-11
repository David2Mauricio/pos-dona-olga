const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { exec } = require('node:child_process');
const env = require('../config/env');
const logger = require('../utils/logger');
const { construirRecibo, abrirCajon } = require('./comandos-escpos');

// Esta promesa NUNCA rechaza a propósito: imprimir es una acción posterior
// a una venta ya confirmada (ver ADR 0007), así que cualquier fallo se
// atrapa acá, se logea, y listo — nunca debe poder tumbar al llamador.
// Resuelve `true`/`false` solo para quien quiera loguear o mostrar un
// aviso adicional; nadie está obligado a revisarlo.
function imprimir(bufferComandos) {
  return new Promise((resolve) => {
    const archivoTemporal = path.join(os.tmpdir(), `recibo-${Date.now()}-${process.pid}.bin`);

    fs.writeFile(archivoTemporal, bufferComandos, (errorEscritura) => {
      if (errorEscritura) {
        logger.error(`No se pudo escribir el archivo temporal de impresión: ${errorEscritura.message}`);
        return resolve(false);
      }

      const rutaImpresora = `\\\\localhost\\${env.nombreImpresoraCompartida}`;
      const comando = `copy /b "${archivoTemporal}" "${rutaImpresora}"`;

      exec(comando, (errorImpresion) => {
        fs.unlink(archivoTemporal, () => {}); // limpieza best-effort, no bloquea el resultado

        if (errorImpresion) {
          logger.error(
            `Error al imprimir en la impresora compartida "${env.nombreImpresoraCompartida}": ${errorImpresion.message}`
          );
          return resolve(false);
        }

        resolve(true);
      });
    });
  });
}

function imprimirRecibo(venta) {
  return imprimir(construirRecibo(venta));
}

// Mismo patrón best-effort que imprimir(): el pulso de apertura viaja por
// el mismo puerto compartido de la impresora, así que reutiliza imprimir()
// tal cual — best-effort, nunca rechaza, ya viene con el logeo incluido.
function abrirCajonMonedero() {
  return imprimir(abrirCajon());
}

module.exports = { imprimir, imprimirRecibo, abrirCajonMonedero };
