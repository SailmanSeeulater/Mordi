# Mordi 🎯

![CI](https://github.com/SailmanSeeulater/Mordi/actions/workflows/ci.yml/badge.svg)

A full-stack personal accountability web app. Set goals, log daily behaviors and mood, track locations, and get automated weekly reports on how you're actually doing.

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
- Goal setting with categories and frequency tracking
- Daily behavior logging with mood tracking
- GPS location tracking with Google Maps visualization and reverse geocoding
- Automated weekly report generation with completion-rate analytics
- Health and readiness endpoints for monitoring

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

### Prerequisites
- Docker + Docker Compose v2
- Node.js (for frontend dev outside Docker)
- Java 21 + the included Maven wrapper (no local Maven install needed)

### Environment Setup

Copy the template and fill in real values:

```bash
cp .env.example .env
```

You'll need a Postgres password, a JWT signing secret (any long random string), and a Google Maps API key.

### Start everything with Docker Compose

```bash
docker compose up -d --build
```

This builds and starts postgres, redis, backend, and frontend. On first run, Flyway will baseline the schema automatically.

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8080`
- Health check: `http://localhost:8080/actuator/health`

### Running the backend outside Docker (for active development)

```bash
cd backend
./mvnw spring-boot:run
```

Requires local Postgres and Redis reachable at the hosts configured in `application.properties`.

### Running the frontend outside Docker

```bash
cd frontend
npm install
npm run dev
```

### Running tests

```bash
cd backend
./mvnw test
```

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Log in, returns a JWT |
| GET/POST | `/api/goals` | Get or create goals |
| GET/POST | `/api/behaviors` | Log or retrieve behaviors |
| GET/POST | `/api/locations` | Record or retrieve GPS locations |
| POST | `/api/reports/generate` | Generate a weekly report |
| GET | `/actuator/health` | Health check (public) |

## Project Structure

```
mordi/
├── backend/                  # Spring Boot API
│   └── src/
│       ├── main/java/com/mordi/backend/
│       │   ├── config/       # JWT, Security, CORS
│       │   ├── controller/
│       │   ├── model/
│       │   ├── repository/
│       │   └── service/
│       ├── main/resources/
│       │   └── db/migration/ # Flyway migrations
│       └── test/             # JUnit + Mockito unit tests
├── frontend/                 # React app
│   └── src/
│       ├── api/               # Axios client
│       ├── context/            # Auth context/hook
│       └── pages/              # Landing, Login, Register, Dashboard, Locations
├── k8s/                      # Kubernetes manifests (minikube-validated, not in prod)
│   ├── backend/  frontend/  database/  redis/  ingress.yaml
├── .github/workflows/        # CI: backend tests, frontend lint/build
└── docker-compose.yml        # Production deployment definition
```

## Roadmap

Actively being hardened toward production-quality engineering practices. Recently completed: Flyway migrations, Actuator health checks, automated tested backups, CI pipeline, CORS/secret rotation. In progress: structured exception handling, request validation, rate limiting.