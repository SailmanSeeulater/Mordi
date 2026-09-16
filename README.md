# Mordi 🎯

![CI](https://github.com/SailmanSeeulater/Mordi/actions/workflows/ci.yml/badge.svg)

A full-stack personal accountability web app. Set goals with a weekly target, log daily entries and mood, track locations, and see at a glance whether the week is on track.

**Live:** [latesailor.dev](https://latesailor.dev)

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite |
| Backend | Java 21, Spring Boot 3.5 |
| Database | PostgreSQL 16, versioned with Flyway |
| Cache | Redis |
| Auth | JWT (stateless), BCrypt |
| Maps | Google Maps API |
| Monitoring | Spring Boot Actuator (health/readiness) |
| CI | GitHub Actions (backend tests, frontend lint/build) |

## Features

- JWT authentication — register, login, stateless sessions
- Goals with a numeric weekly target (1–7 times a week), categories, and create / edit / archive
- Daily entry logging with mood, attributed to a day
- A week view that measures progress against the target you set — a day with nothing logged counts as missed only for goals meant to happen daily
- A month calendar showing which days were logged, and what was logged on each
- Ten user-selectable color combinations (six light, four dark), applied across the whole site
- GPS location tracking with Google Maps visualization and reverse geocoding
- Automated weekly report generation with completion-rate analytics
- Download-your-data export (goals, entries, places) as JSON
- Health and readiness endpoints for monitoring

## Design

The signed-in app and the landing page share one visual system, documented in
[`DESIGN.md`](DESIGN.md) with machine-readable tokens in `.impeccable/design.json`.
Durable product facts live in [`PRODUCT.md`](PRODUCT.md).

Colors are defined once per theme in `frontend/src/themes.css` and verified rather
than eyeballed — `frontend/scripts/check-theme-contrast.mjs` asserts 14 contrast
pairs for each of the ten themes (140 checks) against WCAG AA.

## Architecture & Deployment

Mordi runs as four containerized services behind an nginx reverse proxy with Let's Encrypt TLS, on a single Oracle Cloud VM:

```
Internet → nginx (TLS) → ┬─ mordi-frontend (React, served via nginx)
                          └─ mordi-backend (Spring Boot API)
                                ├─ postgres (PostgreSQL 16)
                                └─ redis
```

Deployment is via Docker Compose. **Kubernetes manifests exist in `/k8s`** (Deployments, StatefulSets, PersistentVolumes, Ingress, HorizontalPodAutoscaler) and have been validated on a local `minikube` cluster, but production currently runs on Compose, not Kubernetes — the manifests are a deliberate learning exercise in orchestration, kept in the repo and kept current, rather than a claim about what's live.

Database schema changes are managed with **Flyway** migrations (`backend/src/main/resources/db/migration`) rather than Hibernate auto-DDL, so every schema change is versioned and reviewable. Production data is backed up nightly via cron + `pg_dump`, compressed, retained for 7 days, with a tested restore procedure.

## Running Locally

A step-by-step walkthrough, including which values are yours to fill in, is in
[`RUNNING-LOCALLY.txt`](RUNNING-LOCALLY.txt). The short version:

### Prerequisites
- Docker + Docker Compose v2
- Node.js (for frontend dev outside Docker)
- Java 21 + the included Maven wrapper (no local Maven install needed)

### Environment Setup

Copy the template and fill in real values:

```bash
cp .env.example .env
```

Compose reads three values from `.env`: `DB_PASSWORD` (add it — it is missing
from the template), `JWT_SECRET`, and `VITE_GOOGLE_MAPS_API_KEY`. The database
name and user are hardcoded in `docker-compose.yml` (`mordi` / `mordi_user`),
so the `POSTGRES_USER`, `SPRING_DATASOURCE_*` and `VITE_API_BASE_URL` lines in
`.env.example` are leftovers that nothing reads.

### Start everything with Docker Compose

```bash
docker compose up -d --build
```

This builds and starts postgres, redis, backend, and frontend. On first run, Flyway will baseline the schema automatically.

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8080`
- Health check: `http://localhost:8080/actuator/health`

Compose is the path that works end to end with no extra wiring, because the
frontend and API are served from the same origin.

### Running the backend outside Docker (for active development)

```bash
cd backend
./mvnw spring-boot:run
```

Requires Postgres and Redis reachable at the hosts in `application.properties`
(`localhost:5432`, database `mordi`, user `mordi_user`; `localhost:6379`), plus
`DB_PASSWORD` and `JWT_SECRET` in your environment.

Both Compose and `application.properties` use the role `mordi_user`, so a
locally installed Postgres needs that role to exist with your `DB_PASSWORD`.

### Running the frontend outside Docker

```bash
cd frontend
npm install
npm run dev
```

The dev server comes up on `http://localhost:5173`. The API client uses a
same-origin base URL (`frontend/src/api/client.js`), and the Vite dev server has
no `/api` proxy, so calls to `/api/...` return 404 until you add one — see
`RUNNING-LOCALLY.txt` for the snippet. Without it you can still browse the
landing page, sign-in and create-account screens; anything behind login needs an
API to talk to.

`VITE_API_BASE_URL` appears in `.env.example` but is not read by the frontend
today; the base URL is the empty string in `client.js`.

### Running tests

Backend (JUnit + Mockito):

```bash
cd backend
./mvnw test
```

Frontend (Vitest + Testing Library):

```bash
cd frontend
npm test
```

Theme contrast (fails if any combination drops below AA):

```bash
cd frontend
node scripts/check-theme-contrast.mjs
```

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Log in, returns a JWT |
| GET | `/api/goals` | List active goals |
| POST | `/api/goals` | Create a goal (`targetPerWeek` 1–7) |
| PUT | `/api/goals/{id}` | Update a goal |
| DELETE | `/api/goals/{id}` | Archive a goal (soft delete) |
| POST | `/api/behaviors` | Log an entry |
| GET | `/api/behaviors/today` | Today's entries |
| GET | `/api/behaviors/range?start=&end=` | Entries in a date range (ISO dates) |
| GET/POST | `/api/locations` | Record or retrieve GPS locations |
| POST | `/api/reports/generate` | Generate a weekly report |
| GET | `/api/reports` | Past weekly reports |
| GET | `/actuator/health` | Health check (public) |

Goals and entries belong to the authenticated user; a goal that belongs to
someone else is reported exactly like one that does not exist, so ids cannot be
probed.

## Project Structure

```
mordi/
├── backend/                  # Spring Boot API
│   └── src/
│       ├── main/java/com/mordi/backend/
│       │   ├── config/       # JWT, Security, CORS, rate limiting
│       │   ├── controller/
│       │   ├── dto/
│       │   ├── exception/    # Custom exceptions + global handler
│       │   ├── model/
│       │   ├── repository/
│       │   └── service/
│       ├── main/resources/
│       │   └── db/migration/ # Flyway migrations
│       └── test/             # JUnit + Mockito unit tests
├── frontend/                 # React app
│   ├── scripts/              # check-theme-contrast.mjs
│   └── src/
│       ├── api/              # Axios client
│       ├── components/       # Shell, dialogs, forms, theme switcher, calendar
│       ├── context/          # Auth and theme context/providers/hooks
│       ├── hooks/            # useWeekData, useToday, useDocumentTitle
│       ├── pages/            # Landing, Login, Register, Dashboard, Goals,
│       │                     # Settings, Locations, Placeholder
│       ├── test/             # Vitest suites
│       ├── index.css         # Structural tokens + fonts
│       └── themes.css        # The ten color combinations
├── k8s/                      # Kubernetes manifests (minikube-validated, not in prod)
│   ├── backend/  frontend/  database/  redis/  ingress.yaml
├── .github/workflows/        # CI: backend tests, frontend lint/build
├── DESIGN.md                 # The visual system, written from the built app
├── PRODUCT.md                # Durable product facts
├── RUNNING-LOCALLY.txt       # Local setup walkthrough
└── docker-compose.yml        # Production deployment definition
```

## Roadmap

Actively being hardened toward production-quality engineering practices. Recently completed: Flyway migrations, Actuator health checks, automated tested backups, CI pipeline, CORS/secret rotation, goal CRUD with ownership checks, a themed design system with verified contrast. In progress: structured exception handling, request validation, rate limiting.
