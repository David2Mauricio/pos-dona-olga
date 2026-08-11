# ADR 0001: Monolito modular con SQLite

## Estado

Aceptado.

## Contexto

El sistema es para un solo punto de venta, en un solo equipo (portátil HP
ProBook), sin garantía de internet y sin equipo de infraestructura detrás.
El presupuesto y el alcance del contrato son los de un negocio pequeño, no
los de un sistema que necesite escalar a múltiples sedes o miles de usuarios
concurrentes.

## Decisión

- **Monolito modular**, no microservicios: un solo proceso Express, un solo
  repositorio, capas internas bien separadas (route → controller → service →
  repository) en vez de servicios independientes.
- **SQLite vía `better-sqlite3`**, no un motor cliente-servidor (Postgres,
  MySQL): no hay que instalar ni administrar un servidor de base de datos
  aparte, y toda la base de datos vive en un solo archivo, lo cual simplifica
  backups (copiar el archivo) y la instalación en el equipo del negocio.
  `better-sqlite3` es síncrono, lo que evita la complejidad de manejar
  callbacks/promesas para cada consulta, y no se usa un ORM pesado porque las
  consultas que necesita este sistema son simples y controladas a mano.
- **`journal_mode = WAL`**: el equipo no tiene UPS, así que un corte de luz a
  mitad de una escritura es un riesgo real. WAL reduce la probabilidad de
  corrupción del archivo `.sqlite` frente al modo por defecto (`DELETE`), y de
  paso permite lecturas concurrentes mientras se escribe.
- **Migraciones SQL propias**, numeradas y versionadas en `/migrations`, en
  vez de un framework de migraciones de terceros: el volumen de cambios de
  esquema esperado es bajo y un runner de ~50 líneas (`src/db/migrate.js`) es
  más fácil de entender y mantener a largo plazo que una dependencia externa.

## Consecuencias

- No hay camino trivial a "múltiples cajas escribiendo a la vez sobre la
  misma base de datos" si el negocio llegara a crecer a varios puntos de
  venta simultáneos; ese escenario no está en el alcance actual y, si llega
  a necesitarse, sería una migración de motor de base de datos a evaluar
  aparte (fuera del alcance y presupuesto acordado).
- Todo el estado del negocio vive en un archivo (`data/pos.sqlite`): el
  backup de ese archivo (paso 11 del plan de construcción) es crítico y no
  opcional.
