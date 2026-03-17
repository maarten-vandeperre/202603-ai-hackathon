import { useState, useCallback, useId, useEffect } from 'react'
import '../App.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8085'

const SAMPLE_TEXT = `Artist contract – Summary

Marie Dupont – Rémunération brute : 151,7€ forfaitaire pour le projet.
Jean Martin – 125 EUR per hour. Evidence: "Tarif horaire 125€/h".
Sophie Bernard – Daily rate 800 EUR. No hourly rate specified.`

function rowToEditable(a) {
  return {
    artist: a?.artist ?? '',
    price: a?.price != null ? String(a.price) : '',
    unit: a?.unit ?? '',
    currency: a?.currency ?? ''
  }
}

function editableToRow(e) {
  const p = e.price?.trim()
  return {
    artist: e.artist?.trim() || null,
    price: p === '' || p == null ? null : parseFloat(p),
    unit: e.unit?.trim() || null,
    currency: e.currency?.trim() || null
  }
}

/** Remove image/binary content from parsed text (data URIs, markdown images, long base64 lines). */
function stripImageContent(text) {
  if (!text || typeof text !== 'string') return text
  let s = text
  // Markdown image with data:image URL (may span multiple lines)
  s = s.replace(/!\[[^\]]*\]\s*\(\s*data:image[^)]*\)/gis, ' ')
  // data:image/...;base64,... (base64 may be line-wrapped)
  s = s.replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=\s]{1,500000}/gi, ' ')
  // Any remaining markdown image ![alt](url)
  s = s.replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
  // Long lines that look like raw base64 (200+ chars)
  s = s.replace(/^[A-Za-z0-9+/=\s]{200,}$/gm, '')
  // Collapse 3+ newlines to 2
  s = s.replace(/\n{3,}/g, '\n\n').trim()
  return s
}

/** Find all price-reference spans in text; return sorted non-overlapping [start, end) indices. */
function findPriceRanges(text) {
  if (!text || !text.length) return []
  const ranges = []
  const patterns = [
    // Currency then number: €125, $50, £ 80
    /[€$£]\s*[\d\s.,]+/g,
    // Number then currency: 125€, 125 EUR, 151,7€, 800 EUR
    /[\d\s.,]+\s*[€$£]|[\d\s.,]+\s*(?:EUR|USD|GBP)\b/gi,
    // EU decimal: 151,7 or 125,50
    /\d{1,4},\d{1,2}(?:\s*[€$£]|\s*(?:EUR|USD|GBP)\b)?/gi,
    // US decimal with optional currency: 125.50 or 125.50 EUR
    /\d{1,4}\.\d{1,2}(?:\s*[€$£]|\s*(?:EUR|USD|GBP)\b)?/gi,
    // Unit phrases (price context)
    /\b(?:per\s+hour|per\s+day|per\s+performance|per\s+show|forfait|forfaitaire|lump\s+sum|daily\s+rate|hourly\s+rate|tarif\s+horaire|\/\s*h|\/\s*hour)\b/gi
  ]
  patterns.forEach((re) => {
    let m
    re.lastIndex = 0
    while ((m = re.exec(text)) !== null) {
      ranges.push([m.index, m.index + m[0].length])
    }
  })
  ranges.sort((a, b) => a[0] - b[0])
  const merged = []
  for (const [s, e] of ranges) {
    if (merged.length && s <= merged[merged.length - 1][1]) {
      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], e)
    } else {
      merged.push([s, e])
    }
  }
  return merged
}

