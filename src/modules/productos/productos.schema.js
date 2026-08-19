const { z } = require('zod');
const { idParamsSchema } = require('../../utils/schemas-comunes');

// Los rangos/tipos reflejan las mismas reglas que los CHECK de la migración
// 002 (precios y stock en enteros no negativos, tipo_venta limitado a los
// dos valores válidos), para que el rechazo ocurra acá, en el middleware,
// con un mensaje claro, y no como un CHECK constraint failed sin contexto.
const nombreSchema = z.string().trim().min(1, 'El nombre es obligatorio');
const precioSchema = z
  .number()
  .int('El precio debe ser un número entero de pesos COP, sin decimales')
  .nonnegative('El precio no puede ser negativo');
const stockSchema = z
  .number()
  .int('La cantidad debe ser un número entero')
  .nonnegative('La cantidad no puede ser negativa');
const codigoBarrasSchema = z.string().trim().min(1, 'El código de barras no puede ser una cadena vacía');

const crearProductoSchema = z
  .object({
    categoriaId: z.number().int().positive(),
    nombre: nombreSchema,
    tipoVenta: z.enum(['unidad', 'peso']),
    codigoBarras: codigoBarrasSchema.nullish(),
    precioPublico: precioSchema,
    stockUnidades: stockSchema.nullish(),
    stockGramos: stockSchema.nullish(),
    activo: z.boolean().default(true),
    stockMinimo: stockSchema.nullish(),
  })
  .strict();

// tipoVenta SÍ se puede cambiar (ver ADR 0017, revierte la decisión
// original de esta misma sección) — la validación de que venga con el
// stock nuevo en el formato correcto, y que el campo del tipo anterior
// quede en null, vive en productos.service.js:actualizar(), porque
// depende de comparar contra el tipoVenta actual del producto (algo que
// el schema, sin acceso a la base, no puede evaluar).
const actualizarProductoSchema = z
  .object({
    categoriaId: z.number().int().positive(),
    nombre: nombreSchema,
    tipoVenta: z.enum(['unidad', 'peso']),
    codigoBarras: codigoBarrasSchema.nullish(),
    precioPublico: precioSchema,
    stockUnidades: stockSchema.nullish(),
    stockGramos: stockSchema.nullish(),
    activo: z.boolean(),
    stockMinimo: stockSchema.nullish(),
  })
  .partial()
  .strict()
  .refine((datos) => Object.keys(datos).length > 0, {
    message: 'Debe incluir al menos un campo para actualizar',
  });

const listarProductosQuerySchema = z
  .object({
    categoriaId: z.coerce.number().int().positive().optional(),
    activo: z
      .enum(['true', 'false'])
      .transform((valor) => valor === 'true')
      .optional(),
  })
  .strict();

const codigoBarrasParamsSchema = z.object({
  codigo: z.string().trim().min(1),
});

module.exports = {
  crearProductoSchema,
  actualizarProductoSchema,
  listarProductosQuerySchema,
  idParamsSchema,
  codigoBarrasParamsSchema,
};
