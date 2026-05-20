# Mordi 🎯

A full-stack personal accountability web app that tracks user behavior, goals, and location — and generates weekly reports to keep users on track.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Backend | Java Spring Boot |
| Database | PostgreSQL |
| Cache | Redis |
| Infrastructure | Kubernetes (minikube) |
| Container | Docker |

## Features

- JWT authentication (register, login, secure sessions)
- Goal setting with categories and frequency tracking
- Daily behavior logging with mood tracking
- GPS location recording
- Automated weekly report generation
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
- helm

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
| GET/POST | /api/locations | Record or retrieve locations |
| POST | /api/reports/generate | Generate weekly report |
