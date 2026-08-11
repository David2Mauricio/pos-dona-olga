const { z } = require('zod');

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
const fotoNombreArchivoSchema = z.string().trim().min(1, 'El nombre de archivo no puede ser una cadena vacía');

const crearProductoSchema = z
  .object({
    categoriaId: z.number().int().positive(),
    nombre: nombreSchema,
    tipoVenta: z.enum(['unidad', 'peso']),
    codigoBarras: codigoBarrasSchema.nullish(),
    precioPublico: precioSchema,
    precioMayorista: precioSchema.nullish(),
    stockUnidades: stockSchema.nullish(),
    stockGramos: stockSchema.nullish(),
    fotoNombreArchivo: fotoNombreArchivoSchema.nullish(),
    activo: z.boolean().default(true),
  })
  .strict();

// tipoVenta NO aparece acá a propósito: una vez creado el producto no se
// puede cambiar (invalidaría el historial de stock). Si el negocio lo
// necesita, se desactiva el producto y se crea uno nuevo. Con .strict(),
// si el cliente igual manda tipoVenta, zod lo rechaza como campo
// desconocido en vez de ignorarlo en silencio.
const actualizarProductoSchema = z
  .object({
    categoriaId: z.number().int().positive(),
    nombre: nombreSchema,
    codigoBarras: codigoBarrasSchema.nullish(),
    precioPublico: precioSchema,
    precioMayorista: precioSchema.nullish(),
    stockUnidades: stockSchema.nullish(),
    stockGramos: stockSchema.nullish(),
    fotoNombreArchivo: fotoNombreArchivoSchema.nullish(),
    activo: z.boolean(),
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

const idParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

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
