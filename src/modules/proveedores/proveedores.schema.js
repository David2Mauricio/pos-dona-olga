const { z } = require('zod');
const { idParamsSchema } = require('../../utils/schemas-comunes');

const nombreSchema = z.string().trim().min(1, 'El nombre es obligatorio');
const nitSchema = z.string().trim().min(1, 'El NIT no puede ser una cadena vacía');
const telefonoSchema = z.string().trim().min(1, 'El teléfono no puede ser una cadena vacía');
const direccionSchema = z.string().trim().min(1, 'La dirección no puede ser una cadena vacía');

const crearProveedorSchema = z
  .object({
    nombre: nombreSchema,
    nit: nitSchema.nullish(),
    telefono: telefonoSchema.nullish(),
    direccion: direccionSchema.nullish(),
    activo: z.boolean().default(true),
  })
  .strict();

const actualizarProveedorSchema = z
  .object({
    nombre: nombreSchema,
    nit: nitSchema.nullish(),
    telefono: telefonoSchema.nullish(),
    direccion: direccionSchema.nullish(),
    activo: z.boolean(),
  })
  .partial()
  .strict()
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'Debe incluir al menos un campo para actualizar',
  });

const listarProveedoresQuerySchema = z
  .object({
    activo: z
      .enum(['true', 'false'])
      .transform((valor) => valor === 'true')
      .optional(),
  })
  .strict();

module.exports = {
  crearProveedorSchema,
  actualizarProveedorSchema,
  listarProveedoresQuerySchema,
  idParamsSchema,
};
