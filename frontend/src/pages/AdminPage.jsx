import { useState } from 'react'
import '../App.css'

const ENABLED_MODULE_IDS = new Set(['cliniq', 'document-inspector', 'artist-data'])

const MODULES = [
  { id: 'cliniq', name: 'Medical Reports', enabled: true, description: 'Medical analysis and clinical insights. Upload medical documents, get structured summaries and smart hints. Supports PDFs, scans, and handwritten notes with automatic text extraction.' },
  { id: 'document-inspector', name: 'Document Inspector', enabled: true, description: 'Upload documents, parse with Docling, and store them in a vector database. Run similarity search and RAG (Ask) over your indexed content. Ideal for searching across contracts, reports, and knowledge bases.' },
  { id: 'artist-data', name: 'Artist Data', enabled: true, description: 'Extract artist names and pricing (per hour, per performance, flat, etc.) from documents. Chunk-based extraction with editable results and persistent storage. Supports PDF upload via Docling.' },
  { id: 'contract-analyzer', name: 'Contract Analyzer', enabled: false, description: 'Extract clauses, obligations, and key terms from contracts. Highlights dates, parties, and renewal conditions. Supports NDAs, MSAs, and SOWs.' },
  { id: 'invoice-scanner', name: 'Invoice Scanner', enabled: false, description: 'Parse invoices and match line items to purchase orders. Extract vendor, amounts, due dates, and tax. Export to CSV or your ERP.' },
  { id: 'compliance-checker', name: 'Compliance Checker', enabled: false, description: 'Check documents against configurable policy rules. Flag missing sections, forbidden wording, or format violations. Useful for RFPs and internal policies.' },
  { id: 'meeting-notes', name: 'Meeting Notes', enabled: false, description: 'Summarize meeting transcripts and extract action items, decisions, and owners. Integrate with calendar and task tools.' },
  { id: 'report-generator', name: 'Report Generator', enabled: false, description: 'Turn structured data into formatted reports (PDF/Word). Use templates and placeholders. Schedule recurring reports.' },
  { id: 'template-studio', name: 'Template Studio', enabled: false, description: 'Build and fill document templates with variables and conditional blocks. Version templates and track usage.' },
  { id: 'audit-trail', name: 'Audit Trail', enabled: false, description: 'Track changes, access, and exports across documents. Retention and compliance logs. Searchable by user, date, and action.' }
]

export default function AdminPage() {
  const [payment, setPayment] = useState({ card: '', expiry: '', cvc: '', name: '' })
  const [selectedModule, setSelectedModule] = useState(null)
  const [subscribed, setSubscribed] = useState(new Set()) // mock: extra "subscribed" IDs

  const handlePaymentSubmit = (e) => {
    e.preventDefault()
    // Mock: no real submission
    alert('Payment details saved (mock). No charge made.')
  }

  const toggleSubscribe = (id) => {
    if (ENABLED_MODULE_IDS.has(id)) return
    setSubscribed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const isActive = (m) => ENABLED_MODULE_IDS.has(m.id) || subscribed.has(m.id)

  return (
    <div className="app app--page admin-page cliniq">
      <header className="cliniq__header">
        <h1 className="cliniq__logo">Admin</h1>
        <p className="cliniq__tagline">Payment details and module subscriptions (mocked).</p>
      </header>

      <div className="admin-layout">
        <aside className="admin-info-pane cliniq-card">
          <h3 className="admin-info-pane__title">Module info</h3>
          {selectedModule ? (
            <div className="admin-info-pane__content">
              <h4 className="admin-info-pane__name">{selectedModule.name}</h4>
              <p className="admin-info-pane__desc">{selectedModule.description}</p>
            </div>
          ) : (
            <p className="admin-info-pane__empty">Click the info icon next to a module to see its description.</p>
          )}
        </aside>

        <div className="admin-main">
          <section className="admin-section cliniq-card">
            <h2 className="admin-section__title">Payment details</h2>
            <form className="admin-form" onSubmit={handlePaymentSubmit}>
              <label className="admin-form__label">
                Card number
                <input
                  type="text"
                  className="admin-form__input"
                  placeholder="4242 4242 4242 4242"
                  value={payment.card}
                  onChange={(e) => setPayment((p) => ({ ...p, card: e.target.value }))}
                />
              </label>
              <div className="admin-form__row">
                <label className="admin-form__label">
                  Expiry
                  <input
                    type="text"
                    className="admin-form__input"
                    placeholder="MM/YY"
                    value={payment.expiry}
                    onChange={(e) => setPayment((p) => ({ ...p, expiry: e.target.value }))}
                  />
                </label>
                <label className="admin-form__label">
                  CVC
                  <input
                    type="text"
                    className="admin-form__input"
                    placeholder="123"
                    value={payment.cvc}
                    onChange={(e) => setPayment((p) => ({ ...p, cvc: e.target.value }))}
                  />
                </label>
              </div>
              <label className="admin-form__label">
                Name on card
                <input
                  type="text"
                  className="admin-form__input"
                  placeholder="Name"
                  value={payment.name}
                  onChange={(e) => setPayment((p) => ({ ...p, name: e.target.value }))}
                />
              </label>
              <button type="submit" className="btn btn--primary">Save payment details (mock)</button>
            </form>
          </section>

          <section className="admin-section cliniq-card">
            <h2 className="admin-section__title">Modules</h2>
            <ul className="admin-modules">
              {MODULES.map((m) => (
                <li key={m.id} className={`admin-module ${isActive(m) ? 'admin-module--enabled' : ''}`}>
                  <div className="admin-module__info-icon" title="Info" onClick={() => setSelectedModule(m)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setSelectedModule(m)}>
                    ℹ️
                  </div>
                  <span className="admin-module__name">{m.name}</span>
                  {ENABLED_MODULE_IDS.has(m.id) ? (
                    <span className="admin-module__badge admin-module__badge--enabled">Enabled</span>
                  ) : (
                    <button
                      type="button"
                      className={`admin-module__subscribe ${subscribed.has(m.id) ? 'admin-module__subscribe--on' : ''}`}
                      onClick={() => toggleSubscribe(m.id)}
                    >
                      {subscribed.has(m.id) ? 'Subscribed (mock)' : 'Subscribe'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
