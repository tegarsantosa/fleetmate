# FleetMate

FleetMate is a multi-service logistics prototype for AI-assisted box scanning, container packing, and a web-based fleet operations console.

### Group Team
- ⁠Desta Prasetyo Agusta Syarif (012202405001 | N IS 2024)
- Muhammad Tegar Santosa Putra (012202405016 | N IS 2024)
- ⁠Muhammad Athoillah (012202405022 | N IS 2024)
- ⁠Jesica Cristy  (012202205027 | N IS 2022)

## Architecture

- `api/` — FastAPI backend service exposing core resources for scans, boxes, containers, packing plans, and analytics.
- `ai/vision-service/` — FastAPI service that receives box scan images, estimates dimensions, and forwards scan records to the API.
- `ai/packing-service/` — FastAPI service that fetches pending boxes and containers, computes packing plans, and records load plans in the API.
- `app/` — React + Vite frontend console for operating the system, viewing inventory, and managing shipments.
- `compose.yaml` — Docker Compose stack wiring the PostgreSQL database, API, AI services, and frontend.
- `media/` — Shared media volume for scan images and other persisted files.

## Requirements

- Docker
- Docker Compose

## Quick Start

From the repository root:

```bash
./run.sh
```

This script:

- removes temporary state in `.tmp`
- clears `media/scans`
- tears down existing containers
- rebuilds and brings the stack up in detached mode

Alternatively, run directly:

```bash
docker compose down -v
Docker compose up -d --build
```

## Services and Ports

- `http://localhost:8000` — FleetMate API service
- `http://localhost:8001` — Vision service
- `http://localhost:8002` — Packing service
- `http://localhost:5173` — Frontend application
- `localhost:5432` — PostgreSQL database

## Frontend

The React app in `app/` is built with Vite, TailwindCSS and `@react-three/fiber` for visualization.

Commands inside `app/`:

```bash
npm install
npm run dev
npm run build
```

## Backend dependencies

The API uses Python packages from `api/requirements.txt`:

- `fastapi`
- `uvicorn[standard]`
- `sqlalchemy[asyncio]`
- `asyncpg`
- `pydantic`
- `python-multipart`
- `httpx`

The AI services also install their own FastAPI and HTTP client dependencies in their Dockerfiles.

## API overview

### Health checks

- `GET /health` on each service returns `{ "status": "ok" }`

### Scan workflow

- `POST /vision-service/scan` — upload `camera_top` and optional `camera_side` images.
- The vision service estimates dimensions and creates a scan record on the API.
- The API stores scan metadata and media files under `media/scans/`.

### Core API resources

- `POST /scans` — create a scan record
- `GET /boxes` — list boxes, filter by `status`
- `POST /boxes` — create box metadata from a scan
- `GET /containers` — list available containers
- `POST /containers` — add a new container
- `POST /packing-plans` — create a packing plan record from the packing service
- `GET /analytics/dashboard` — dashboard metrics for boxes, containers, shipments, and utilization

## Packing service

- `POST /packing-service/pack` — packs pending boxes into containers using existing load state and writes packing plans back to the API.

## Testing

A simple scan test helper is provided in `scripts/test_scan.sh`.

```bash
./test.sh
```

It calls the vision service to submit sample scan images.

## Notes

- The project is organized as a Docker Compose monorepo. Most development is designed to happen inside containers.
- The API mounts `./media` to serve static scan files.
- The frontend is configured to talk to the local service URLs via environment variables in `compose.yaml`.

## Useful files

- `compose.yaml` — service orchestration
- `run.sh` — clean build + startup helper
- `test.sh` — scan test entrypoint
- `api/` — backend implementation
- `app/` — React console UI
- `ai/vision-service/` — image scanning service
- `ai/packing-service/` — packing optimization service
