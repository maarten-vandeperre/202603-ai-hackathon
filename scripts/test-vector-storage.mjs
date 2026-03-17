#!/usr/bin/env node
/**
 * Test vector storage with the sample PDF.
 * Prerequisites: backend (8085), Docling (5001), Postgres (5432), Ollama (11434) + nomic-embed-text.
 * Run from project root: node scripts/test-vector-storage.mjs
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(__dirname, '..')
const PDF_PATH = join(PROJECT_ROOT, 'assets/document-inspector/test-data/01. Almost Lovers Tour et Taxis 20.03.2024.NET.049852_FR_REPL.pdf')
const API_BASE = process.env.VITE_API_URL || 'http://localhost:8085'

async function main() {
  console.log('1. Uploading PDF to Docling via backend...')
  const form = new FormData()
  form.append('file', new Blob([readFileSync(PDF_PATH)]), '01. Almost Lovers Tour et Taxis 20.03.2024.NET.049852_FR_REPL.pdf')

  const uploadRes = await fetch(`${API_BASE}/api/upload`, {
    method: 'POST',
    body: form,
  })
  if (!uploadRes.ok) {
    const err = await uploadRes.text()
    throw new Error(`Upload failed: ${uploadRes.status} ${err}`)
  }
  const uploadData = await uploadRes.json()
  const text = uploadData.markdown || uploadData.text || ''
  console.log('   Parsed length:', text.length, 'chars, filename:', uploadData.filename)

  if (!text.trim()) {
    throw new Error('Docling returned no text. Check Docling logs and PDF.')
  }

  console.log('2. Storing in vector database...')
  const vectorizeRes = await fetch(`${API_BASE}/api/vectorize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      documentName: uploadData.filename,
      uploadTime: new Date().toISOString(),
      text,
    }),
  })
  if (!vectorizeRes.ok) {
    const err = await vectorizeRes.text()
    throw new Error(`Vectorize failed: ${vectorizeRes.status} ${err}`)
  }
  const vectorizeData = await vectorizeRes.json()
  console.log('   ', vectorizeData.message || vectorizeData)

  console.log('3. Similarity search (q=artist price tour lovers)...')
  const query = encodeURIComponent('artist price tour lovers')
  const searchRes = await fetch(`${API_BASE}/api/similarity?q=${query}`)
  if (!searchRes.ok) {
    const err = await searchRes.text()
    throw new Error(`Search failed: ${searchRes.status} ${err}`)
  }
  const searchData = await searchRes.json()
  const results = searchData.results || []
  const totalChunks = searchData.totalChunks ?? 0

  console.log('   totalChunks in DB:', totalChunks)
  console.log('   top matches:', results.length)
  results.forEach((r, i) => {
    console.log(`   --- match ${i + 1} (distance=${r.distance?.toFixed(4)}) ---`)
    console.log('   doc:', r.documentName)
    console.log('   text:', (r.chunkText || '').slice(0, 200) + (r.chunkText?.length > 200 ? '...' : ''))
  })

  if (totalChunks === 0) {
    console.error('\nNo chunks in DB after vectorize. Check backend/Ollama/Postgres logs.')
    process.exit(1)
  }
  if (results.length === 0) {
    console.warn('\nChunks exist but no matches for this query. Try other terms (e.g. from the PDF content).')
  } else {
    console.log('\nVector storage test OK.')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
