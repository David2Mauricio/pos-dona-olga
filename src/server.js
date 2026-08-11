const env = require('./config/env');
const app = require('./app');
const logger = require('./utils/logger');
const { ejecutarMigracionesPendientes } = require('./db/migrate');
const { iniciarBackupsAutomaticos } = require('./backup/backup.service');

// Aplicamos migraciones pendientes automáticamente al arrancar. En un POS de
// un solo punto de venta, sin equipo de infraestructura detrás, esto evita
// el paso manual de "acordarse de migrar" antes de levantar el servicio.
ejecutarMigracionesPendientes();

// Backup automático de la base de datos: uno al iniciar + cada 6 horas
// mientras el proceso esté corriendo (ver ADR 0008).
iniciarBackupsAutomaticos();

app.listen(env.port, () => {
  logger.info(`Servidor escuchando en http://localhost:${env.port} (${env.nodeEnv})`);
});
