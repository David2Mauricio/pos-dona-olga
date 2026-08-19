const env = require('./config/env');
const app = require('./app');
const logger = require('./utils/logger');
const { ejecutarMigracionesPendientes } = require('./db/migrate');
const { iniciarBackupsAutomaticos, DIRECTORIO_BACKUPS } = require('./backup/backup.service');
const { limpiarAccesoAntiguo } = require('./middlewares/access-log');

// Rutas reales resueltas al arrancar (todas ancladas a env.raizProyecto o a
// env.dbPath, nunca a process.cwd() -- ver ADR 0008, sección "Corrección:
// ruta anclada a DB_PATH"). Visibles en cada arranque para que un problema
// de ubicación se note en el log de inmediato, no cuando falte un backup
// días después. Si el proceso se lanzó desde una carpeta distinta a la
// raíz real del proyecto, ya no rompe nada (las rutas no dependen de eso),
// pero se advierte igual: es la señal exacta de "esto se está lanzando
// distinto a como se espera".
logger.info(`Base de datos: ${env.dbPath}`);
logger.info(`Backups: ${DIRECTORIO_BACKUPS}`);
if (process.cwd() !== env.raizProyecto) {
  logger.warn(
    `El proceso se lanzó desde "${process.cwd()}", distinto de la raíz real del proyecto ("${env.raizProyecto}"). Las rutas de datos no dependen de esto y siguen siendo correctas, pero conviene revisar cómo se está arrancando el servidor.`
  );
}

// Aplicamos migraciones pendientes automáticamente al arrancar. En un POS de
// un solo punto de venta, sin equipo de infraestructura detrás, esto evita
// el paso manual de "acordarse de migrar" antes de levantar el servicio.
ejecutarMigracionesPendientes();

// Backup automático de la base de datos: uno al iniciar + cada 6 horas
// mientras el proceso esté corriendo (ver ADR 0008).
iniciarBackupsAutomaticos();

// Retención del log de acceso: una limpieza al iniciar alcanza (a
// diferencia de los backups, no hace falta repetirla en un intervalo — un
// arranque por día, como mínimo, ya la cubre).
limpiarAccesoAntiguo();

app.listen(env.port, () => {
  logger.info(`Servidor escuchando en http://localhost:${env.port} (${env.nodeEnv})`);
});
