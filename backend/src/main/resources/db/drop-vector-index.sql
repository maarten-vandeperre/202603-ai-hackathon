-- Run this if similarity search returns no results with few documents.
-- The ivfflat index can cause wrong/no results when the table has very few rows.
-- After dropping, queries use a sequential scan (correct for small tables).
DROP INDEX IF EXISTS document_chunks_embedding_idx;
