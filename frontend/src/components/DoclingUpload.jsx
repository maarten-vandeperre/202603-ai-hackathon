import { useState, useCallback, useId } from 'react'
import '../App.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8085'

/**
 * Reusable Docling upload + parse UI.
 * @param {boolean} showStoreInVectorDbButton - If true, show "Store in vector database" after parse (Document Inspector).
 */
export default function DoclingUpload({ showStoreInVectorDbButton = false }) {
  const inputId = useId()
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [storing, setStoring] = useState(false)
  const [storeMessage, setStoreMessage] = useState(null)

  const upload = useCallback(async (fileToUpload) => {
    if (!fileToUpload) return
    setLoading(true)
    setError(null)
    setResult(null)
    setStoreMessage(null)
    const formData = new FormData()
    formData.append('file', fileToUpload)
    try {
      const res = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || res.statusText)
      setResult(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer?.files?.[0]
    if (f) {
      setFile(f)
      upload(f)
    }
  }, [upload])

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
    if (f) {
      setFile(f)
      upload(f)
    }
  }, [upload])

  const storeInVectorDb = useCallback(async () => {
    if (!result) return
    const textToIndex = result.markdown || result.text || ''
    if (!textToIndex) {
      setStoreMessage('No text to store.')
      return
    }
    setStoring(true)
    setStoreMessage(null)
    try {
      const res = await fetch(`${API_BASE}/api/vectorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentName: result.filename,
          uploadTime: new Date().toISOString(),
          text: textToIndex,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || res.statusText)
      setStoreMessage('Stored in vector database. You can search in the box below.')
    } catch (e) {
      setStoreMessage('Failed: ' + e.message)
    } finally {
      setStoring(false)
    }
  }, [result])

  const reset = useCallback(() => {
    setFile(null)
    setResult(null)
    setError(null)
    setStoreMessage(null)
  }, [])

  return (
    <section className="docling-upload">
      <section
        className={`dropzone ${dragOver ? 'dropzone--over' : ''} ${loading ? 'dropzone--loading' : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        <input
          type="file"
          id={inputId}
          className="dropzone__input"
          accept=".pdf,.docx,.doc,.pptx,.xlsx,.html,.png,.jpg,.jpeg,.tiff,.md"
          onChange={onFileChange}
          disabled={loading}
        />
        <label htmlFor={inputId} className="dropzone__label">
          {loading ? (
            <span className="dropzone__status">Parsing…</span>
          ) : (
            <>
              <span className="dropzone__prompt">
                {file ? file.name : 'Drop a file here or click to browse'}
              </span>
              <span className="dropzone__hint">PDF, DOCX, images, etc.</span>
            </>
          )}
        </label>
      </section>

      {error && (
        <div className="message message--error" role="alert">
          {error}
        </div>
      )}

      {result && (
        <section className="result">
          <div className="result__meta">
            <strong>{result.filename}</strong>
            {result.processingTime != null && (
              <span className="result__time">
                Parsed in {(result.processingTime / 1000).toFixed(2)}s
              </span>
            )}
            {result.errors?.length > 0 && (
              <ul className="result__errors">
                {result.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="result__tabs">
            <div className="result__panel">
              <h3>Markdown</h3>
              <pre className="result__content">{result.markdown || '(none)'}</pre>
            </div>
            <div className="result__panel">
              <h3>Plain text</h3>
              <pre className="result__content">{result.text || '(none)'}</pre>
            </div>
          </div>
          <div className="result__actions">
            {showStoreInVectorDbButton && (
              <button
                type="button"
                className="btn btn--primary"
                onClick={storeInVectorDb}
                disabled={storing || !(result.markdown || result.text)}
              >
                {storing ? 'Storing…' : 'Store in vector database'}
              </button>
            )}
            <button type="button" className="btn btn--secondary" onClick={reset}>
              Parse another file
            </button>
          </div>
          {storeMessage && (
            <p className="result__store-message">{storeMessage}</p>
          )}
        </section>
      )}
    </section>
  )
}
