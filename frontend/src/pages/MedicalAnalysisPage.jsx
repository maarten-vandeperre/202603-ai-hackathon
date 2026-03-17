import { useState, useCallback, useId } from 'react'
import '../App.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8085'

const STEPS = [
  { id: 1, label: 'Upload document' },
  { id: 2, label: 'Extract pathologies' },
  { id: 3, label: 'Results' },
]

const INITIAL_PATHOLOGIES = [
  {
    id: 'acl',
    name: 'Anterior Cruciate Ligament (ACL) Tear',
    description: 'A rupture or partial tear of the ACL, often caused by sudden twisting or pivoting movements—very common in skiing accidents.',
    documentExcerpt: 'MRI of the knee revealed a complete rupture of the anterior cruciate ligament with significant bone bruising and joint effusion. The patient reported a sudden twisting injury while skiing when the binding did not release. Lachman and pivot-shift tests were positive. Surgical reconstruction was recommended.',
    page: 2,
    section: 'Radiology report',
  },
  {
    id: 'mcl',
    name: 'Medial Collateral Ligament (MCL) Sprain/Tear',
    description: 'Injury to the ligament on the inner side of the knee, typically caused by a force pushing the knee inward, which also frequently happens during skiing falls.',
    documentExcerpt: 'Clinical examination showed marked tenderness along the medial joint line and the course of the medial collateral ligament. Valgus stress test was positive. The patient described a fall while skiing with the knee forced inward. Ultrasound confirmed a grade II MCL sprain with partial fibre disruption.',
    page: 3,
    section: 'Clinical findings',
  },
]

const MOCK_SOURCE_DOCUMENT = `Knee injury assessment – Source document (mock)

Patient: [Redacted]
Date: 2024-03-15
Referring physician: Dr. Smith

RADIOLOGY REPORT (p. 2)
MRI of the knee revealed a complete rupture of the anterior cruciate ligament with significant bone bruising and joint effusion. The patient reported a sudden twisting injury while skiing when the binding did not release. Lachman and pivot-shift tests were positive. Surgical reconstruction was recommended.

CLINICAL FINDINGS (p. 3)
Clinical examination showed marked tenderness along the medial joint line and the course of the medial collateral ligament. Valgus stress test was positive. The patient described a fall while skiing with the knee forced inward. Ultrasound confirmed a grade II MCL sprain with partial fibre disruption.

Additional notes: Patient advised to avoid weight-bearing sports for 6 weeks. Follow-up in 4 weeks.`

let nextPathologyId = 100
function generatePathologyId() {
  return `path-${nextPathologyId++}`
}

