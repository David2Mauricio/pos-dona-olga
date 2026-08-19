const { z } = require('zod');
const { fechaSchema } = require('../../utils/schemas-comunes');

// Categorías fijas (ver ADR de exportación CSV/gastos/redondeo/gráficos,
// punto confirmado con el cliente) -- no es un catálogo editable, son las
// cuatro que se pidieron.
const CATEGORIAS_GASTO = ['proveedores', 'servicios', 'arriendo', 'otro'];

const crearGastoSchema = z
  .object({
    concepto: z.string().trim().min(1).max(200),
    monto: z.coerce.number().int().positive(),
    fecha: fechaSchema,
    categoria: z.enum(CATEGORIAS_GASTO).optional(),
  })
  .strict();

// Solo desactivar (mismo patrón "no borrar" que usuarios/proveedores) --
// sin edición de concepto/monto/fecha una vez creado: un gasto mal
// registrado se desactiva y se carga de nuevo bien, no se corrige en el
// mismo registro (mismo criterio de integridad que justifica admin-only).
const actualizarGastoSchema = z.object({ activo: z.literal(false) }).strict();

const listarGastosQuerySchema = z
  .object({
    desde: fechaSchema.optional(),
    hasta: fechaSchema.optional(),
    categoria: z.enum(CATEGORIAS_GASTO).optional(),
  })
  .strict();

module.exports = { crearGastoSchema, actualizarGastoSchema, listarGastosQuerySchema, CATEGORIAS_GASTO };
