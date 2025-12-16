## Mad Monkey V3 – Full-Stack Architecture

### High-Level Overview

- **Frontend**: Next.js application (`frontend/`) styled with MUI, state managed by Redux Toolkit, and hydrated by a generated TypeScript API client (`frontend/v3/api`). Ships as a web app, with iOS/Android builds via Capacitor for native shells. Google Tag Manager, Sentry, and deep-link listeners provide analytics, observability, and app integration.
- **Backend**: Bun + Hono service (`backend/`) exposing REST APIs described with `@hono/zod-openapi`. Drizzle ORM talks to PostgreSQL for transactional data; MongoDB, Redis, and RabbitMQ support caching, external system sync, and event-driven workflows. Integrations cover Stripe, Cloudbeds, Rezdy, Firebase Admin, and n8n automation.
- **API Contract**: OpenAPI schema served from `backend/src/openapi` and consumed by the frontend code generator (`npm run gen:api`) to keep the stack type-safe.
- **Infrastructure**: Dockerized services for local development (Postgres, MongoDB, RabbitMQ, Redis). Deployments typically run the frontend on Vercel (or coupled DigitalOcean app) and the backend on DigitalOcean with managed databases and queues.

### Backend Architecture (`backend/`)

- **Runtime & Server**
  - Bun runtime with Hono HTTP framework (`src/index.ts` entrypoint).
  - Global middleware for auth, CORS, error handling, and request context (`src/middleware`).
  - Routes organized by domain (`src/routes`), validated via Zod schemas exported to OpenAPI (`src/openapi`).
- **Data & Storage**
  - PostgreSQL (via Drizzle) holds canonical entities: customers, destinations, rooms, loyalty programs.
  - MongoDB caches and aggregates upstream data (Cloudbeds reservations, Rezdy tours, Stripe transactions, SEO JSON).
  - Redis (optional in dev) accelerates hot-path lookups and throttles expensive API calls.
  - S3-compatible storage manages media uploads, with pre-signed URL flows documented in `MEDIA_SERVICE_DOCS.md`.
- **Integrations & Flows**
  - **Authentication**: Firebase Admin validates JWT bearer tokens; legacy WordPress users migrate through `/auth/check-legacy-user` flows detailed in `AUTH_FLOW.MD`.
  - **Bookings**: Stripe payment intents drive checkout. Webhooks from Stripe, Cloudbeds, and Rezdy funnel through RabbitMQ, updating Mongo caches and triggering downstream actions (`ORDER_FLOW.md`, `ROOM_FLOW.md`).
  - **Events**: RabbitMQ event bus (`EVENTBUS_RECOVERY_GUIDE.md`) ensures reliable processing with dead-letter handling and recovery scripts (`scripts/`).
  - **Automation**: n8n workflows consume event bus messages for email, CRM, and marketing automation (`N8N_NOTIFICATION_SERVICE.md`).
- **Code Structure Highlights**
  - `src/services`: business logic (payments, availability, media, loyalty).
  - `src/utils`: cross-cutting helpers (logging, error wrappers, Cloudbeds/Rezdy adapters).
  - `drizzle/`: SQL schema snapshots and migrations.
  - Extensive docs (`backend/docs`) cover architecture diagrams, API reference, deployment, caching, migrations, and troubleshooting.

### Frontend Architecture (`frontend/`)

- **Next.js Application**
  - Pages-based routing under `pages/` with supporting component library split into atoms, molecules, and page-level composites (`components/`).
  - Global styling via `app.scss` and MUI theme definitions (`theme/`).
  - Redux Toolkit store (`store/`) centralizes auth, cart, and user data; contexts/hooks supply auxiliary state (e.g., deep link handling).
  - Capacitor configs (`capacitor.config.*.ts`) back mobile packaging for iOS/Android directories.
- **Data Access**
  - Generated OpenAPI client in `v3/api` provides type-safe services for bookings, destinations, profile, media, and realtime endpoints.
  - API responses cached through Redis when present (see README "Redis Setup"); utilities in `services/` wrap calls with client-side caching and revalidation strategies.
  - Firebase Authentication manages session tokens; unified auth services coordinate Redux state, Firebase tokens, and backend expectations (`docs/APP_STATE_AUTH_MIGRATION.md`, `services/unifiedAuth`).
