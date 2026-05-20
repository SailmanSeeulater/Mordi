# Mordi 🎯

A full-stack personal accountability web app that tracks user behavior, goals, and location — and generates weekly reports to keep users on track.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Backend | Java Spring Boot |
| Database | PostgreSQL |
| Cache | Redis |
| Maps | Google Maps API |
| Infrastructure | Kubernetes (minikube) |
| Container | Docker |

## Features

- JWT authentication (register, login, secure sessions)
- Goal setting with categories and frequency tracking
- Daily behavior logging with mood tracking
- GPS location tracking with Google Maps visualization
- Reverse geocoding — coordinates converted to readable addresses
- Location history with interactive map pins and info windows
- Automated weekly report generation with completion rate analytics
- Autoscaling via Kubernetes HorizontalPodAutoscaler

## Architecture

The app is split into 4 services deployed on Kubernetes:

- **mordi-frontend** — React SPA served via nginx (2 replicas)
- **mordi-backend** — Spring Boot REST API (2 replicas, HPA enabled)
- **postgres** — PostgreSQL StatefulSet with PersistentVolume
- **redis** — Redis Deployment for caching

## Running Locally

### Prerequisites

- Docker Desktop
- minikube
- kubectl
- Node.js
- Java 22 + Maven

### Environment Setup

Create `frontend/.env`:
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key

### Start the cluster

```bash
minikube start --driver=docker
minikube docker-env | Invoke-Expression

# Build images
docker build -t mordi-backend:latest ./backend
docker build -t mordi-frontend:latest ./frontend

# Deploy to Kubernetes
kubectl apply -f k8s/database/postgres.yaml
kubectl apply -f k8s/redis/redis.yaml
kubectl apply -f k8s/backend/backend.yaml
kubectl apply -f k8s/frontend/frontend.yaml
kubectl apply -f k8s/ingress.yaml
```

### Access the app

```bash
minikube tunnel
kubectl port-forward service/mordi-frontend 3000:80
kubectl port-forward service/mordi-backend 8080:8080
```

Open `http://localhost:3000`

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | /api/auth/register | Register a new user |
| POST | /api/auth/login | Login and get JWT token |
| GET/POST | /api/goals | Get or create goals |
| GET/POST | /api/behaviors | Log or retrieve behaviors |
| GET/POST | /api/locations | Record or retrieve GPS locations |
| POST | /api/reports/generate | Generate weekly report |

## Project Structure
mordi/
├── backend/          # Spring Boot API
│   └── src/main/java/com/mordi/backend/
│       ├── config/   # JWT, Security, CORS
│       ├── controller/
│       ├── model/
│       ├── repository/
│       └── service/
├── frontend/         # React app
│   └── src/
│       ├── api/      # Axios client
│       ├── context/  # Auth context
│       └── pages/    # Login, Register, Dashboard, Locations
├── k8s/              # Kubernetes manifests
│   ├── backend/
│   ├── frontend/
│   ├── database/
│   ├── redis/
│   └── ingress.yaml
└── docker-compose.yml
