const path = require('node:path');
const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config({ quiet: true });

// Validamos las variables de entorno una sola vez, al arrancar el proceso.
// Preferimos que el servidor truene aquí, con un mensaje claro, a que falle
// a mitad de una venta por una variable mal escrita o ausente.
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  DB_PATH: z.string().min(1),
  // z.coerce.boolean() NO sirve acá: Boolean("false") es true (cualquier
  // string no vacío coerciona a true). Por eso se valida como enum de
  // texto y se transforma a mano. Ver ADR 0003 (descuento de stock
  // reversible por venta).
  DESCONTAR_STOCK_AUTOMATICO: z
    .enum(['true', 'false'])
    .default('true')
    .transform((valor) => valor === 'true'),
});

const resultado = envSchema.safeParse(process.env);

if (!resultado.success) {
  console.error('Configuración de entorno inválida. Revisa tu archivo .env:');
  console.error(resultado.error.format());
  process.exit(1);
}

const env = {
  port: resultado.data.PORT,
  nodeEnv: resultado.data.NODE_ENV,
  isProduction: resultado.data.NODE_ENV === 'production',
  dbPath: path.resolve(process.cwd(), resultado.data.DB_PATH),
  descontarStockAutomatico: resultado.data.DESCONTAR_STOCK_AUTOMATICO,
};

module.exports = env;
