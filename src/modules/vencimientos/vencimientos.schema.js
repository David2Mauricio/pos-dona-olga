const { z } = require('zod');
const { fechaSchema } = require('../../utils/schemas-comunes');

const cantidadSchema = z.number().int().positive('La cantidad debe ser mayor a cero');

const crearLoteSchema = z
  .object({
    productoId: z.number().int().positive(),
    cantidad: cantidadSchema,
    fechaVencimiento: fechaSchema,
  })
  .strict();

// productoId NO es actualizable a propósito: un lote pertenece a un
// producto; si se registró contra el producto equivocado, es un caso para
// corregir cantidad/fecha o dejarlo inactivo, no para reasignarlo.
const actualizarLoteSchema = z
  .object({
    cantidad: cantidadSchema,
    fechaVencimiento: fechaSchema,
    activo: z.boolean(),
  })
  .partial()
  .strict()
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'Debe incluir al menos un campo para actualizar',
  });

const listarLotesQuerySchema = z
  .object({
    productoId: z.coerce.number().int().positive().optional(),
    activo: z
      .enum(['true', 'false'])
      .transform((valor) => valor === 'true')
      .optional(),
  })
  .strict();

module.exports = {
  crearLoteSchema,
  actualizarLoteSchema,
  listarLotesQuerySchema,
};
