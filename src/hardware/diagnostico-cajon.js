// Herramienta manual de diagnóstico — no forma parte de ningún flujo de
// la aplicación. Manda el pulso de apertura de cajón (ESC p) a UN solo
// pin a la vez, para confirmar cuál de los dos lo dispara realmente antes
// de integrarlo al código de producción. Ver ADR 0007.
//
// Uso: node src/hardware/diagnostico-cajon.js 0   (prueba el pin 2, m=0)
//      node src/hardware/diagnostico-cajon.js 1   (prueba el pin 5, m=1)

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execSync } = require('node:child_process');

const ESC = 0x1b;

const pin = Number(process.argv[2]);
if (pin !== 0 && pin !== 1) {
  console.error('Uso: node src/hardware/diagnostico-cajon.js <0|1>');
  process.exit(1);
}

// ESC p m t1 t2 — m = pin (0 o 1), t1/t2 = duración del pulso en unidades
// de 2ms. 25/250 (50ms encendido / 500ms apagado) es el valor estándar
// más común en impresoras compatibles ESC/POS para este comando.
const comando = Buffer.from([ESC, 0x70, pin, 25, 250]);

const archivoTemporal = path.join(os.tmpdir(), `diagnostico-cajon-pin${pin}.bin`);
fs.writeFileSync(archivoTemporal, comando);

const nombreImpresora = process.env.NOMBRE_IMPRESORA_COMPARTIDA || 'POS58';
execSync(`copy /b "${archivoTemporal}" "\\\\localhost\\${nombreImpresora}"`);
console.log(`Pulso enviado al pin ${pin} (m=${pin}). ¿Se abrió el cajón?`);
