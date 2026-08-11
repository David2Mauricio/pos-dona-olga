const { z } = require('zod');
const { idParamsSchema } = require('../../utils/schemas-comunes');

const montoSchema = z
  .number()
  .int('El monto debe ser un número entero de pesos COP, sin decimales')
  .nonnegative('El monto no puede ser negativo');

const aperturaSchema = z.object({ montoApertura: montoSchema }).strict();
const cierreSchema = z.object({ montoCierre: montoSchema }).strict();

module.exports = {
  aperturaSchema,
  cierreSchema,
  idParamsSchema,
};
