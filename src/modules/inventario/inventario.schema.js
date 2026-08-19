const { z } = require('zod');
const { fechaSchema } = require('../../utils/schemas-comunes');

const productoIdSchema = z.number().int().positive();
const motivoSchema = z.string().trim().min(1, 'El motivo es obligatorio');
const cantidadSchema = z.number().int().positive('La cantidad debe ser mayor a cero');
// Solo tiene sentido en 'entrada' -- una salida o un ajuste de conteo no
// vienen de ningún proveedor. Opcional: no todas las entradas necesitan
// quedar atadas a uno (ver migración 012).
const proveedorIdSchema = z.number().int().positive().optional();

// Discriminado por `tipo` a propósito (ADR 0005): entrada/salida y ajuste
// no comparten la misma forma de request. entrada/salida reciben la
// magnitud del movimiento (`cantidad`); ajuste recibe el conteo físico
// real (`stockNuevo`), nunca ambos a la vez. z.discriminatedUnion rechaza
// cualquier mezcla entre las dos formas.
const crearMovimientoSchema = z.discriminatedUnion('tipo', [
  z
    .object({
      tipo: z.literal('entrada'),
      productoId: productoIdSchema,
      cantidad: cantidadSchema,
      motivo: motivoSchema,
      proveedorId: proveedorIdSchema,
    })
    .strict(),
  z
    .object({
      tipo: z.literal('salida'),
      productoId: productoIdSchema,
      cantidad: cantidadSchema,
      motivo: motivoSchema,
    })
    .strict(),
  z
    .object({
      tipo: z.literal('ajuste'),
      productoId: productoIdSchema,
      stockNuevo: z.number().int().nonnegative('El conteo físico no puede ser negativo'),
      motivo: motivoSchema,
    })
    .strict(),
]);

const listarMovimientosQuerySchema = z
  .object({
    productoId: z.coerce.number().int().positive().optional(),
    desde: fechaSchema.optional(),
    hasta: fechaSchema.optional(),
  })
  .strict();

module.exports = {
  crearMovimientoSchema,
  listarMovimientosQuerySchema,
};
