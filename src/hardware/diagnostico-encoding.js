// Herramienta manual de diagnóstico — no forma parte de ningún flujo de
// la aplicación. Compara lo que produce `iconv-lite` contra los bytes ya
// confirmados en el diagnóstico físico (diagnostico-codepages.js), para
// descartar la librería como sospechosa antes de tocar comandos-escpos.js
// si en el futuro las tildes vuelven a imprimirse mal. Ver ADR 0007.
//
// Uso: node src/hardware/diagnostico-encoding.js

const iconv = require('iconv-lite');

// Bytes correctos según el diagnóstico físico (CP850 real de esta
// impresora, confirmado con diagnostico-codepages.js):
// á=0xA0 é=0x82 í=0xA1 ó=0xA2 ú=0xA3 ñ=0xA4 Ñ=0xA5.
const ESPERADO = { á: 0xa0, é: 0x82, í: 0xa1, ó: 0xa2, ú: 0xa3, ñ: 0xa4, Ñ: 0xa5 };

const cadena = 'áéíóúñÑ';

function mostrar(nombreCodec, codec) {
  const buffer = iconv.encode(cadena, codec);
  console.log(`\n${nombreCodec} -> hex: ${buffer.toString('hex')}`);

  [...cadena].forEach((caracter, indice) => {
    const byteObtenido = buffer[indice];
    const byteEsperado = ESPERADO[caracter];
    const coincide = byteObtenido === byteEsperado;
    console.log(
      `  '${caracter}' -> obtenido 0x${byteObtenido.toString(16).padStart(2, '0')}` +
        ` | esperado 0x${byteEsperado.toString(16).padStart(2, '0')} ${coincide ? 'OK' : 'DIFERENTE'}`
    );
  });
}

console.log(`Cadena de prueba: ${cadena}`);
console.log(`Soporta 'cp850': ${iconv.encodingExists('cp850')}`);
console.log(`Soporta 'ibm850': ${iconv.encodingExists('ibm850')}`);

mostrar('cp850', 'cp850');
mostrar('ibm850', 'ibm850');
