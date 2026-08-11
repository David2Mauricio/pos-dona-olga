const { z } = require('zod');
const { idParamsSchema } = require('../../utils/schemas-comunes');

const nombreSchema = z.string().trim().min(1, 'El nombre es obligatorio');

const crearCategoriaSchema = z.object({ nombre: nombreSchema }).strict();

// El único propósito de este PATCH es renombrar, así que a diferencia de
// productos no hace falta un esquema "parcial": nombre es el único campo
// y siempre es obligatorio.
const actualizarCategoriaSchema = z.object({ nombre: nombreSchema }).strict();

module.exports = {
  crearCategoriaSchema,
  actualizarCategoriaSchema,
  idParamsSchema,
};