/** Render text with <mark> around price-reference spans. Preserves newlines when used inside <pre>. */
function PriceHighlightedText({ text, className = '' }) {
  if (text == null || text === '') return <span className={className}>—</span>
  const ranges = findPriceRanges(text)
  if (ranges.length === 0) {
    return <span className={className}>{text}</span>
  }
  const segments = []
  let last = 0
  for (const [s, e] of ranges) {
    if (s > last) segments.push({ type: 'plain', text: text.slice(last, s) })
    segments.push({ type: 'highlight', text: text.slice(s, e) })
    last = e
  }
  if (last < text.length) segments.push({ type: 'plain', text: text.slice(last) })
  return (
    <span className={className}>
      {segments.map((seg, i) =>
        seg.type === 'highlight' ? (
          <mark key={i} className="artist-data-price-highlight">{seg.text}</mark>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </span>
  )
}

export default function ArtistDataPage() {
  const fileInputId = useId()
  const [activeTab, setActiveTab] = useState('extract')
  const [rawText, setRawText] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [uploadedFilename, setUploadedFilename] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [selectedChunkId, setSelectedChunkId] = useState(null)
  const [editableRows, setEditableRows] = useState([])
  const [storedRows, setStoredRows] = useState([])
  const [storedLoading, setStoredLoading] = useState(false)
  const [persistLoading, setPersistLoading] = useState(false)
  const [clearLoading, setClearLoading] = useState(false)
  const [persistMessage, setPersistMessage] = useState(null)
  const [storedError, setStoredError] = useState(null)

  const uploadPdf = useCallback(async (fileToUpload) => {
    if (!fileToUpload) return
    setUploading(true)
    setUploadError(null)
    setUploadedFilename(null)
    const formData = new FormData()
    formData.append('file', fileToUpload)
    try {
      const res = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        body: formData
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || res.statusText || 'Upload failed')
      const parsed = data.markdown ?? data.text ?? ''
      setRawText(stripImageContent(parsed))
      setUploadedFilename(data.filename ?? fileToUpload.name)
      setError(null)
    } catch (e) {
      setUploadError(e.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer?.files?.[0]
    if (f) uploadPdf(f)
  }, [uploadPdf])

  const onDragOver = useCallback((e) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const onDragLeave = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  const onFileChange = useCallback((e) => {
    const f = e.target?.files?.[0]
    if (f) uploadPdf(f)
  }, [uploadPdf])

  const extract = useCallback(async () => {
    const text = rawText?.trim()
    if (!text) {
      setError('Enter document text to extract.')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    setSelectedChunkId(null)
    try {
      const res = await fetch(`${API_BASE}/api/artist-data/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: text })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || res.statusText || 'Extraction failed')
        return
      }
      setResult(data)
      if (data.chunks?.length) setSelectedChunkId(data.chunks[0].chunkId)
    } catch (e) {
      setError(e.message || 'Request failed')
    } finally {
      setLoading(false)
    }
  }, [rawText])

  useEffect(() => {
    if (result?.simplified?.length) {
      setEditableRows(result.simplified.map(rowToEditable))
    }
  }, [result])

  const updateEditableRow = useCallback((index, field, value) => {
    setEditableRows((prev) => {
      const next = prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
      return next
    })
  }, [])

  const addEditableRow = useCallback(() => {
    setEditableRows((prev) => [...prev, rowToEditable({})])
  }, [])

  const removeEditableRow = useCallback((index) => {
    setEditableRows((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const fetchStored = useCallback(async () => {
    setStoredLoading(true)
    setStoredError(null)
    try {
      const res = await fetch(`${API_BASE}/api/artist-data/artists`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || res.statusText)
      setStoredRows(Array.isArray(data) ? data : [])
    } catch (e) {
      setStoredError(e.message || 'Failed to load')
    } finally {
      setStoredLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'stored') fetchStored()
  }, [activeTab, fetchStored])

  const persist = useCallback(async () => {
    const payload = editableRows.map(editableToRow).filter((r) => r.artist != null && r.artist !== '')
    setPersistLoading(true)
    setPersistMessage(null)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/artist-data/artists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || res.statusText)
      setPersistMessage(`Saved ${payload.length} row(s). You can upload a new document.`)
      setRawText('')
      setResult(null)
      setSelectedChunkId(null)
      setEditableRows([])
      setUploadedFilename(null)
    } catch (e) {
      setError(e.message || 'Persist failed')
    } finally {
      setPersistLoading(false)
    }
  }, [editableRows])

  const clearStored = useCallback(async () => {
    setClearLoading(true)
    setStoredError(null)
    try {
      const res = await fetch(`${API_BASE}/api/artist-data/artists`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || res.statusText)
      setStoredRows([])
    } catch (e) {
      setStoredError(e.message || 'Clear failed')
    } finally {
      setClearLoading(false)
    }
  }, [])

  const selectedChunk = result?.chunks?.find((c) => c.chunkId === selectedChunkId)
  const selectedPerChunk = result?.perChunkResults?.find((r) => r.chunkId === selectedChunkId)

  return (
    <div className="app app--page artist-data-page">
      <header className="header">
        <h1>Artist Data</h1>
        <p>Upload a PDF (parsed with Docling), then extract artist names and prices from the parsed text.</p>
      </header>

      <nav className="artist-data-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'extract'}
          className={`artist-data-tab ${activeTab === 'extract' ? 'artist-data-tab--active' : ''}`}
          onClick={() => setActiveTab('extract')}
        >
          Extract
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'stored'}
          className={`artist-data-tab ${activeTab === 'stored' ? 'artist-data-tab--active' : ''}`}
          onClick={() => setActiveTab('stored')}
        >
          Artist–price table
        </button>
      </nav>

      {activeTab === 'extract' && (
        <>
      <section className="artist-data-upload">
        <h2 className="artist-data-step__title">1. Upload PDF (Docling)</h2>
        <section
          className={`dropzone ${dragOver ? 'dropzone--over' : ''} ${uploading ? 'dropzone--loading' : ''}`}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
        >
          <input
            type="file"
            id={fileInputId}
            className="dropzone__input"
            accept=".pdf,.docx,.doc,.pptx,.xlsx,.html,.png,.jpg,.jpeg,.tiff,.md"
            onChange={onFileChange}
            disabled={uploading}
          />
          <label htmlFor={fileInputId} className="dropzone__label">
            {uploading ? (
              <span className="dropzone__status">Parsing with Docling…</span>
            ) : (
              <>
                <span className="dropzone__prompt">
                  {uploadedFilename ? uploadedFilename : 'Drop a PDF here or click to browse'}
                </span>
                <span className="dropzone__hint">PDF, DOCX, images, etc. Docling will extract text.</span>
              </>
            )}
          </label>
        </section>
        {uploadError && (
          <div className="message message--error" role="alert">
            {uploadError}
          </div>
        )}
        {uploadedFilename && rawText && (
          <p className="artist-data-uploaded-meta">Parsed text below ({rawText.length} chars). Edit if needed, then click Extract.</p>
        )}
      </section>

      <section className="artist-data-input">
        <h2 className="artist-data-step__title">2. Parsed document text</h2>
        <label className="artist-data-input__label">
          <span className="artist-data-input__hint">Filled automatically after upload, or paste / load sample.</span>
          <textarea
            className="artist-data-input__textarea"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Upload a PDF above or paste raw document text here..."
            rows={6}
            disabled={loading}
          />
        </label>
        <div className="artist-data-input__actions">
          <button type="button" className="btn btn--primary" onClick={extract} disabled={loading || !rawText?.trim()}>
            {loading ? 'Extracting…' : 'Extract artist data'}
          </button>
          <button type="button" className="btn btn--secondary" onClick={() => setRawText(SAMPLE_TEXT)} disabled={loading}>
            Load sample
          </button>
        </div>
      </section>

      {error && (
        <div className="message message--error" role="alert">
          {error}
        </div>
      )}

      {result && (
        <div className="artist-data-results">
          <div className="artist-data-layout">
            <aside className="artist-data-chunks">
              <h3 className="artist-data-panel__title">Chunks</h3>
              <ul className="artist-data-chunks-list">
                {result.chunks?.map((c) => (
                  <li key={c.chunkId}>
                    <button
                      type="button"
                      className={`artist-data-chunks-item ${selectedChunkId === c.chunkId ? 'artist-data-chunks-item--active' : ''}`}
                      onClick={() => setSelectedChunkId(c.chunkId)}
                    >
                      {c.chunkId}
                      <span className="artist-data-chunks-meta">{c.startOffset}–{c.endOffset}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </aside>

            <main className="artist-data-main">
              <h3 className="artist-data-panel__title">Chunk text</h3>
              <pre className="artist-data-chunk-text">
                {selectedChunk ? <PriceHighlightedText text={selectedChunk.text} /> : 'Select a chunk'}
              </pre>
            </main>

            <aside className="artist-data-json-panel">
              <h3 className="artist-data-panel__title">Extracted JSON (selected chunk)</h3>
              <pre className="artist-data-json-block">
                {selectedPerChunk != null
                  ? JSON.stringify(selectedPerChunk, null, 2)
                  : '—'}
              </pre>
            </aside>
          </div>

          <section className="artist-data-final">
            <h3 className="artist-data-panel__title">Merged result</h3>
            <pre className="artist-data-json-block artist-data-json-block--merged">
              {result.merged != null ? JSON.stringify(result.merged, null, 2) : '—'}
            </pre>

            <h3 className="artist-data-panel__title artist-data-panel__title--simplified">Simplified (editable — then Persist to save)</h3>
            <div className="artist-data-simplified">
              {editableRows.length ? (
                <>
                  <table className="artist-data-table artist-data-table--editable">
                    <thead>
                      <tr>
                        <th>Artist</th>
                        <th>Price</th>
                        <th>Unit</th>
                        <th>Currency</th>
                        <th aria-label="Remove row" />
                      </tr>
                    </thead>
                    <tbody>
                      {editableRows.map((row, i) => (
                        <tr key={i}>
                          <td>
                            <input
                              type="text"
                              className="artist-data-input-cell"
                              value={row.artist}
                              onChange={(e) => updateEditableRow(i, 'artist', e.target.value)}
                              placeholder="Artist name"
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="artist-data-input-cell"
                              value={row.price}
                              onChange={(e) => updateEditableRow(i, 'price', e.target.value)}
                              placeholder="e.g. 125"
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="artist-data-input-cell"
                              value={row.unit}
                              onChange={(e) => updateEditableRow(i, 'unit', e.target.value)}
                              placeholder="per hour, flat, …"
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="artist-data-input-cell"
                              value={row.currency}
                              onChange={(e) => updateEditableRow(i, 'currency', e.target.value)}
                              placeholder="EUR"
                            />
                          </td>
                          <td>
                            <button type="button" className="artist-data-remove-row" onClick={() => removeEditableRow(i)} title="Remove row">×</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="artist-data-editable-actions">
                    <button type="button" className="btn btn--secondary" onClick={addEditableRow}>
                      Add row
                    </button>
                    <button type="button" className="btn btn--primary" onClick={persist} disabled={persistLoading}>
                      {persistLoading ? 'Saving…' : 'Persist'}
                    </button>
                  </div>
                  {persistMessage && <p className="artist-data-persist-message">{persistMessage}</p>}
                </>
              ) : (
                <div className="artist-data-editable-actions">
                  <p className="artist-data-empty">
                    {result?.simplified?.length === 0
                      ? 'No artists extracted. Add a row to build the table, then Persist.'
                      : 'Run extraction above to fill the table, or add a row to persist manually.'}
                  </p>
                  <button type="button" className="btn btn--secondary" onClick={addEditableRow}>
                    Add row
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

        </>
      )}

      {activeTab === 'stored' && (
        <section className="artist-data-stored">
          <h2 className="artist-data-step__title">Stored artist–price table</h2>
          {storedError && (
            <div className="message message--error" role="alert">{storedError}</div>
          )}
          {storedLoading ? (
            <p className="artist-data-loading">Loading…</p>
          ) : storedRows.length === 0 ? (
            <p className="artist-data-empty">No rows stored. Use the Extract tab, edit the table, and click Persist.</p>
          ) : (
            <>
              <table className="artist-data-table">
                <thead>
                  <tr>
                    <th>Artist</th>
                    <th>Price</th>
                    <th>Unit</th>
                    <th>Currency</th>
                  </tr>
                </thead>
                <tbody>
                  {storedRows.map((r, i) => (
                    <tr key={i}>
                      <td>{r.artist ?? '—'}</td>
                      <td>{r.price != null ? r.price : '—'}</td>
                      <td>{r.unit ?? '—'}</td>
                      <td>{r.currency ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="artist-data-stored-actions">
                <button type="button" className="btn btn--danger" onClick={clearStored} disabled={clearLoading}>
                  {clearLoading ? 'Clearing…' : 'Clear table'}
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  )
}
