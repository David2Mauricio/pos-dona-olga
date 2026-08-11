// Herramienta manual de diagnóstico — no forma parte de ningún flujo de
// la aplicación. Úsala si en el futuro se cambia de impresora y las
// tildes/ñ vuelven a salir mal: imprime los mismos 12 bytes crudos bajo
// 10 valores de ESC t n, para leer directo del papel cuál corresponde a
// la tabla de caracteres real de la impresora (si alguno). Ver ADR 0007.
//
// Uso: node src/hardware/diagnostico-codepages.js

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execSync } = require('node:child_process');

const ESC = 0x1b;
const codepagesAProbar = [0, 1, 2, 3, 4, 5, 16, 17, 18, 19];

const comandos = [Buffer.from([ESC, 0x40])]; // inicializar

for (const n of codepagesAProbar) {
  comandos.push(Buffer.from([ESC, 0x74, n])); // ESC t n
  comandos.push(Buffer.from(`CP${n}: `, 'ascii'));
  // Bytes crudos de la zona donde suelen vivir las vocales acentuadas y la ñ
  const bytes = [0xa0, 0xa1, 0xa2, 0xa3, 0xa4, 0xa5, 0xf1, 0xe1, 0xe9, 0xed, 0xf3, 0xfa];
  comandos.push(Buffer.from(bytes));
  comandos.push(Buffer.from('\n', 'ascii'));
}
comandos.push(Buffer.from('\n\n\n', 'ascii'));

const buffer = Buffer.concat(comandos);
const archivoTemporal = path.join(os.tmpdir(), 'diagnostico-codepages.bin');
fs.writeFileSync(archivoTemporal, buffer);

const nombreImpresora = process.env.NOMBRE_IMPRESORA_COMPARTIDA || 'POS58';
execSync(`copy /b "${archivoTemporal}" "\\\\localhost\\${nombreImpresora}"`);
console.log('Diagnóstico enviado. Revisa el papel: 10 líneas "CPn: " seguidas de los mismos 12 caracteres.');
console.log('La línea donde se lean bien "á é í ó ú ñ" es la tabla real de esta impresora.');
