#!/usr/bin/env bash
# Empty the vector database (document_chunks table).
# Requires the Postgres container from compose to be running (container name: vectordb).
# Usage: ./scripts/clear-vector-db.sh

set -e
CONTAINER="${VECTOR_DB_CONTAINER:-vectordb}"

if command -v podman &>/dev/null && podman ps -a --format '{{.Names}}' 2>/dev/null | grep -q "^${CONTAINER}$"; then
  RUNNER=podman
elif command -v docker &>/dev/null && docker ps -a --format '{{.Names}}' 2>/dev/null | grep -q "^${CONTAINER}$"; then
  RUNNER=docker
else
  echo "Error: Container '${CONTAINER}' not found. Start the stack with: podman-compose up -d"
  exit 1
fi

"$RUNNER" exec "$CONTAINER" psql -U app -d vectordb -c "TRUNCATE TABLE document_chunks RESTART IDENTITY;"
echo "Vector database cleared (document_chunks emptied)."
