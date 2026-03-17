-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Chunks from parsed documents with embeddings (nomic-embed-text = 768 dimensions)
CREATE TABLE IF NOT EXISTS document_chunks (
  id         BIGSERIAL PRIMARY KEY,
  document_name TEXT NOT NULL,
  upload_time   TIMESTAMPTZ NOT NULL,
  chunk_text    TEXT NOT NULL,
  embedding     vector(768)
);

-- Index for cosine similarity (optional; with few rows, sequential scan is used and more reliable)
-- Uncomment when you have thousands of chunks for faster search:
-- CREATE INDEX document_chunks_embedding_idx ON document_chunks
--   USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
