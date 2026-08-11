# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Sin publicar]

### Agregado

- Estructura base del proyecto (Node.js + Express 5).
- Conexión a SQLite vía `better-sqlite3`, con `journal_mode = WAL` y
  `foreign_keys = ON`.
- Runner de migraciones propio (`src/db/migrate.js`) con tabla de control
  `schema_migrations`.
- Middleware central de manejo de errores y clase `AppError`.
- Middleware de validación genérico con `zod`.
- Logger propio a archivo (`logs/app.log`).
- Endpoint `GET /api/health` para verificar que el servidor está vivo.
- Documentación base: README, ARCHITECTURE, y primer ADR sobre la arquitectura
  general del proyecto.
