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
