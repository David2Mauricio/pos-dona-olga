const env = require('./config/env');
const app = require('./app');
const logger = require('./utils/logger');
const { ejecutarMigracionesPendientes } = require('./db/migrate');

// Aplicamos migraciones pendientes automáticamente al arrancar. En un POS de
// un solo punto de venta, sin equipo de infraestructura detrás, esto evita
// el paso manual de "acordarse de migrar" antes de levantar el servicio.
ejecutarMigracionesPendientes();

app.listen(env.port, () => {
  logger.info(`Servidor escuchando en http://localhost:${env.port} (${env.nodeEnv})`);
});
