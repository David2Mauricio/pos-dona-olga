# POS Doña Olga

Sistema de punto de venta a medida para **Avícola y Salsamentaria Doña Olga**.
Desarrollado por Dherazo Solutions.

## Stack

- Node.js + Express 5
- SQLite (`better-sqlite3`) — un solo archivo de base de datos, sin servidor externo
- Validación con `zod`
- Sin frameworks frontend pesados (interfaz de mostrador en HTML/CSS/JS plano, más adelante)

Ver [ARCHITECTURE.md](./ARCHITECTURE.md) para el detalle de capas y convenciones,
y [docs/decisiones/](./docs/decisiones/) para las decisiones grandes ya tomadas (ADRs).

## Requisitos

- Node.js 18 o superior
- npm

## Puesta en marcha

```bash
npm install
cp .env.example .env   # ajusta los valores si hace falta
npm run migrate        # aplica las migraciones pendientes
npm run dev             # levanta el servidor con recarga automática (nodemon)
```

El servidor queda escuchando en `http://localhost:3000` (puerto configurable en `.env`).
Para confirmar que está vivo:

```bash
curl http://localhost:3000/api/health
```

## Scripts disponibles

| Script           | Qué hace                                                        |
|------------------|-------------------------------------------------------------------|
| `npm start`      | Levanta el servidor en modo normal                               |
| `npm run dev`    | Levanta el servidor con `nodemon` (recarga automática)            |
| `npm run migrate`| Aplica las migraciones SQL pendientes en `/migrations`            |

## Estructura del proyecto

```
src/
  config/       # carga de variables de entorno y conexión a SQLite
  db/           # runner de migraciones
  middlewares/  # validación con zod, manejo central de errores
  modules/      # un subdirectorio por módulo de negocio (productos, ventas, ...)
  utils/        # logger, AppError, helpers compartidos
  app.js        # configuración de Express (middlewares, rutas)
  server.js     # punto de entrada del proceso
migrations/     # archivos .sql numerados (001_..., 002_...)
uploads/        # fotos de producto (solo el nombre de archivo va a la BD)
logs/           # logs de la aplicación (no se versionan)
data/           # archivo pos.sqlite (no se versiona)
docs/decisiones/# ADRs: decisiones de arquitectura y su porqué
```

## Estado del proyecto

En desarrollo activo. Ver [CHANGELOG.md](./CHANGELOG.md) para el detalle de avances.
