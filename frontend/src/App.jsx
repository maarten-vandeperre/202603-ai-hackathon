import { useState, useCallback } from 'react'
import './App.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8085'

function App() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [dragOver, setDragOver] = useState(false)

  const upload = useCallback(async (fileToUpload) => {
    if (!fileToUpload) return
    setLoading(true)
    setError(null)
    setResult(null)
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

  const reset = useCallback(() => {
    setFile(null)
    setResult(null)
    setError(null)
  }, [])

  return (
    <main className="app">
      <header className="header">
        <h1>Document Parser</h1>
        <p>Upload a PDF, DOCX, or image. Docling will extract text and structure.</p>
      </header>

      <section
        className={`dropzone ${dragOver ? 'dropzone--over' : ''} ${loading ? 'dropzone--loading' : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        <input
          type="file"
          id="file-input"
          className="dropzone__input"
          accept=".pdf,.docx,.doc,.pptx,.xlsx,.html,.png,.jpg,.jpeg,.tiff,.md"
          onChange={onFileChange}
          disabled={loading}
        />
        <label htmlFor="file-input" className="dropzone__label">
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
          <button type="button" className="btn btn--secondary" onClick={reset}>
            Parse another file
          </button>
        </section>
      )}
    </main>
  )
}

export default App
