# Document Parser – Quarkus + React + Docling

Upload documents (PDF, DOCX, images, etc.), extract text with [Docling](https://github.com/docling-project/docling-serve), and run similarity search over vectorized chunks.

## Architecture

- **Frontend**: React (Vite) – Docling upload, Medical Analysis, Document Inspector (similarity search)
- **Backend**: Quarkus (Java 17) – upload → Docling, vectorize → Postgres+Ollama, similarity search
- **Compose**: Docling (parse), PostgreSQL + pgvector (vectors), Ollama (embeddings)

## Prerequisites

- Java 17+
- Node.js 18+
- Podman (and `podman-compose` or `docker compose`)

**macOS with Podman:** start the Podman machine before compose: `podman machine start`. Otherwise you may see "Cannot connect to the Docker daemon" when running `podman compose up`.

## Quick start

### 1. Start services (Podman Compose)

If you see **"proxy already running"** or **pod/name conflicts**, tear down first and use a project name:

```bash
podman-compose -p document-app down
podman-compose -p document-app up -d
```

Otherwise:

```bash
podman-compose up -d
# or: docker compose up -d
```

**Pull Ollama models** (required; if `ollama list` is empty, vectorization and RAG will fail):

```bash
podman exec -it ollama ollama pull nomic-embed-text
podman exec -it ollama ollama pull tinyllama
# or: docker exec -it ollama ollama pull ...
```
- `nomic-embed-text`: used for embeddings (vector search and RAG retrieval).
- `tinyllama`: used for RAG answers in Document Inspector (lightweight; you can switch to `mistral-small3.1:24b` in `application.properties` for better quality).  
(First pull may take a few minutes.)

- **Docling**: http://localhost:5001  
- **PostgreSQL**: localhost:5432 (user `app`, password `app`, db `vectordb`)  
- **Ollama**: http://localhost:11434  

### 2. Start Quarkus backend

```bash
cd backend
./gradlew quarkusDev
```

Backend: http://localhost:8085

### 3. Start React frontend

```bash
cd frontend
npm run dev
```

Frontend: http://localhost:5173

### 4. Use the app

1. **Docling**: Upload a file; Docling parses it. In **Document Inspector**, click **“Store in vector database”** after parsing to index it.
2. **Document Inspector**: Run **similarity search** to see top 5 matching chunks, or use **Ask (RAG)** to get an answer from the Ollama model (tinyllama by default) using retrieved context.

### 5. Test vector storage with sample PDF

With backend and compose services running (Docling, Postgres, Ollama + `nomic-embed-text`):

```bash
node scripts/test-vector-storage.mjs
```

This uploads `assets/document-inspector/test-data/01. Almost Lovers Tour et Taxis 20.03.2024.NET.049852_FR_REPL.pdf`, stores it in the vector DB, and runs a similarity query. If you get **no chunks** back from search but the script says chunks were stored, see **Troubleshooting** (ivfflat index).

### 6. Document Inspector integration test

Integration tests use the **Podman Compose environment** (Postgres, Docling, Ollama on localhost). Start compose first, then run:

```bash
# Start the compose stack (if not already running)
podman-compose up -d
# Run the test (uses application-test.properties → localhost)
cd backend
./gradlew test --tests "com.example.DocumentInspectorIntegrationTest"
```

The test uploads `artist_profile_rag_test.pdf`, stores it in the vector DB, runs a similarity search for “how much does elias vermeer cost per hour”, asserts the top result is from that document, and checks the RAG answer mentions the hourly rate in euro.

## Configuration

- **Backend**: `backend/src/main/resources/application.properties`  
  - `docling.api.url`, `quarkus.datasource.jdbc.url`, `ollama.api.url`  
  - RAG: `quarkus.langchain4j.ollama.chat-model.model-id=tinyllama` (or `mistral-small3.1:24b` for better quality)
- **Frontend**: `VITE_API_URL` (default: `http://localhost:8085`)

## API

- `POST /api/upload` – multipart `file`; returns `filename`, `markdown`, `text`, etc.
- `POST /api/vectorize` – JSON `{ documentName, uploadTime?, text }`; stores chunks and embeddings.
- `GET /api/similarity?q=...` – returns top 5 chunks (documentName, uploadTime, chunkText, distance).
- `POST /api/rag/ask` – JSON `{ "query": "..." }`; returns `{ "answer": "..." }` (RAG over stored chunks, LLM via Ollama).
- `GET /api/health` – health check

## Compose

- **docling**: document parsing (CPU image by default).
- **postgres**: pgvector image; init script creates `document_chunks` table (document_name, upload_time, chunk_text, embedding vector(768)).
- **ollama**: embedding model; use `nomic-embed-text` (768 dimensions) for compatibility with the init schema.

### Clear the vector database

To remove all stored document chunks (e.g. before re-running the integration test or to start fresh):

```bash
./scripts/clear-vector-db.sh
```

Requires the Postgres container (`vectordb`) to be running. Override the container name with `VECTOR_DB_CONTAINER=mycontainer ./scripts/clear-vector-db.sh` if needed.

## Troubleshooting

- **"Cannot connect to the Docker daemon"** (Podman on macOS): `podman compose` often calls `docker-compose`, which must use Podman’s socket. Run compose with Podman’s socket set:
  ```bash
  export DOCKER_HOST=unix://$(podman machine inspect --format '{{.ConnectionInfo.PodmanSocket.Path}}')
  docker-compose -f compose.yaml up -d
  ```
  Or use the helper script: `./scripts/compose-up.sh` (then Ctrl+C or run with `-d` to detach).
- **"proxy already running" / pod already exists**: Stop the stack and bring it up with a unique project name:  
  `podman-compose -p document-app down` then `podman-compose -p document-app up -d`. To stop containers from another terminal: `podman stop docling-serve vectordb ollama 2>/dev/null; podman rm -f docling-serve vectordb ollama 2>/dev/null`.
- **Port in use**: Change port mappings in `compose.yaml` (e.g. `"5002:5001"` for docling) if 5001, 5432, or 11434 are taken.
- **Java 24+ `IllegalAccessError` / `NoClassDefFoundError` (JBoss Threads)**: The Gradle build is configured to pass `--add-opens=java.base/java.lang=ALL-UNNAMED` to `quarkusDev`. If the error persists, run with:  
  `JAVA_TOOL_OPTIONS="--add-opens=java.base/java.lang=ALL-UNNAMED" ./gradlew quarkusDev`
- **Similarity search returns no results** (but chunks were stored): With few rows, the pgvector **ivfflat** index can return no matches. Drop it so Postgres uses a sequential scan:  
  `podman exec -it vectordb psql -U app -d vectordb -c "DROP INDEX IF EXISTS document_chunks_embedding_idx;"`  
  Then run the test script or search again.