export default function MedicalAnalysisPage() {
  const inputId = useId()
  const [currentStep, setCurrentStep] = useState(1)
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [parseResult, setParseResult] = useState(null)
  const [error, setError] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [extractionResult, setExtractionResult] = useState(null)
  const [pathologies, setPathologies] = useState(() => [...INITIAL_PATHOLOGIES])
  const [pathologyStatus, setPathologyStatus] = useState({})
  const [sideViewMode, setSideViewMode] = useState(null)
  const [sideViewPathology, setSideViewPathology] = useState(null)
  const [showAddPathologyForm, setShowAddPathologyForm] = useState(false)
  const [newPathologyName, setNewPathologyName] = useState('')
  const [newPathologyDesc, setNewPathologyDesc] = useState('')
  const [addFromSelection, setAddFromSelection] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)

  const upload = useCallback(async (fileToUpload) => {
    if (!fileToUpload) return
    setLoading(true)
    setError(null)
    setParseResult(null)
    setExtractionResult(null)
    const formData = new FormData()
    formData.append('file', fileToUpload)
    try {
      const res = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || res.statusText)
      setParseResult(data)
      setCurrentStep(2)
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

  const extractPathologies = useCallback(async () => {
    if (!parseResult) return
    setExtracting(true)
    setExtractionResult(null)
    try {
      const text = parseResult.text || parseResult.markdown || ''
      setExtractionResult({
        text,
        filename: parseResult.filename,
        message: 'Extraction complete. Pathologies are derived from the document text below.',
      })
      setPathologies([...INITIAL_PATHOLOGIES])
      setPathologyStatus({})
      setCurrentStep(3)
    } catch (e) {
      setError(e.message)
    } finally {
      setExtracting(false)
    }
  }, [parseResult])

  const acceptPathology = useCallback((id) => {
    setPathologyStatus((s) => ({ ...s, [id]: 'accepted' }))
  }, [])

  const declinePathology = useCallback((id) => {
    setPathologyStatus((s) => ({ ...s, [id]: 'declined' }))
  }, [])

  const openPathologyExcerpt = useCallback((p) => {
    setSideViewMode('pathology')
    setSideViewPathology(p)
    setAddFromSelection(null)
  }, [])

  const openDocumentView = useCallback(() => {
    setSideViewMode('document')
    setSideViewPathology(null)
    setAddFromSelection(null)
  }, [])

  const closeSideView = useCallback(() => {
    setSideViewMode(null)
    setSideViewPathology(null)
    setAddFromSelection(null)
  }, [])

  const handleDocumentSelection = useCallback(() => {
    const sel = window.getSelection()
    const text = sel?.toString()?.trim()
    if (text) setAddFromSelection({ selectedText: text, selectionAs: 'name', otherValue: '' })
  }, [])

  const addPathologyManual = useCallback(() => {
    const name = newPathologyName.trim()
    const desc = newPathologyDesc.trim()
    if (!name || !desc) return
    setPathologies((prev) => [
      ...prev,
      { id: generatePathologyId(), name, description: desc, documentExcerpt: null, page: null, section: null },
    ])
    setNewPathologyName('')
    setNewPathologyDesc('')
    setShowAddPathologyForm(false)
  }, [newPathologyName, newPathologyDesc])

  const addPathologyFromSelection = useCallback(() => {
    if (!addFromSelection) return
    const { selectedText, selectionAs, otherValue } = addFromSelection
    const other = otherValue.trim()
    if (!other) return
    const name = selectionAs === 'name' ? selectedText : other
    const description = selectionAs === 'description' ? selectedText : other
    setPathologies((prev) => [
      ...prev,
      { id: generatePathologyId(), name, description, documentExcerpt: selectedText, page: null, section: null },
    ])
    setAddFromSelection(null)
    window.getSelection()?.removeAllRanges()
  }, [addFromSelection])

  const cancelAddFromSelection = useCallback(() => {
    setAddFromSelection(null)
    window.getSelection()?.removeAllRanges()
  }, [])

  const analyze = useCallback(async () => {
    if (!extractionResult) return
    setAnalyzing(true)
    setError(null)
    try {
      // Placeholder: can call a backend analysis endpoint later
      await new Promise((r) => setTimeout(r, 800))
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setAnalyzing(false)
    }
  }, [extractionResult])

  const reset = useCallback(() => {
    setCurrentStep(1)
    setFile(null)
    setParseResult(null)
    setExtractionResult(null)
    setPathologies([...INITIAL_PATHOLOGIES])
    setPathologyStatus({})
    setSideViewMode(null)
    setSideViewPathology(null)
    setShowAddPathologyForm(false)
    setAddFromSelection(null)
    setError(null)
  }, [])

  return (
    <div className="app app--page">
      <header className="header">
        <h1>Medical Analysis</h1>
        <p>Upload a medical document; Docling extracts text. Then run pathology extraction.</p>
      </header>

      <section className="workflow">
        <ol className="workflow__steps" aria-label="Workflow steps">
          {STEPS.map((step) => (
            <li
              key={step.id}
              className={`workflow__step ${currentStep === step.id ? 'workflow__step--current' : ''} ${currentStep > step.id ? 'workflow__step--done' : ''}`}
            >
              <span className="workflow__step-num">{step.id}</span>
              <span className="workflow__step-label">{step.label}</span>
            </li>
          ))}
        </ol>

        <div className="workflow__content">
          {currentStep === 1 && (
            <>
              <h2 className="workflow__title">Step 1: Upload document</h2>
              <p className="workflow__desc">Drop or select a file. Docling will parse it (PDF, DOCX, images).</p>
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
            </>
          )}

          {currentStep === 2 && (
            <>
              <h2 className="workflow__title">Step 2: Extract pathologies</h2>
              <p className="workflow__desc">Document parsed. Click below to run pathology extraction on the extracted text.</p>
              {parseResult && (
                <div className="workflow__parse-summary">
                  <strong>{parseResult.filename}</strong>
                  {parseResult.processingTime != null && (
                    <span className="workflow__meta">Parsed in {(parseResult.processingTime / 1000).toFixed(2)}s</span>
                  )}
                </div>
              )}
              <button
                type="button"
                className="btn btn--primary"
                onClick={extractPathologies}
                disabled={extracting || !parseResult}
              >
                {extracting ? 'Extracting…' : 'Extract pathologies'}
              </button>
              <button type="button" className="btn btn--secondary" onClick={reset}>
                Start over
              </button>
            </>
          )}

          {currentStep === 3 && (
            <>
              <h2 className="workflow__title">Step 3: Results</h2>
              {extractionResult && (
                <div className="workflow__result">
                  <p className="workflow__result-message">Extracted pathologies from the uploaded document.</p>
                  <div className="workflow__result-toolbar">
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={openDocumentView}
                      title="View source document"
                      aria-label="View source document"
                    >
                      <DocumentIcon />
                      <span>View document</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() => setShowAddPathologyForm(true)}
                      aria-label="Add pathology"
                    >
                      + Add pathology
                    </button>
                  </div>
                  {showAddPathologyForm && (
                    <div className="add-pathology-form">
                      <h3 className="add-pathology-form__title">Add pathology</h3>
                      <label className="add-pathology-form__label">
                        Name
                        <input
                          type="text"
                          className="add-pathology-form__input"
                          value={newPathologyName}
                          onChange={(e) => setNewPathologyName(e.target.value)}
                          placeholder="Pathology name"
                        />
                      </label>
                      <label className="add-pathology-form__label">
                        Description
                        <textarea
                          className="add-pathology-form__textarea"
                          value={newPathologyDesc}
                          onChange={(e) => setNewPathologyDesc(e.target.value)}
                          placeholder="Description"
                          rows={3}
                        />
                      </label>
                      <div className="add-pathology-form__actions">
                        <button type="button" className="btn btn--primary" onClick={addPathologyManual} disabled={!newPathologyName.trim() || !newPathologyDesc.trim()}>
                          Add
                        </button>
                        <button type="button" className="btn btn--secondary" onClick={() => { setShowAddPathologyForm(false); setNewPathologyName(''); setNewPathologyDesc(''); }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  <ul className="pathology-list">
                    {pathologies.map((p) => {
                      const status = pathologyStatus[p.id]
                      return (
                        <li key={p.id} className={`pathology-item ${status ? `pathology-item--${status}` : ''}`}>
                          <div className="pathology-item__body">
                            <h3 className="pathology-item__name">{p.name}</h3>
                            <p className="pathology-item__desc">{p.description}</p>
                          </div>
                          <div className="pathology-item__actions">
                            <button
                              type="button"
                              className="pathology-item__btn pathology-item__btn--accept"
                              onClick={() => acceptPathology(p.id)}
                              title="Accept"
                              aria-label={`Accept ${p.name}`}
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              className="pathology-item__btn pathology-item__btn--decline"
                              onClick={() => declinePathology(p.id)}
                              title="Decline"
                              aria-label={`Decline ${p.name}`}
                            >
                              Decline
                            </button>
                            <button
                              type="button"
                              className="pathology-item__eye"
                              onClick={() => openPathologyExcerpt(p)}
                              title="View in document"
                              aria-label={`Show document excerpt for ${p.name}`}
                            >
                              <EyeIcon />
                            </button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
              <div className="workflow__result-actions">
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={analyze}
                  disabled={analyzing || !extractionResult}
                >
                  {analyzing ? 'Analyzing…' : 'Analyze'}
                </button>
                <button type="button" className="btn btn--secondary" onClick={reset}>
                  Analyse another document
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      {error && (
        <div className="message message--error" role="alert">
          {error}
        </div>
      )}

      {(sideViewMode === 'pathology' && sideViewPathology) && (
        <div className="side-view-overlay" onClick={closeSideView} aria-hidden="false">
          <aside
            className="side-view"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="side-view-title"
            aria-modal="true"
          >
            <div className="side-view__header">
              <h2 id="side-view-title" className="side-view__title">{sideViewPathology.name}</h2>
              <button type="button" className="side-view__close" onClick={closeSideView} aria-label="Close">×</button>
            </div>
            <div className="side-view__meta">
              {extractionResult?.filename && (
                <span className="side-view__meta-item">
                  <span className="side-view__meta-label">Document</span>
                  <span className="side-view__meta-value">{extractionResult.filename}</span>
                </span>
              )}
              {sideViewPathology.page != null && (
                <span className="side-view__meta-item">
                  <span className="side-view__meta-label">Page</span>
                  <span className="side-view__meta-value">{sideViewPathology.page}</span>
                </span>
              )}
              {sideViewPathology.section && (
                <span className="side-view__meta-item">
                  <span className="side-view__meta-label">Section</span>
                  <span className="side-view__meta-value">{sideViewPathology.section}</span>
                </span>
              )}
            </div>
            <div className="side-view__content">
              <pre className="side-view__excerpt">{sideViewPathology.documentExcerpt}</pre>
            </div>
          </aside>
        </div>
      )}

      {sideViewMode === 'document' && (
        <div className="side-view-overlay" onClick={closeSideView} aria-hidden="false">
          <aside
            className="side-view side-view--document"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="side-view-doc-title"
            aria-modal="true"
          >
            <div className="side-view__header">
              <h2 id="side-view-doc-title" className="side-view__title">Source document</h2>
              <button type="button" className="side-view__close" onClick={closeSideView} aria-label="Close">×</button>
            </div>
            <div className="side-view__meta">
              {extractionResult?.filename && (
                <span className="side-view__meta-item">
                  <span className="side-view__meta-label">Document</span>
                  <span className="side-view__meta-value">{extractionResult.filename}</span>
                </span>
              )}
            </div>
            <p className="side-view__hint">Select text in the document below, then choose whether it is the name or description of a pathology and fill in the other field to add it.</p>
            <div
              className="side-view__document-content"
              onMouseUp={handleDocumentSelection}
              onTouchEnd={handleDocumentSelection}
            >
              {MOCK_SOURCE_DOCUMENT}
            </div>
            {addFromSelection && (
              <div className="add-from-selection">
                <h3 className="add-from-selection__title">Add pathology from selection</h3>
                <p className="add-from-selection__preview">Selected: "{addFromSelection.selectedText.slice(0, 60)}{addFromSelection.selectedText.length > 60 ? '…' : ''}"</p>
                <div className="add-from-selection__radio">
                  <label>
                    <input
                      type="radio"
                      name="selectionAs"
                      checked={addFromSelection.selectionAs === 'name'}
                      onChange={() => setAddFromSelection((s) => s ? { ...s, selectionAs: 'name' } : null)}
                    />
                    Selection is <strong>name</strong>
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="selectionAs"
                      checked={addFromSelection.selectionAs === 'description'}
                      onChange={() => setAddFromSelection((s) => s ? { ...s, selectionAs: 'description' } : null)}
                    />
                    Selection is <strong>description</strong>
                  </label>
                </div>
                <label className="add-from-selection__label">
                  {addFromSelection.selectionAs === 'name' ? 'Description' : 'Name'}
                  <input
                    type="text"
                    className="add-from-selection__input"
                    value={addFromSelection.otherValue}
                    onChange={(e) => setAddFromSelection((s) => s ? { ...s, otherValue: e.target.value } : null)}
                    placeholder={addFromSelection.selectionAs === 'name' ? 'Enter description' : 'Enter name'}
                  />
                </label>
                <div className="add-from-selection__actions">
                  <button type="button" className="btn btn--primary" onClick={addPathologyFromSelection} disabled={!addFromSelection.otherValue.trim()}>
                    Add pathology
                  </button>
                  <button type="button" className="btn btn--secondary" onClick={cancelAddFromSelection}>Cancel</button>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}

function DocumentIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}