- **Experience & Instrumentation**
  - Google Tag Manager utility (`utils/gtmTracker.ts`) standardizes analytics events; device detection helpers ensure native-vs-web tagging.
  - Sentry configured for both client and server runtimes (`sentry.client.config.ts`, `sentry.server.config.ts`), capturing SSR/API errors and performance traces.
  - Deep linking support via hooks (`hooks/useDeepLinkListener`) integrates with Capacitor and web query parsing, enabling `madmonkey://` transport into booking thanks pages.
  - Gesture navigation, platform-specific assets, and offline considerations live alongside platform directories (`ios/`, `android/`).

### Cross-Stack Workflows

- **Authentication Lifecycle**
  - Users authenticate with Firebase (web or native). Tokens attach to backend requests via `Authorization: Bearer <JWT>`.
  - Backend middleware verifies Firebase tokens, enriches requests with customer profile data, and handles legacy migration when needed.
- **Booking Flow**
  - Frontend orchestrates cart management (`CartService`), Stripe Checkout session creation, and confirmation polling via realtime service.
  - Backend creates Stripe payment intents, persists metadata, listens for webhook confirmations, then books inventory in Cloudbeds/Rezdy and emits RabbitMQ events for confirmation and notifications.
  - WebSocket or polling endpoints stream booking-stage updates, allowing the frontend to render progress indicators and success screens.
- **Content & Discovery**
  - Destination, room, tour, and media endpoints aggregate Cloudbeds/Rezdy data, enhanced with SEO JSON configuration files (`backend/seo_json`).
  - Frontend rendering engines consume these via generated models, mapping into UI components (cards, listings, detail pages).
- **Monitoring & Analytics**
  - Sentry spans both layers, correlating errors across frontend SSR/API routes and backend services.
  - GTM dataLayer events capture navigation, auth, and booking milestones, enriched with platform metadata from device detection utilities.
  - RabbitMQ metrics, queue depths, and webhook audit collections provide operator visibility; `CURRENCY_CONVERSION_LOGGING.md` and related docs cover specialized monitoring flows.

### Development & Operations

- **Local Development**
  - Backend: `bun install`, `bun run dev`; optional `npm run docker:services` boots Postgres, MongoDB, RabbitMQ, Redis with initialization scripts (`backend/docker`).
  - Frontend: `npm install`, `npm run dev`; requires local Redis for caching and `.env.local` with Firebase, Stripe, and API endpoints.
  - Stripe CLI can forward webhooks locally (`stripe listen --forward-to localhost:3000/api/webhooks/stripe`).
- **Code Generation & Types**
  - Backend OpenAPI definitions kept in sync with route schemas. `OPENAPI_HOSTED_CHECKOUT.md` and related docs define contract requirements.
  - Frontend regenerates client typings via `npm run gen:api -- --url http://localhost:8000/openapi.json --out v3/api --client fetch --clean`.
- **Deployment Patterns**
  - Recommended split: frontend on Vercel (leveraging Next.js optimizations), backend on DigitalOcean App Platform or droplets, with managed Postgres, MongoDB, and RabbitMQ.
  - Alternative all-in-one deployments documented in `backend/docs/DEPLOYMENT_GUIDE.md`.
  - CI/CD scripts (per `scripts/` directories) support migrations, cache warming, event-bus recovery, and monitoring setup.

### Reference Documents

- Backend: `backend/README.md`, `backend/docs/MAD_MONKEY_BACKEND_ARCHITECTURE.md`, `AUTH_FLOW.MD`, `ORDER_FLOW.md`, `ROOM_FLOW.md`.
- Frontend: `frontend/README.md`, `docs/APP_STATE_AUTH_MIGRATION.md`, `docs/kubernetes-deployment.md`, `utils/gtmTracker.ts`.
- Infrastructure & Support: `backend/docker/README.md`, `ENV_SETUP_GUIDE.md`, `HOSTED_CHECKOUT_IMPLEMENTATION.md`.

This document summarizes the shared mental model for both teams—use it as the landing point before diving into domain-specific docs.
