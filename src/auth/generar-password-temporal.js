const crypto = require('node:crypto');

// Compartido entre seed-admin.js y usuarios.service.js: la contraseña
// temporal SIEMPRE la genera el sistema al azar, nunca la elige quien
// crea el usuario — así "temporal" es una garantía real, no un nombre
// que alguien le pone a "1234" y nunca cambia. Alfabeto sin caracteres
// visualmente ambiguos (0/O, 1/l/I) porque alguien la va a tener que
// transcribir a mano al cajero nuevo.
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
const LARGO = 12;

function generarPasswordTemporal() {
  const bytes = crypto.randomBytes(LARGO);
  let resultado = '';
  for (let i = 0; i < LARGO; i += 1) {
    resultado += ALFABETO[bytes[i] % ALFABETO.length];
  }
  return resultado;
}

module.exports = generarPasswordTemporal;
