# Backend — herramienta de prevención y compliance educativo (LOPIVI)

API REST en Node.js + Express que sustituye al almacenamiento en navegador del prototipo. El cálculo lo realiza el motor compartido `@compliance/engine` en el servidor.

## Arquitectura

- **Capa de datos intercambiable** (`src/store/`): misma interfaz, dos adaptadores.
  - `memoryStore.js` — en memoria, para desarrollo y pruebas (sin base de datos).
  - `pgStore.js` — PostgreSQL de producción; fija `app.consultancy_id` en cada petición para que la **RLS** (ver `schema.sql`) aísle a cada inquilino.
- **Motor** (`src/engine/`): `engine.js` + `engine-io.js` (validación/normalización). En producción sería el paquete versionado `@compliance/engine`.
- **Middleware** (`src/middleware.js`): autenticación JWT, modelo de errores uniforme.
- **Rutas** (`src/routes.js`): auth, centros, campañas, participante.

```
src/
  config.js        · configuración y utilidades (hash, códigos, tokens)
  middleware.js    · auth JWT + manejo de errores
  routes.js        · endpoints
  app.js           · fábrica de la app Express
  server.js        · arranque + siembra de usuario demo (en memoria)
  store/           · memoryStore.js · pgStore.js · index.js
  engine/          · engine.js · engine-io.js  (paquete compartido)
test/flow.test.js  · prueba de integración del flujo completo
```

## Puesta en marcha

```bash
npm install

# Desarrollo (en memoria, con usuario demo)
npm start                     # crea demo@consultora.test / demo1234
# → API en http://localhost:3000  (GET /health)

# Pruebas de integración (17 comprobaciones, incl. aislamiento entre inquilinos)
npm test

# Producción (PostgreSQL)
psql "$DATABASE_URL" -f ../schema.sql     # aplica el esquema una vez
STORE=pg DATABASE_URL=postgres://... JWT_SECRET=... npm start
```

Variables de entorno en `.env.example`.

## Rutas implementadas

Autenticadas (Bearer JWT):
- `POST /auth/login` · `GET /me`
- `GET /centers` · `POST /centers` · `GET /centers/:id`
- `POST /centers/:id/campaigns`
- `GET /campaigns/:id` (participación) · `GET /campaigns/:id/model` (motor)
- `POST /campaigns/:id/document` (genera el .docx personalizado)
- `GET /campaigns/:id/export` (JSON agregado) · `POST /campaigns/:id/links`
- `PATCH /campaigns/:id` · `DELETE /campaigns/:id/responses`
- `GET /audit` (registro de auditoría del inquilino)

Públicas (por token, sin cuenta):
- `GET /p/:token` (info de campaña + preguntas) · `POST /p/:token/interview` (envío)

## Aislamiento entre inquilinos

Cada operación autenticada resuelve el `consultancy_id` desde el JWT (nunca del cliente). En memoria se filtra por ese identificador; en PostgreSQL se fija `app.consultancy_id` y la RLS restringe las filas. La prueba de integración verifica que un inquilino no accede a datos de otro (respuestas `404`).

## Generación del documento

`POST /campaigns/:id/document` ejecuta el motor y `src/docgen.js` (refactorización de
`generate_personalized.js` a una función `buildDocxBuffer(center, interviews)` que
devuelve un `Buffer`) y responde con el `.docx` personalizado del centro
(`Content-Type` de Word y `Content-Disposition: attachment`). Si la campaña no tiene
entrevistas, responde `409`. `GET /campaigns/:id/export` sigue disponible para obtener
el JSON agregado.

## Límite de peticiones y auditoría

- **Límite de peticiones** (`src/rateLimit.js`): ventana fija en memoria aplicada a `/auth/*` y `/p/:token/*`. Devuelve `429` con cabeceras `X-RateLimit-*` y `Retry-After`. Límites configurables (`RL_AUTH_MAX`, `RL_PARTICIPANT_MAX`). En despliegues con varias instancias, sustituir el almacén en memoria por uno compartido (p. ej. Redis) con la misma interfaz.
- **Auditoría** (`audit_log`): registra login, `login_failed`, creación de centro/campaña/enlaces, envíos de participante, generación de documento y borrado de respuestas, con actor, entidad, IP y fecha. Aislada por inquilino (memoria por filtrado; PostgreSQL por RLS) y consultable en `GET /audit`.

## Siguiente paso

- Conectar el frontend unificado a esta API (sustituir `window.storage` por HTTP).
- Refresco del panel (polling o websockets) desde el frontend.

> Los plazos de conservación, bases jurídicas y medidas de seguridad se rigen por el dossier de gobernanza y RGPD (Fases 0 y 3).
