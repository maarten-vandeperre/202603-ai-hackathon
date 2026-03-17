# Artist Data – Full documentation

This document describes the **Artist Data** feature: extracting artist names and prices (with optional unit) from documents, with an editable table and persistent storage.

---

## 1. Overview

The **artist-data** feature:

- **Input**: PDF (or other file) uploaded via **Docling**; the parsed text is the source. You can also paste text or use “Load sample”.
- **Extraction**: Document text is chunked, each chunk is sent to the same **LangChain4j ChatModel** used for RAG. The model returns structured JSON (artist, price, unit, currency). Results are validated and merged.
- **Output**: An **editable** simplified table (artist, price, unit, currency). You can correct values, add/remove rows, then **Persist** to save to the database.
- **Stored data**: A second tab shows the **artist–price table** stored in the DB, with a **Clear** button to remove all rows.

**Principles**: Extraction is conservative (no guessing); we do not convert between units (e.g. daily → hourly). Price highlighting in the **chunk text** panel shows possible price references (amounts and unit phrases).

---

## 2. User flow

1. Open **Artist Data** (`/artist-data`) in the app.
2. **Extract** tab:
   - **Upload PDF**: Drop or select a file. Docling parses it; the parsed text appears in the text area.
   - **Parsed document text**: Edit if needed (or paste / “Load sample”).
   - Click **Extract artist data**. The backend chunks the text, runs the LLM per chunk, validates and merges.
   - **Chunks** (left): list of chunk IDs and offsets; select one to view its text and extracted JSON.
   - **Chunk text** (centre): selected chunk with **possible price references highlighted** (yellow).
   - **Extracted JSON** (right): per-chunk extraction for the selected chunk.
   - **Merged result**: full merged JSON.
   - **Simplified table**: editable rows (artist, price, unit, currency). Use **Add row** / **×** to add/remove; edit cells; click **Persist** to save to the database.
3. **Artist–price table** tab:
   - View the stored rows (read-only table).
   - Click **Clear table** to delete all stored rows.

---

## 3. Backend

### 3.1 Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/artist-data/extract` | Run extraction. Body: `{ "rawText": "..." }`. Returns chunks, perChunkResults, merged, simplified. |
| `GET`  | `/api/artist-data/artists` | List stored artist–price rows. Returns JSON array of `{ artist, price, unit, currency }`. |
| `POST` | `/api/artist-data/artists` | Replace all stored rows. Body: JSON array of `{ artist, price?, unit?, currency? }`. |
| `DELETE` | `/api/artist-data/artists` | Delete all stored rows. |

Upload for parsing uses the existing **Docling** endpoint: `POST /api/upload` (multipart `file`).

### 3.2 Extraction pipeline

1. **Preprocessing**  
   Image/binary content is stripped from the raw text before chunking (data-URI base64 images, markdown images, long base64-like lines).

2. **Chunking** (`DocumentChunker`)  
   - Prefer: page boundaries → section headers → paragraph groups.  
   - Fallback: fixed-size chunks (~2500 chars) with ~80 chars overlap.  
   - **Cap**: at most 200 chunks to avoid OOM and excessive LLM calls.  
   - Each chunk: `chunkId`, `startOffset`, `endOffset`, `text`.

3. **Per-chunk extraction** (`ArtistDataExtractionService`)  
   For each chunk:  
   - Build prompt with schema (artist, price, unit, currency, rawPriceText, evidence, confidence) and rules (no guessing, no unit conversion).  
   - Call LangChain4j `ChatModel`.  
   - Parse JSON from the response; validate with `ChunkExtractionValidator` (parse numbers EU/US, normalize currency, require evidence).  
   - Log chunk progress (e.g. “chunk progress 3/15 (chunk-2)”).

4. **Merge** (`ChunkResultMerger`)  
   - Deduplicate by normalized artist name.  
   - Prefer “per hour” unit, then confidence, then evidence length.  
   - Output: `artist`, `price`, `unit`, `currency`, `sourceChunks`, `evidence`.

5. **Simplified**  
   One row per artist: `artist`, `price`, `unit`, `currency` (used for the editable table and for persist).

### 3.3 Backend components (Java)

| Component | Role |
|-----------|------|
| `ArtistDataResource` | REST: `/api/artist-data/extract`, `/artists` (GET, POST, DELETE). |
| `ArtistDataExtractionService` | Orchestrates chunk → extract → validate → merge; strips image/binary content; uses `ChatModel`, `DocumentChunker`, `ChunkExtractionValidator`, `ChunkResultMerger`. |
| `DocumentChunker` | Splits text; max 200 chunks; overlap 80 chars; MAX_CHUNK_SIZE 2500. |
| `ChunkExtractionValidator` | Parses price (EU/US decimals), normalizes currency (€→EUR), normalizes unit; requires evidence for non-null. |
| `ChunkResultMerger` | Deduplicates by name; prefers “per hour” then confidence then evidence; builds merged + simplified. |
| `ArtistPriceService` | JDBC: `list()`, `persist(rows)` (replace-all), `clear()` on table `artist_prices`. |
| `ArtistPriceTableInit` | Startup: runs `CREATE TABLE IF NOT EXISTS artist_prices` so the table exists even if DB was created before the feature. |
| `ArtistDataDto` | DTOs: ExtractRequest, ChunkDto, PerChunkArtistDto, PerChunkResultDto, MergedArtistDto, MergedResultDto, SimplifiedArtistDto, ExtractResponse. |

### 3.4 Database

