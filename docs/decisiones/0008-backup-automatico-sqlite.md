# ADR 0008: Backup automático del archivo SQLite

## Estado

Aceptado.

## Contexto

Todo el estado del negocio vive en un solo archivo (`data/pos.sqlite`,
ver ADR 0001). No hay servidor externo, no hay réplica, no hay nube: si
ese archivo se corrompe o el disco falla, se pierde todo. El equipo no
tiene UPS (ver ADR 0001), así que el riesgo de corte de luz a mitad de
una operación es real, no teórico.

## Decisión

### `.backup()` nativo de better-sqlite3, no copiar el archivo

`db.backup(rutaDestino)` usa el mecanismo de backup incremental del
propio motor SQLite, no una copia de bytes a nivel de sistema de
archivos. La diferencia importa en concreto: con `journal_mode = WAL`
activo (ADR 0001), el estado consistente de la base de datos en un
momento dado no está solo en `pos.sqlite` — parte de las escrituras
recientes vive en `pos.sqlite-wal` hasta que se hace *checkpoint*. Copiar
`pos.sqlite` a mano con `fs.copyFile` mientras hay una escritura en curso
puede capturar un archivo a medias, sin las páginas que todavía están en
el WAL. `.backup()` coordina esto correctamente a nivel de motor — es
justo la razón por la que esa función existe en vez de dejar que cada
aplicación reinvente su propia copia seguro.

### Cada 6 horas + uno al iniciar la aplicación

Un `setInterval` simple, sin librería de cron externa: es un solo proceso
que ya corre indefinidamente en el mismo equipo, agregar una dependencia
para programar una tarea que se repite cada N horas sería sobre-ingeniería
para este caso. El backup al iniciar existe porque el negocio puede
apagar y prender el equipo cada día — sin él, si el proceso no llega a
estar corriendo 6 horas seguidas, podría no generarse ningún backup en
todo el día.

### Retención de 14

Suficiente para cubrir aproximadamente dos semanas de respaldo (con
varios backups por día mientras el negocio opera) y poder recuperar de un
problema que no se detectó de inmediato, sin dejar que `/backups` crezca
indefinidamente en un disco de 256GB que también tiene el sistema
operativo y todo lo demás. Los backups más antiguos se borran
automáticamente al superar ese número.

### Todo asíncrono, todo best-effort

Mismo criterio que la impresión y el cajón (ADR 0007): un backup fallido
(disco lleno, permisos, lo que sea) se logea con el logger central y
nunca tumba la aplicación ni bloquea una petición HTTP en curso. `.backup()`
de better-sqlite3 ya es asíncrono (no bloquea el event loop mientras
copia); la limpieza de backups antiguos usa `fs/promises` por la misma
razón.

## Corrección: ruta anclada a DB_PATH, no a process.cwd() (2026-08-19)

**Defecto real, no un incidente de operación.** `DIRECTORIO_BACKUPS` se
calculaba como `path.resolve(process.cwd(), 'backups')` — la ubicación de
un dato crítico dependía del directorio de trabajo del proceso Node al
momento de arrancar, no de dónde vive realmente el proyecto. Una ronda de
pruebas (auditoría final, `docs/auditoria-final/auditoria-final-
2026-08-19.md`) lanzó por error el servidor desde la carpeta del proyecto
real en un contexto que debía estar aislado: como la ruta dependía de
`process.cwd()`, escribió un backup real en el lugar correcto por
coincidencia, pero la limpieza por retención (máximo 14) borró el backup
real más antiguo (`pos-backup-2026-08-14-0718.sqlite`) — **no
recuperable, no versionado en git**. Evidencia en vivo de que el defecto
tiene consecuencia real, no solo teórica.

**Encontrado en el mismo momento**: el propio `DB_PATH` (`src/config/
env.js`) tenía el defecto idéntico — un valor relativo en `.env`
(`DB_PATH=./data/pos.sqlite`, el caso real de este proyecto) resolvía
también contra `process.cwd()`. Ese es el caso más grave de los dos: un
arranque desde la carpeta equivocada no solo mal ubicaría un backup, abriría
o **crearía una base de datos vacía nueva** en el lugar equivocado,
enmascarando la real. El mismo patrón apareció además en `logger.js`,
`middlewares/access-log.js` y `modules/auditoria/auditoria.service.js`
(los tres con directorios de datos resueltos desde `process.cwd()`) — se
corrigieron los cinco en la misma pasada, mismo defecto, mismo fix.

**Fix**: `src/config/env.js` ancla `DB_PATH` relativo a
`RAIZ_PROYECTO = path.resolve(__dirname, '..', '..')` (la ubicación real
del código en disco, estable sin importar `process.cwd()`) en vez de a
`process.cwd()`; un `DB_PATH` absoluto se respeta tal cual, para no romper
un despliegue que apunte la base a otra unidad a propósito.
`DIRECTORIO_BACKUPS` (`backup.service.js`) se ancla directamente a
`path.dirname(env.dbPath)` — literalmente relativo a dónde vive la base de
datos real, tal como se pidió. `logger.js`, `access-log.js` y
`auditoria.service.js` se anclan a `env.raizProyecto`.

**Verificación**: lanzado el proceso (con `env.js`/`backup.service.js`
cargados en aislamiento, mismas variables de entorno) desde tres
directorios de trabajo distintos — la raíz real del proyecto, un
directorio padre, y uno completamente ajeno — `dbPath` y
`DIRECTORIO_BACKUPS` resolvieron exactamente a la misma ruta absoluta en
los tres casos. Un arranque real del servidor completo desde el directorio
ajeno confirmó además que el backup automático de esa corrida se escribió
en su lugar correcto (dentro del `DB_PATH` de esa prueba), sin tocar la
carpeta `backups/` real del proyecto (quedó en 13 archivos, sin cambios).

**Verificación de arranque agregada** (`src/server.js`): cada arranque
logea la ruta real de `dbPath` y de `DIRECTORIO_BACKUPS` en `INFO`, y
logea un `WARN` explícito si `process.cwd()` no coincide con la raíz real
del proyecto — ya no rompe nada (las rutas no dependen de `cwd`), pero
avisa de inmediato en el log si el proceso se está lanzando de una forma
distinta a la esperada, en vez de que alguien lo note días después por un
backup faltante.

## Consecuencias

- `src/backup/backup.service.js` no sigue el patrón de capas de los
  módulos de negocio (no hay ruta HTTP, no hay usuario que lo dispare):
  es un proceso interno, arrancado una sola vez desde `server.js`, mismo
  criterio que ya se usó para `src/hardware/`.
- `iniciarBackupsAutomaticos(intervaloMs)` acepta el intervalo como
  parámetro (default 6 horas) en vez de fijarlo como constante interna,
  justamente para poder probarlo con un intervalo corto sin esperar 6
  horas reales ni tocar el código de producción.
- Los backups no se suben a git (`/backups` en `.gitignore`, mismo
  criterio que `data/*.sqlite`): son datos reales del negocio, no algo
  que deba versionarse.
