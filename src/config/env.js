const path = require('node:path');
const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config({ quiet: true });

// Ancla estable e independiente de process.cwd(): src/config -> raíz del
// proyecto. Un DB_PATH relativo en .env (ej. "./data/pos.sqlite") tiene que
// resolver siempre al mismo lugar real sin importar desde qué carpeta se
// haya lanzado el proceso Node — si no, un arranque manual mal ubicado no
// solo escribe en la carpeta equivocada, crea/abre una base de datos vacía
// nueva ahí, enmascarando la real (ver auditoría final 2026-08-19, corrida
// que reveló esta misma fragilidad en DIRECTORIO_BACKUPS).
const RAIZ_PROYECTO = path.resolve(__dirname, '..', '..');

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
  // Redondeo de vuelto en efectivo a la unidad de $100 (ver ADR de
  // exportación CSV/gastos/redondeo/gráficos): apagado por defecto,
  // mismo criterio de flag booleano que DESCONTAR_STOCK_AUTOMATICO —
  // política del negocio que se fija una vez, no algo que se alterne
  // seguido, así que no amerita una tabla de configuración propia.
  REDONDEAR_VUELTO: z
    .enum(['true', 'false'])
    .default('false')
    .transform((valor) => valor === 'true'),
  // Umbral configurable de "próximo a vencer" (ver ADR 0006): no es un
  // dato que el cliente haya definido, así que no se fija en el código.
  DIAS_ALERTA_VENCIMIENTO: z.coerce.number().int().positive().default(3),
  // Nombre de la impresora compartida de Windows (ver ADR 0007): depende
  // de cómo quede configurado el equipo el día de la instalación, no es
  // una constante del sistema.
  NOMBRE_IMPRESORA_COMPARTIDA: z.string().min(1).default('POS58'),
  // Firma las cookies de sesión (ver ADR 0010). A propósito SIN default:
  // es un secreto, no una constante — que el proceso truene si falta es
  // mejor que arrancar con una firma adivinable.
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET debe tener al menos 32 caracteres'),
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
  raizProyecto: RAIZ_PROYECTO,
  // DB_PATH absoluto (ej. otra unidad de disco) se respeta tal cual; uno
  // relativo se ancla a RAIZ_PROYECTO, nunca a process.cwd().
  dbPath: path.isAbsolute(resultado.data.DB_PATH)
    ? resultado.data.DB_PATH
    : path.resolve(RAIZ_PROYECTO, resultado.data.DB_PATH),
  descontarStockAutomatico: resultado.data.DESCONTAR_STOCK_AUTOMATICO,
  redondearVuelto: resultado.data.REDONDEAR_VUELTO,
  diasAlertaVencimiento: resultado.data.DIAS_ALERTA_VENCIMIENTO,
  nombreImpresoraCompartida: resultado.data.NOMBRE_IMPRESORA_COMPARTIDA,
  sessionSecret: resultado.data.SESSION_SECRET,
};

module.exports = env;