- **Table**: `artist_prices`  
  - `id` BIGSERIAL PRIMARY KEY  
  - `artist` TEXT NOT NULL  
  - `price` DOUBLE PRECISION  
  - `unit` TEXT  
  - `currency` TEXT  
  - `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()

- **Creation**:  
  - Defined in `backend/src/main/resources/db/init.sql` (for new DBs).  
  - **Startup**: `ArtistPriceTableInit` runs `CREATE TABLE IF NOT EXISTS artist_prices (...)` on application startup so existing databases get the table without a manual migration.

---

## 4. Frontend

### 4.1 Page and tabs

- **Route**: `/artist-data` (nav: “Artist Data”).
- **Tabs**:
  - **Extract**: upload, parsed text, extract button, chunk list, chunk text (with price highlighting), per-chunk JSON, merged JSON, editable simplified table, Persist.
  - **Artist–price table**: stored rows (read-only table), Clear button.

### 4.2 Extract tab

- **Upload**: Dropzone; file sent to `POST /api/upload`; response `markdown` or `text` fills the parsed text area.
- **Parsed document text**: Textarea (editable). “Load sample” fills sample artist/price text.
- **Extract**: Calls `POST /api/artist-data/extract` with `rawText`; result drives chunks, perChunkResults, merged, and initial editable rows.
- **Chunk text**: Selected chunk’s text is rendered with **price-reference highlighting** (amounts and unit phrases in yellow). No separate “parsed text” preview (to avoid showing binary data).
- **Editable table**: Rows from `result.simplified` are copied into local state; user can edit any cell, add rows (“Add row”), remove rows (“×”). **Persist** sends the current rows to `POST /api/artist-data/artists` (only rows with non-empty artist are sent).

### 4.3 Artist–price table tab

- On tab switch, `GET /api/artist-data/artists` loads stored rows.
- Table shows artist, price, unit, currency (read-only).
- **Clear table**: `DELETE /api/artist-data/artists`; then list is cleared in the UI.

### 4.4 Price highlighting

- Used **only in the chunk text** panel (not in the parsed text area).
- Highlights:
  - Currency + number (e.g. €125, $50).
  - Number + currency (e.g. 125€, 125 EUR, 151,7€).
  - EU/US decimal amounts with optional currency.
  - Unit/context phrases: per hour, per day, per performance, forfait, forfaitaire, lump sum, daily rate, hourly rate, tarif horaire, /h, /hour.
- Implemented in the frontend with `findPriceRanges()` and `<mark class="artist-data-price-highlight">`.

---

## 5. Configuration

- **Chat model** (extraction and RAG): same as main app.  
  In `application.properties`: e.g. `quarkus.langchain4j.openai.chat-model.model-name=qwen3-14b` (LiteLLM) or Ollama. No separate config for artist-data.
- **Docling**: `docling.api.url` (e.g. `http://localhost:5001`).
- **Database**: same PostgreSQL as the rest of the app (`quarkus.datasource.*`). Table `artist_prices` is created on startup if missing.
- **Frontend**: `VITE_API_URL` (default `http://localhost:8085`) for all API calls.

---

## 6. Sample test data

Use “Load sample” in the parsed text area, or paste:

```
Artist contract – Summary

Marie Dupont – Rémunération brute : 151,7€ forfaitaire pour le projet.
Jean Martin – 125 EUR per hour. Evidence: "Tarif horaire 125€/h".
Sophie Bernard – Daily rate 800 EUR. No hourly rate specified.
```

Expected extraction: Jean Martin (125, per hour, EUR); Marie Dupont (flat); Sophie Bernard (800, per day, EUR).

---

## 7. API request/response shapes

**POST /api/artist-data/extract**

- Request: `{ "rawText": "string" }`
- Response:  
  - `chunks`: `[{ chunkId, startOffset, endOffset, text }]`  
  - `perChunkResults`: `[{ chunkId, artists: [{ name, price, unit, currency, rawPriceText, evidence, confidence }] }]`  
  - `merged`: `{ artists: [{ artist, price, unit, currency, sourceChunks, evidence }] }`  
  - `simplified`: `[{ artist, price, unit, currency }]`

**GET /api/artist-data/artists**

- Response: `[{ artist, price, unit, currency }, ...]`

**POST /api/artist-data/artists**

- Request: `[{ artist, price?, unit?, currency? }, ...]`  
- Empty array clears the table (replace-all semantics).

**DELETE /api/artist-data/artists**

- No body. Response: 200 on success.

---

## 8. File reference

| Area | Path |
|------|------|
| Backend DTOs | `backend/src/main/java/com/example/artistdata/ArtistDataDto.java` |
| Chunker | `backend/src/main/java/com/example/artistdata/DocumentChunker.java` |
| Validator | `backend/src/main/java/com/example/artistdata/ChunkExtractionValidator.java` |
| Merger | `backend/src/main/java/com/example/artistdata/ChunkResultMerger.java` |
| Extraction service | `backend/src/main/java/com/example/artistdata/ArtistDataExtractionService.java` |
| REST resource | `backend/src/main/java/com/example/artistdata/ArtistDataResource.java` |
| Persistence service | `backend/src/main/java/com/example/artistdata/ArtistPriceService.java` |
| Table init | `backend/src/main/java/com/example/artistdata/ArtistPriceTableInit.java` |
| DB schema | `backend/src/main/resources/db/init.sql` (includes `artist_prices`) |
| Frontend page | `frontend/src/pages/ArtistDataPage.jsx` |
| Styles | `frontend/src/App.css` (`.artist-data-*`, `.artist-data-price-highlight`) |
