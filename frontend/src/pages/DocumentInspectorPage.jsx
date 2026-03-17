import { useState, useCallback } from 'react'
import DoclingUpload from '../components/DoclingUpload'
import '../App.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8085'

export default function DocumentInspectorPage() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [totalChunks, setTotalChunks] = useState(null)
  const [error, setError] = useState(null)

  const [ragQuery, setRagQuery] = useState('')
  const [ragLoading, setRagLoading] = useState(false)
  const [ragAnswer, setRagAnswer] = useState(null)
  const [ragFullPrompt, setRagFullPrompt] = useState(null)
  const [ragTab, setRagTab] = useState('answer')
  const [ragError, setRagError] = useState(null)

  const search = useCallback(async () => {
    const q = query.trim()
    if (!q) return
    setLoading(true)
    setError(null)
    setResults(null)
    setTotalChunks(null)
    try {
      const res = await fetch(`${API_BASE}/api/similarity?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || res.statusText)
      setResults(data.results || [])
      setTotalChunks(typeof data.totalChunks === 'number' ? data.totalChunks : 0)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [query])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') search()
  }, [search])

  const askRag = useCallback(async () => {
    const q = ragQuery.trim()
    if (!q) return
    setRagLoading(true)
    setRagError(null)
    setRagAnswer(null)
    setRagFullPrompt(null)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 90000)
      const res = await fetch(`${API_BASE}/api/rag/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      const data = await res.json().catch(() => ({ error: res.statusText }))
      if (!res.ok) {
        setRagError(data.error || res.statusText)
        return
      }
      setRagAnswer(data.answer ?? '')
      setRagFullPrompt(data.fullPrompt ?? null)
      setRagTab('answer')
    } catch (e) {
      if (e.name === 'AbortError') {
        setRagError('Request timed out. The model may be slow; try again or shorten your question.')
      } else if (e.message === 'Failed to fetch') {
        setRagError(`Could not reach the backend at ${API_BASE}. Check that it is running and CORS allows this origin (e.g. http://localhost:5173 or http://127.0.0.1:5173).`)
      } else {
        setRagError(e.message)
      }
    } finally {
      setRagLoading(false)
    }
  }, [ragQuery])

  return (
    <div className="app app--page">
      <header className="header">
        <h1>Document Inspector</h1>
        <p>Upload documents with Docling, store them in the vector database, then run similarity search below.</p>
      </header>

      <section className="inspector-section">
        <h2 className="inspector-section__title">1. Upload and parse (Docling)</h2>
        <DoclingUpload showStoreInVectorDbButton />
      </section>

      <section className="inspector-section">
        <h2 className="inspector-section__title">2. Similarity search</h2>
        <div className="inspector-search">
          <input
            type="text"
            className="inspector-search__input"
            placeholder="Enter your search query…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <button
            type="button"
            className="btn btn--primary"
            onClick={search}
            disabled={loading || !query.trim()}
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>

        {error && (
          <div className="message message--error" role="alert">
            {error}
          </div>
        )}

        {results && (
          <div className="inspector-results">
            <h3 className="inspector-results__title">Top 5 matches</h3>
            {results.length === 0 ? (
              <p className="inspector-results__empty">
                {totalChunks === 0
                  ? 'No documents in the vector database yet. Upload a document above, parse it, then click “Store in vector database”.'
                  : 'No matching chunks for this query. Try different words or phrases.'}
              </p>
            ) : (
              <ul className="inspector-results__list">
                {results.map((r, i) => (
                  <li key={i} className="inspector-result">
                    <div className="inspector-result__meta">
                      <strong>{r.documentName}</strong>
                      <span className="inspector-result__time">{r.uploadTime ? new Date(r.uploadTime).toLocaleString() : ''}</span>
                      {r.distance != null && (
                        <span className="inspector-result__distance">distance: {r.distance.toFixed(4)}</span>
                      )}
                    </div>
                    <pre className="inspector-result__text">{r.chunkText}</pre>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section className="inspector-section">
        <h2 className="inspector-section__title">3. Ask (RAG)</h2>
        <p className="inspector-section__desc">Ask a question about your stored documents. The answer is generated using the Ollama model (tinyllama) with retrieved context.</p>
        <div className="inspector-rag">
          <textarea
            className="inspector-rag__input"
            placeholder="e.g. What is the main topic of the document?"
            value={ragQuery}
            onChange={(e) => setRagQuery(e.target.value)}
            disabled={ragLoading}
            rows={3}
          />
          <button
            type="button"
            className="btn btn--primary"
            onClick={askRag}
            disabled={ragLoading || !ragQuery.trim()}
          >
            {ragLoading ? 'Asking…' : 'Ask'}
          </button>
        </div>
        {ragError && (
          <div className="message message--error" role="alert">
            {ragError}
          </div>
        )}
        {ragAnswer != null && (
          <div className="inspector-rag-answer">
            {ragFullPrompt != null && (
              <div className="inspector-rag-tabs">
                <button
                  type="button"
                  className={`inspector-rag-tab ${ragTab === 'answer' ? 'inspector-rag-tab--active' : ''}`}
                  onClick={() => setRagTab('answer')}
                >
                  Answer
                </button>
                <button
                  type="button"
                  className={`inspector-rag-tab ${ragTab === 'prompt' ? 'inspector-rag-tab--active' : ''}`}
                  onClick={() => setRagTab('prompt')}
                >
                  Query to model
                </button>
              </div>
            )}
            {ragTab === 'answer' && (
              <>
                <h3 className="inspector-rag-answer__title">Answer</h3>
                <div className="inspector-rag-answer__text">{ragAnswer}</div>
              </>
            )}
            {ragTab === 'prompt' && ragFullPrompt != null && (
              <>
                <h3 className="inspector-rag-answer__title">Full prompt sent to the model</h3>
                <pre className="inspector-rag-prompt">{ragFullPrompt}</pre>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
