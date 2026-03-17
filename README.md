# Document Parser – Quarkus + React + Docling

Upload documents (PDF, DOCX, images, etc.) and extract text and markdown using [Docling](https://github.com/docling-project/docling-serve) via Podman Compose.

## Architecture

- **Frontend**: React (Vite) – file upload UI
- **Backend**: Quarkus (Java 17) – receives uploads, forwards to Docling, returns extracted data
- **Docling**: Runs in Podman via `compose.yaml` – parses documents and returns markdown/text

## Prerequisites

- Java 17+
- Node.js 18+
- Podman (and `podman-compose` or `docker compose`)

## Quick start

### 1. Start Docling (Podman Compose)

```bash
podman-compose up -d
# or: docker compose up -d
```

Docling API: http://localhost:5001  
API docs: http://localhost:5001/docs

### 2. Start Quarkus backend

```bash
cd backend
./gradlew quarkusDev
```

Backend: http://localhost:8080

### 3. Start React frontend

```bash
cd frontend
npm run dev
```

Frontend: http://localhost:5173

### 4. Use the app

Open http://localhost:5173, drop or select a file (PDF, DOCX, image, etc.). The app sends it to the backend, which calls Docling; you get back extracted markdown and plain text.

## Configuration

- **Backend → Docling**: `backend/src/main/resources/application.properties`  
  - `docling.api.url` (default: `http://localhost:5001`)
- **Frontend → Backend**: set `VITE_API_URL` (default: `http://localhost:8080`) when building or in `.env`

## API

- `POST /api/upload` – multipart form with `file`; returns JSON with `filename`, `markdown`, `text`, `processingTime`, `errors`
- `GET /api/health` – health check

## Compose

`compose.yaml` runs Docling Serve (CPU). For GPU use image `ghcr.io/docling-project/docling-serve-cu128` and adjust the compose file.
