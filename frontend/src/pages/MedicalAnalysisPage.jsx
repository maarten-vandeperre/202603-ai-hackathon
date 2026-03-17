import { useState, useCallback, useId, useEffect } from 'react'
import '../App.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8085'

const PIPELINE_STAGES = [
  { id: 1, key: 'ingest', label: 'Ingest' },
  { id: 2, key: 'detect', label: 'Detect' },
  { id: 3, key: 'enrich', label: 'Enrich' },
  { id: 4, key: 'analyze', label: 'Analyze' },
  { id: 5, key: 'score', label: 'Score' },
  { id: 6, key: 'report', label: 'Report' },
]

const SCORE_BASKETS = [
  { id: 'move', label: 'Ability to move', prefilledScore: 2, llmMotivation: 'Patient has knee injury; mobility limited per clinical notes. Suggested grade 2 (moderate limitation).' },
  { id: 'eat', label: 'Ability to eat and/or prepare food', prefilledScore: 4, llmMotivation: 'No indication of impact on eating or food preparation in the document.' },
  { id: 'clean-dress', label: 'Ability to clean/dress yourself', prefilledScore: 3, llmMotivation: 'Knee injury may affect bending and dressing; conservative grade 3.' },
  { id: 'surveillance', label: 'Ability to live without surveillance (e.g., takes medicines properly)', prefilledScore: 4, llmMotivation: 'No evidence of need for supervision in the report.' },
  { id: 'clean-house', label: 'Ability to clean the house', prefilledScore: 2, llmMotivation: 'Mobility and weight-bearing restrictions suggest difficulty with household tasks.' },
  { id: 'socialize', label: 'Ability to socialize', prefilledScore: 3, llmMotivation: 'Driving restricted for 2 weeks; may limit social activities temporarily.' },
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
let nextDescriptionId = 200
function generatePathologyId() {
  return `path-${nextPathologyId++}`
}
function generateDescriptionId() {
  return `desc-${nextDescriptionId++}`
}

/** Paragraphs from the original document linked to the inability, as written by the physician (hard-coded). One section is partly handwritten (image). */
const ENRICH_SECTIONS = [
  {
    id: 'enrich-1',
    title: 'Clinical assessment',
    source: 'Radiology report, p. 2',
    text: 'MRI of the knee revealed a complete rupture of the anterior cruciate ligament with significant bone bruising and joint effusion. The patient reported a sudden twisting injury while skiing when the binding did not release. Lachman and pivot-shift tests were positive. Surgical reconstruction was recommended.',
    handwritten: false,
  },
  {
    id: 'enrich-2',
    title: 'Examination findings',
    source: 'Clinical notes, p. 3',
    text: 'Clinical examination showed marked tenderness along the medial joint line and the course of the medial collateral ligament. Valgus stress test was positive. The patient described a fall while skiing with the knee forced inward. Ultrasound confirmed a grade II MCL sprain with partial fibre disruption.',
    handwritten: false,
  },
  {
    id: 'enrich-3',
    title: 'Physician notes (partly handwritten)',
    source: 'Handwritten addendum, p. 4',
    text: 'No driving for 2 weeks. Consider physiotherapy from week 3.',
    handwritten: true,
    handwrittenNote: 'No driving for 2 weeks. Consider physiotherapy from week 3.',
  },
]

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
  const [sideViewDescription, setSideViewDescription] = useState(null)
  const [showAddPathologyForm, setShowAddPathologyForm] = useState(false)
  const [newPathologyName, setNewPathologyName] = useState('')
  const [newPathologyDesc, setNewPathologyDesc] = useState('')
  const [addFromSelection, setAddFromSelection] = useState(null)
  const [documentViewContext, setDocumentViewContext] = useState('results')
  const [extraDescriptions, setExtraDescriptions] = useState([])
  const [extraDescriptionStatus, setExtraDescriptionStatus] = useState({})
  const [enrichSectionStatus, setEnrichSectionStatus] = useState({})
  const [showAddDescriptionForm, setShowAddDescriptionForm] = useState(false)
  const [newDescriptionText, setNewDescriptionText] = useState('')
  const [enriching, setEnriching] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [scoreBaskets, setScoreBaskets] = useState(() =>
    SCORE_BASKETS.map((b) => ({ ...b, score: b.prefilledScore, motivation: '' }))
  )
  const [contextPaneOpen, setContextPaneOpen] = useState(false)

  useEffect(() => {
    if (!loading) {
      setUploadProgress(0)
      return
    }
    const t1 = setTimeout(() => setUploadProgress(25), 100)
    const t2 = setTimeout(() => setUploadProgress(55), 400)
    const t3 = setTimeout(() => setUploadProgress(85), 800)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [loading])

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

  const openDocumentView = useCallback((context = 'results') => {
    setDocumentViewContext(context)
    setSideViewMode('document')
    setSideViewPathology(null)
    setAddFromSelection(null)
  }, [])

  const closeSideView = useCallback(() => {
    setSideViewMode(null)
    setSideViewPathology(null)
    setSideViewDescription(null)
    setAddFromSelection(null)
  }, [])

  const openDescriptionExcerpt = useCallback((payload) => {
    setSideViewMode('description')
    setSideViewPathology(null)
    setSideViewDescription(payload)
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

  const enrich = useCallback(async () => {
    if (!extractionResult) return
    setEnriching(true)
    setError(null)
    try {
      await new Promise((r) => setTimeout(r, 400))
      setCurrentStep(4)
    } catch (e) {
      setError(e.message)
    } finally {
      setEnriching(false)
    }
  }, [extractionResult])

  const acceptExtraDescription = useCallback((id) => {
    setExtraDescriptionStatus((s) => ({ ...s, [id]: 'accepted' }))
  }, [])

  const declineExtraDescription = useCallback((id) => {
    setExtraDescriptionStatus((s) => ({ ...s, [id]: 'declined' }))
  }, [])

  const acceptEnrichSection = useCallback((id) => {
    setEnrichSectionStatus((s) => ({ ...s, [id]: 'accepted' }))
  }, [])

  const declineEnrichSection = useCallback((id) => {
    setEnrichSectionStatus((s) => ({ ...s, [id]: 'declined' }))
  }, [])

  const addExtraDescriptionManual = useCallback(() => {
    const text = newDescriptionText.trim()
    if (!text) return
    const id = generateDescriptionId()
    setExtraDescriptions((prev) => [...prev, { id, text }])
    setNewDescriptionText('')
    setShowAddDescriptionForm(false)
  }, [newDescriptionText])

  const addExtraDescriptionFromSelection = useCallback(() => {
    if (!addFromSelection?.selectedText) return
    const id = generateDescriptionId()
    setExtraDescriptions((prev) => [...prev, { id, text: addFromSelection.selectedText, sourceExcerpt: addFromSelection.selectedText }])
    setAddFromSelection(null)
    window.getSelection()?.removeAllRanges()
  }, [addFromSelection])

  const handleDocumentSelectionEnrich = useCallback(() => {
    const sel = window.getSelection()
    const text = sel?.toString()?.trim()
    if (text) setAddFromSelection({ selectedText: text, selectionAs: 'description', otherValue: '' })
  }, [])

  const reset = useCallback(() => {
    setCurrentStep(1)
    setFile(null)
    setParseResult(null)
    setExtractionResult(null)
    setPathologies([...INITIAL_PATHOLOGIES])
    setPathologyStatus({})
    setSideViewMode(null)
    setSideViewPathology(null)
    setSideViewDescription(null)
    setDocumentViewContext('results')
    setShowAddPathologyForm(false)
    setAddFromSelection(null)
    setExtraDescriptions([])
    setExtraDescriptionStatus({})
    setEnrichSectionStatus({})
    setShowAddDescriptionForm(false)
    setScoreBaskets(() => SCORE_BASKETS.map((b) => ({ ...b, score: b.prefilledScore, motivation: '' })))
    setContextPaneOpen(false)
    setError(null)
  }, [])

  const setBasketScore = useCallback((id, score) => {
    setScoreBaskets((prev) => prev.map((b) => (b.id === id ? { ...b, score } : b)))
  }, [])

  const setBasketMotivation = useCallback((id, motivation) => {
    setScoreBaskets((prev) => prev.map((b) => (b.id === id ? { ...b, motivation } : b)))
  }, [])

  const openContextPane = useCallback(() => setContextPaneOpen(true), [])
  const closeContextPane = useCallback(() => setContextPaneOpen(false), [])

  const pipelineStatus = (stageId) => {
    if (stageId === 1) return loading ? 'processing' : parseResult ? 'done' : currentStep === 1 ? 'current' : 'idle'
    if (stageId === 2) return extracting ? 'processing' : currentStep > 2 ? 'done' : currentStep === 2 ? 'current' : 'idle'
    if (stageId === 3) return currentStep > 3 ? 'done' : currentStep === 3 ? 'current' : 'idle'
    if (stageId === 4) return currentStep > 4 ? 'done' : currentStep === 4 ? 'current' : 'idle'
    if (stageId === 5) return currentStep > 5 ? 'done' : currentStep === 5 ? 'current' : 'idle'
    if (stageId === 6) return currentStep === 6 ? 'current' : 'idle'
    return 'idle'
  }

  const scoreToBackground = (score) => {
    if (score === 4) return 'var(--score-4)'
    if (score === 3) return 'var(--score-3)'
    if (score === 2) return 'var(--score-2)'
    if (score === 1) return 'var(--score-1)'
    return 'var(--score-0)'
  }

  return (
    <div className="app app--page cliniq">
      <header className="cliniq__header">
        <h1 className="cliniq__logo">ClinIQ</h1>
        <p className="cliniq__tagline">Turn medical documents into structured insights. Ingest, detect, enrich, analyze.</p>
      </header>

      <nav className="cliniq-pipeline" aria-label="Analysis pipeline">
        {PIPELINE_STAGES.map((stage) => {
          const status = pipelineStatus(stage.id)
          return (
            <div
              key={stage.id}
              className={`cliniq-stage cliniq-stage--${status}`}
              aria-current={status === 'current' ? 'step' : undefined}
            >
              <span className="cliniq-stage__icon" aria-hidden="true">{stage.id}</span>
              <span className="cliniq-stage__label">{stage.label}</span>
            </div>
          )
        })}
      </nav>

      <div className="workflow__content">
        {currentStep === 1 && (
          <div className="cliniq-content">
            <h2 className="cliniq-content__title">Drop your document to unlock insights</h2>
            <p className="cliniq-content__desc">We’ll parse and prepare it for analysis. One file at a time.</p>
            <section
              className={`cliniq-dropzone ${dragOver ? 'cliniq-dropzone--over' : ''} ${loading ? 'cliniq-dropzone--loading' : ''} ${parseResult && file ? 'cliniq-dropzone--loaded' : ''}`}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
            >
              <input
                type="file"
                id={inputId}
                className="cliniq-dropzone__input"
                accept=".pdf,.docx,.doc,.pptx,.xlsx,.html,.png,.jpg,.jpeg,.tiff,.md"
                onChange={onFileChange}
                disabled={loading}
              />
              <label htmlFor={inputId} className="cliniq-dropzone__label">
                {loading ? (
                  <>
                    <span className="cliniq-dropzone__status">Reading document…</span>
                    <div className="cliniq-dropzone__progress-wrap">
                      <div className="cliniq-dropzone__progress-bar" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  </>
                ) : parseResult && file ? (
                  <>
                    <span className="cliniq-dropzone__prompt">Document ready for analysis</span>
                    <div className="cliniq-file-preview">
                      <span className="cliniq-file-preview__icon" aria-hidden="true">📄</span>
                      <div>
                        <div className="cliniq-file-preview__name">{file.name}</div>
                        <div className="cliniq-file-preview__meta">
                          {parseResult.processingTime != null ? `Parsed in ${(parseResult.processingTime / 1000).toFixed(2)}s` : 'Ready'}
                        </div>
                      </div>
                    </div>
                    <span className="cliniq-dropzone__hint">Drop another file or continue below</span>
                  </>
                ) : (
                  <>
                    <span className="cliniq-dropzone__prompt">
                      {file ? file.name : 'Drop a file here or click to browse'}
                    </span>
                    <span className="cliniq-dropzone__hint">We support PDFs, scans, and handwritten notes</span>
                  </>
                )}
              </label>
              {!loading && !parseResult && (
                <p className="cliniq-dropzone__smart-hint">PDF, DOCX, images. We extract text automatically.</p>
              )}
            </section>
            {parseResult && (
              <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn--primary" onClick={() => setCurrentStep(2)}>
                  Continue to detect pathologies
                </button>
                <button type="button" className="btn btn--secondary" onClick={reset}>Start over</button>
              </div>
            )}
          </div>
        )}

        {currentStep === 2 && (
          <div className="cliniq-content">
            <h2 className="cliniq-content__title">Detect pathologies</h2>
            <p className="cliniq-content__desc">Run extraction on the parsed text to detect pathologies and findings.</p>
            {parseResult && (
              <div className={`cliniq-card cliniq-doc-card ${extracting ? 'cliniq-doc-card--scanning' : ''}`} style={{ marginBottom: '1.25rem' }}>
                <strong>{parseResult.filename}</strong>
                {parseResult.processingTime != null && (
                  <span className="workflow__meta" style={{ marginLeft: '0.75rem' }}>Parsed in {(parseResult.processingTime / 1000).toFixed(2)}s</span>
                )}
              </div>
            )}
            <button
              type="button"
              className="btn btn--primary"
              onClick={extractPathologies}
              disabled={extracting || !parseResult}
            >
              {extracting ? 'Detecting pathologies…' : 'Detect pathologies'}
            </button>
            <button type="button" className="btn btn--secondary" onClick={reset} style={{ marginLeft: '0.5rem' }}>
              Start over
            </button>
          </div>
        )}

          {currentStep === 3 && (
            <>
              <div className="cliniq-content">
                <div className="cliniq-results-header">
                  <h2 className="cliniq-results-header__title">What we found</h2>
                  <p className="cliniq-results-header__sub">Review and confirm findings, then enrich with context.</p>
                </div>
                {extractionResult && (
                  <>
                    <div className="cliniq-highlights">
                      <span className="cliniq-highlight cliniq-highlight--valid">{pathologies.length} patholog{pathologies.length !== 1 ? 'ies' : 'y'} detected</span>
                      {extractionResult?.filename && <span className="cliniq-highlight">{extractionResult.filename}</span>}
                    </div>
                    <div className="workflow__result">
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
                      + Add finding
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
                  </>
                )}
                <div className="workflow__result-actions">
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={enrich}
                    disabled={enriching || !extractionResult}
                  >
                    {enriching ? 'Enriching…' : 'Enrich with context'}
                  </button>
                  <button type="button" className="btn btn--secondary" onClick={reset}>
                    Analyze another document
                  </button>
                </div>
              </div>
            </>
          )}

          {currentStep === 4 && (
            <>
              <div className="cliniq-content">
                <h2 className="cliniq-content__title">Enrich with context</h2>
                <p className="cliniq-content__desc">Paragraphs from the document linked to the findings. Some content may be handwritten.</p>
              </div>
              <div className="workflow__result-toolbar">
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => openDocumentView('enrich')}
                  title="View source document"
                  aria-label="View source document"
                >
                  <DocumentIcon />
                  <span>View document</span>
                </button>
              </div>
              <div className="enrich-sections">
                {ENRICH_SECTIONS.map((section) => {
                  const sectionStatus = enrichSectionStatus[section.id]
                  return (
                    <div key={section.id} className={`enrich-section ${section.handwritten ? 'enrich-section--handwritten' : ''} ${sectionStatus ? `enrich-section--${sectionStatus}` : ''}`}>
                      <div className="enrich-section__content">
                        <h3 className="enrich-section__title">{section.title}</h3>
                        <span className="enrich-section__source">{section.source}</span>
                        <p className="enrich-section__text">{section.text}</p>
                        {section.handwritten && (
                      <div className="enrich-section__handwritten">
                        <span className="enrich-section__image-caption">Handwritten note (image)</span>
                        <div className="enrich-section__image-placeholder" aria-hidden="true">
                          <HandwrittenImagePlaceholder text={section.handwrittenNote} />
                        </div>
                      </div>
                    )}
                      </div>
                      <div className="enrich-section__actions">
                        <button type="button" className="pathology-item__btn pathology-item__btn--accept" onClick={() => acceptEnrichSection(section.id)} title="Approve">Approve</button>
                        <button type="button" className="pathology-item__btn pathology-item__btn--decline" onClick={() => declineEnrichSection(section.id)} title="Decline">Decline</button>
                        <button
                          type="button"
                          className="pathology-item__eye"
                          onClick={() => openDescriptionExcerpt({
                            title: section.title,
                            excerpt: section.text + (section.handwritten ? `\n\n[Handwritten note]\n${section.handwrittenNote}` : ''),
                            sourceLabel: section.source,
                          })}
                          title="View source chunk"
                          aria-label={`View source chunk for ${section.title}`}
                        >
                          <EyeIcon />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="extra-descriptions">
                <h3 className="extra-descriptions__title">Extra descriptions</h3>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => setShowAddDescriptionForm(true)}
                  aria-label="Add description"
                >
                  + Add description
                </button>
                {showAddDescriptionForm && (
                  <div className="add-description-form">
                    <label className="add-description-form__label">
                      Description
                      <textarea
                        className="add-description-form__textarea"
                        value={newDescriptionText}
                        onChange={(e) => setNewDescriptionText(e.target.value)}
                        placeholder="Enter description text"
                        rows={2}
                      />
                    </label>
                    <div className="add-description-form__actions">
                      <button type="button" className="btn btn--primary" onClick={addExtraDescriptionManual} disabled={!newDescriptionText.trim()}>
                        Add
                      </button>
                      <button type="button" className="btn btn--secondary" onClick={() => { setShowAddDescriptionForm(false); setNewDescriptionText(''); }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                <ul className="extra-descriptions-list">
                  {extraDescriptions.map((d) => {
                    const status = extraDescriptionStatus[d.id]
                    const excerpt = d.sourceExcerpt ?? d.text
                    const sourceLabel = d.sourceExcerpt ? 'From document selection' : 'Entered manually'
                    return (
                      <li key={d.id} className={`extra-description-item ${status ? `extra-description-item--${status}` : ''}`}>
                        <p className="extra-description-item__text">{d.text}</p>
                        <div className="extra-description-item__actions">
                          <button type="button" className="pathology-item__btn pathology-item__btn--accept" onClick={() => acceptExtraDescription(d.id)} title="Accept">Accept</button>
                          <button type="button" className="pathology-item__btn pathology-item__btn--decline" onClick={() => declineExtraDescription(d.id)} title="Decline">Decline</button>
                          <button
                            type="button"
                            className="pathology-item__eye"
                            onClick={() => openDescriptionExcerpt({ title: 'Extra description', excerpt, sourceLabel })}
                            title="View source chunk"
                            aria-label="View source chunk"
                          >
                            <EyeIcon />
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
              <div className="workflow__result-actions">
                <button type="button" className="btn btn--primary" onClick={() => setCurrentStep(5)}>
                  Go to Score
                </button>
                <button type="button" className="btn btn--secondary" onClick={() => setCurrentStep(3)}>
                  Back to findings
                </button>
                <button type="button" className="btn btn--secondary" onClick={reset}>
                  Analyze another document
                </button>
              </div>
            </>
          )}

          {currentStep === 5 && (
            <>
              <div className="cliniq-content score-step__header">
                <div className="score-step__title-row">
                  <h2 className="cliniq-content__title">Score</h2>
                  <button
                    type="button"
                    className="score-step__context-btn"
                    onClick={openContextPane}
                    title="View context (pathologies and descriptions)"
                    aria-label="Open context pane"
                  >
                    <ContextIcon />
                    <span>Context</span>
                  </button>
                </div>
                <p className="cliniq-content__desc">Grade each basket from 0 to 4. If you change the prefilled score, add a motivation.</p>
              </div>
              <div className="score-baskets">
                {scoreBaskets.map((basket) => {
                  const changed = basket.score !== basket.prefilledScore
                  const needsMotivation = changed && !basket.motivation.trim()
                  return (
                    <div
                      key={basket.id}
                      className="score-basket"
                      style={{ ['--basket-bg']: scoreToBackground(basket.score) }}
                    >
                      <div className="score-basket__inner">
                        <h3 className="score-basket__label">{basket.label}</h3>
                        <div className="score-basket__grade">
                          <span className="score-basket__grade-label">Grade</span>
                          <input
                            type="range"
                            min={0}
                            max={4}
                            value={basket.score}
                            onChange={(e) => setBasketScore(basket.id, Number(e.target.value))}
                            className="score-basket__slider"
                          />
                          <span className="score-basket__grade-value">{basket.score}</span>
                        </div>
                        {changed && (
                          <label className="score-basket__motivation-wrap">
                            <span className="score-basket__motivation-label">Motivation for change {needsMotivation && '(required)'}</span>
                            <textarea
                              className="score-basket__motivation"
                              value={basket.motivation}
                              onChange={(e) => setBasketMotivation(basket.id, e.target.value)}
                              placeholder="Explain why you changed the score..."
                              rows={2}
                            />
                          </label>
                        )}
                        <p className="score-basket__llm">{basket.llmMotivation}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="workflow__result-actions">
                <button type="button" className="btn btn--primary" onClick={() => setCurrentStep(6)}>
                  View report
                </button>
                <button type="button" className="btn btn--secondary" onClick={() => setCurrentStep(4)}>
                  Back to Enrich
                </button>
              </div>
            </>
          )}

          {currentStep === 6 && (
            <div className="cliniq-content report-step">
              <h2 className="cliniq-results-header__title">Report</h2>
              <p className="cliniq-results-header__sub">Summary of the analysis. Original document attached.</p>
              <div className="report-summary">
                <section className="report-section">
                  <h3 className="report-section__title">Document</h3>
                  <p className="report-section__text">{extractionResult?.filename || file?.name || '—'}</p>
                </section>
                <section className="report-section">
                  <h3 className="report-section__title">Pathologies</h3>
                  <ul className="report-list">
                    {pathologies.map((p) => (
                      <li key={p.id}>
                        <strong>{p.name}</strong>
                        <span className="report-list__status">{pathologyStatus[p.id] === 'accepted' ? 'Accepted' : pathologyStatus[p.id] === 'declined' ? 'Declined' : '—'}</span>
                        <p className="report-list__desc">{p.description}</p>
                      </li>
                    ))}
                  </ul>
                </section>
                <section className="report-section">
                  <h3 className="report-section__title">Enrichment</h3>
                  <p className="report-section__text">Sections and extra descriptions from the document.</p>
                  <ul className="report-list">
                    {ENRICH_SECTIONS.map((s) => (
                      <li key={s.id}><strong>{s.title}</strong> — {s.text}</li>
                    ))}
                    {extraDescriptions.map((d) => (
                      <li key={d.id}>{d.text}</li>
                    ))}
                  </ul>
                </section>
                <section className="report-section">
                  <h3 className="report-section__title">Scores</h3>
                  <ul className="report-list report-list--scores">
                    {scoreBaskets.map((b) => {
                      const reason = b.motivation?.trim() ? b.motivation : b.llmMotivation
                      return (
                        <li key={b.id}>
                          <span>{b.label}</span>
                          <span className="report-list__grade">Grade: {b.score}</span>
                          {reason && <span className="report-list__motivation">— {reason}</span>}
                        </li>
                      )
                    })}
                  </ul>
                </section>
                <section className="report-section">
                  <h3 className="report-section__title">Attachment</h3>
                  <div className="report-attachment">
                    <p className="report-section__text">Original document: {extractionResult?.filename || file?.name || '—'}</p>
                    <button
                      type="button"
                      className="report-attachment__view-btn"
                      onClick={() => openDocumentView('results')}
                      title="View original document"
                      aria-label="View original document"
                    >
                      <DocumentIcon />
                      <span>View document</span>
                    </button>
                  </div>
                </section>
              </div>
              <div className="report-actions">
                <button type="button" className="btn btn--primary" onClick={() => {}}>
                  Download as PDF
                </button>
                <button type="button" className="btn btn--secondary" onClick={() => {}}>
                  Mail
                </button>
                <button type="button" className="btn btn--secondary" onClick={() => setCurrentStep(5)}>
                  Back to Score
                </button>
              </div>
            </div>
          )}
        </div>

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

      {(sideViewMode === 'description' && sideViewDescription) && (
        <div className="side-view-overlay" onClick={closeSideView} aria-hidden="false">
          <aside
            className="side-view"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="side-view-desc-title"
            aria-modal="true"
          >
            <div className="side-view__header">
              <h2 id="side-view-desc-title" className="side-view__title">{sideViewDescription.title}</h2>
              <button type="button" className="side-view__close" onClick={closeSideView} aria-label="Close">×</button>
            </div>
            <div className="side-view__meta">
              {extractionResult?.filename && (
                <span className="side-view__meta-item">
                  <span className="side-view__meta-label">Document</span>
                  <span className="side-view__meta-value">{extractionResult.filename}</span>
                </span>
              )}
              {sideViewDescription.sourceLabel && (
                <span className="side-view__meta-item">
                  <span className="side-view__meta-label">Source</span>
                  <span className="side-view__meta-value">{sideViewDescription.sourceLabel}</span>
                </span>
              )}
            </div>
            <div className="side-view__content">
              <pre className="side-view__excerpt">{sideViewDescription.excerpt}</pre>
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
            <p className="side-view__hint">
              {documentViewContext === 'enrich'
                ? 'Select text in the document below to add it as an extra description.'
                : 'Select text in the document below, then choose whether it is the name or description of a pathology and fill in the other field to add it.'}
            </p>
            <div
              className="side-view__document-content"
              onMouseUp={documentViewContext === 'enrich' ? handleDocumentSelectionEnrich : handleDocumentSelection}
              onTouchEnd={documentViewContext === 'enrich' ? handleDocumentSelectionEnrich : handleDocumentSelection}
            >
              {MOCK_SOURCE_DOCUMENT}
            </div>
            {addFromSelection && documentViewContext === 'enrich' && (
              <div className="add-from-selection">
                <h3 className="add-from-selection__title">Add as extra description</h3>
                <p className="add-from-selection__preview">Selected: "{addFromSelection.selectedText.slice(0, 80)}{addFromSelection.selectedText.length > 80 ? '…' : ''}"</p>
                <div className="add-from-selection__actions">
                  <button type="button" className="btn btn--primary" onClick={addExtraDescriptionFromSelection}>
                    Add as description
                  </button>
                  <button type="button" className="btn btn--secondary" onClick={cancelAddFromSelection}>Cancel</button>
                </div>
              </div>
            )}
            {addFromSelection && documentViewContext === 'results' && (
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

      {contextPaneOpen && (
        <div className="side-view-overlay" onClick={closeContextPane} aria-hidden="false">
          <aside
            className="side-view side-view--context"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="context-pane-title"
            aria-modal="true"
          >
            <div className="side-view__header">
              <h2 id="context-pane-title" className="side-view__title">Context for grading</h2>
              <button type="button" className="side-view__close" onClick={closeContextPane} aria-label="Close">×</button>
            </div>
            <div className="side-view__content context-pane__content">
              <h3 className="context-pane__section-title">Pathologies</h3>
              <ul className="context-pane__list">
                {pathologies.map((p) => (
                  <li key={p.id} className="context-pane__item">
                    <strong>{p.name}</strong>
                    <p className="context-pane__desc">{p.description}</p>
                  </li>
                ))}
              </ul>
              <h3 className="context-pane__section-title">Descriptions (from previous steps)</h3>
              <ul className="context-pane__list">
                {ENRICH_SECTIONS.map((s) => (
                  <li key={s.id} className="context-pane__item">
                    <strong>{s.title}</strong>
                    <p className="context-pane__desc">{s.text}</p>
                  </li>
                ))}
                {extraDescriptions.map((d) => (
                  <li key={d.id} className="context-pane__item">
                    <p className="context-pane__desc">{d.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}

function ContextIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  )
}

function HandwrittenImagePlaceholder({ text }) {
  return (
    <div className="handwritten-placeholder">
      <svg className="handwritten-placeholder__bg" viewBox="0 0 280 80" preserveAspectRatio="none" aria-hidden="true">
        <rect width="100%" height="100%" fill="#f5f0e6" stroke="#c4b8a8" strokeWidth="1" rx="2" />
        <line x1="12" y1="24" x2="268" y2="24" stroke="#d4c8b8" strokeWidth="0.5" strokeDasharray="2 2" />
        <line x1="12" y1="40" x2="268" y2="40" stroke="#d4c8b8" strokeWidth="0.5" strokeDasharray="2 2" />
        <line x1="12" y1="56" x2="200" y2="56" stroke="#d4c8b8" strokeWidth="0.5" strokeDasharray="2 2" />
      </svg>
      <span className="handwritten-placeholder__text">{text}</span>
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
