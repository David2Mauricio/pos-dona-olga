// Middleware genérico de validación con zod. Uso típico en una ruta:
//
//   router.post('/', validar(crearProductoSchema), productosController.crear)
//
// Si los datos no cumplen el esquema, respondemos 400 con el detalle de zod
// y el controller nunca llega a ejecutarse.
function validar(schema, origen = 'body') {
  return (req, res, next) => {
    const resultado = schema.safeParse(req[origen]);

    if (!resultado.success) {
      return res.status(400).json({
        error: 'Datos inválidos',
        detalles: resultado.error.issues.map((issue) => ({
          campo: issue.path.join('.'),
          mensaje: issue.message,
        })),
      });
    }

    // Sobrescribimos con los datos ya parseados: zod puede transformar o
    // coercionar tipos (ej. "12.5" -> 12.5), y queremos que el controller
    // reciba siempre datos ya limpios.
    req[origen] = resultado.data;
    next();
  };
}

module.exports = validar;
