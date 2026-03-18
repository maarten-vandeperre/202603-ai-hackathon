import { useState, useMemo } from 'react'
import '../App.css'

// Mock audit data per user (in a real app this would come from an API)
const MOCK_USERS = [
  { id: 'alice', name: 'Alice', email: 'alice@example.com' },
  { id: 'bob', name: 'Bob', email: 'bob@example.com' },
  { id: 'charlie', name: 'Charlie', email: 'charlie@example.com' }
]

// Mock audit: model characteristics reflected in usage
// - qwen3.5:9b (Alice): many declines and edits (users correct often)
// - qwen3.5:27B (Bob): some declines/edits, but not a lot (decent quality)
// - mistral-small3.1:24b (Charlie): almost no declines or edits (high quality)
const MOCK_AUDIT = {
  alice: {
    model: 'qwen3.5:9b',
    cliniq: { accepts: 22, declines: 14 },
    documentInspector: { documentsIndexed: 12, similarityQueries: 48, ragAsks: 7 },
    artistData: { extractions: 8, overrides: 19, additions: 7, persists: 5 }
  },
  bob: {
    model: 'qwen3.5:27B',
    cliniq: { accepts: 89, declines: 4 },
    documentInspector: { documentsIndexed: 34, similarityQueries: 120, ragAsks: 22 },
    artistData: { extractions: 18, overrides: 3, additions: 2, persists: 15 }
  },
  charlie: {
    model: 'mistral-small3.1:24b',
    cliniq: { accepts: 41, declines: 1 },
    documentInspector: { documentsIndexed: 18, similarityQueries: 62, ragAsks: 11 },
    artistData: { extractions: 12, overrides: 0, additions: 0, persists: 10 }
  }
}

// Fallback when no model is set
const DEFAULT_MODEL = 'qwen3.5:9b'

function aggregateByUser(userIds, audit) {
  if (userIds.length === 0) {
    return {
      model: '—',
      cliniq: { accepts: 0, declines: 0 },
      documentInspector: { documentsIndexed: 0, similarityQueries: 0, ragAsks: 0 },
      artistData: { extractions: 0, overrides: 0, additions: 0, persists: 0 }
    }
  }
  const models = [...new Set(userIds.map((id) => audit[id]?.model).filter(Boolean))]
  const agg = {
    model: models.length <= 1 ? (models[0] || DEFAULT_MODEL) : `Multiple (${models.join(', ')})`,
    cliniq: { accepts: 0, declines: 0 },
    documentInspector: { documentsIndexed: 0, similarityQueries: 0, ragAsks: 0 },
    artistData: { extractions: 0, overrides: 0, additions: 0, persists: 0 }
  }
  userIds.forEach((id) => {
    const u = audit[id]
    if (!u) return
    agg.cliniq.accepts += u.cliniq?.accepts ?? 0
    agg.cliniq.declines += u.cliniq?.declines ?? 0
    agg.documentInspector.documentsIndexed += u.documentInspector?.documentsIndexed ?? 0
    agg.documentInspector.similarityQueries += u.documentInspector?.similarityQueries ?? 0
    agg.documentInspector.ragAsks += u.documentInspector?.ragAsks ?? 0
    agg.artistData.extractions += u.artistData?.extractions ?? 0
    agg.artistData.overrides += u.artistData?.overrides ?? 0
    agg.artistData.additions += u.artistData?.additions ?? 0
    agg.artistData.persists += u.artistData?.persists ?? 0
  })
  return agg
}

/** Aggregate audit stats per model: { modelName: { users: [...], cliniq, documentInspector, artistData } } */
function aggregateByModel(users, audit) {
  const byModel = {}
  users.forEach((u) => {
    const model = audit[u.id]?.model || 'Unknown'
    if (!byModel[model]) {
      byModel[model] = {
        users: [],
        cliniq: { accepts: 0, declines: 0 },
        documentInspector: { documentsIndexed: 0, similarityQueries: 0, ragAsks: 0 },
        artistData: { extractions: 0, overrides: 0, additions: 0, persists: 0 }
      }
    }
    byModel[model].users.push(u.name)
    const d = audit[u.id]
    if (!d) return
    byModel[model].cliniq.accepts += d.cliniq?.accepts ?? 0
    byModel[model].cliniq.declines += d.cliniq?.declines ?? 0
    byModel[model].documentInspector.documentsIndexed += d.documentInspector?.documentsIndexed ?? 0
    byModel[model].documentInspector.similarityQueries += d.documentInspector?.similarityQueries ?? 0
    byModel[model].documentInspector.ragAsks += d.documentInspector?.ragAsks ?? 0
    byModel[model].artistData.extractions += d.artistData?.extractions ?? 0
    byModel[model].artistData.overrides += d.artistData?.overrides ?? 0
    byModel[model].artistData.additions += d.artistData?.additions ?? 0
    byModel[model].artistData.persists += d.artistData?.persists ?? 0
  })
  return byModel
}

function computeInsights(selectedUser, agg, audit) {
  const lines = []
  const data = selectedUser && audit[selectedUser] ? audit[selectedUser] : agg
  const isSingleUser = !!selectedUser

  const totalCliniq = (data.cliniq?.accepts ?? 0) + (data.cliniq?.declines ?? 0)
  const totalArtist = (data.artistData?.extractions ?? 0) + (data.artistData?.overrides ?? 0) + (data.artistData?.additions ?? 0)
  const model = data.model || DEFAULT_MODEL
  const isLargeModel = /27b|24b|70b/i.test(model)
  const isSmallModel = /9b|7b|3b/i.test(model)

  if (isSingleUser) {
    if (isLargeModel && totalCliniq + totalArtist < 30) {
      lines.push({ type: 'info', text: `Low usage (${totalCliniq + totalArtist} actions) with large model (${model}). Consider a smaller model to reduce cost.` })
    }
    if (isSmallModel && (data.artistData?.overrides ?? 0) > 15) {
      lines.push({ type: 'warning', text: `Many overrides in Artist Data (${data.artistData.overrides}). A larger or more accurate model may reduce manual corrections.` })
    }
    if ((data.artistData?.overrides ?? 0) > (data.artistData?.extractions ?? 0) && (data.artistData?.extractions ?? 0) > 0) {
      lines.push({ type: 'warning', text: `Override rate is high compared to extractions. Review extraction prompts or model choice.` })
    }
    if (totalCliniq + totalArtist > 100 && isSmallModel) {
      lines.push({ type: 'info', text: `High volume with smaller model (${model}). If quality is sufficient, this is cost-effective.` })
    }
  } else {
    if (agg.model.toString().startsWith('Multiple')) {
      lines.push({ type: 'info', text: 'Users are on different models. Use "Aggregate by user" to see per-user recommendations.' })
    }
  }

  if (lines.length === 0) {
    lines.push({ type: 'muted', text: 'No specific insights for this selection.' })
  }
  return lines
}

export default function AuditPage() {
  const [selectedUser, setSelectedUser] = useState('') // '' = all users

  const userIds = useMemo(() => {
    if (!selectedUser) return MOCK_USERS.map((u) => u.id)
    return [selectedUser]
  }, [selectedUser])

  const aggregated = useMemo(() => aggregateByUser(userIds, MOCK_AUDIT), [userIds])
  const byModel = useMemo(() => aggregateByModel(MOCK_USERS, MOCK_AUDIT), [])
  const insights = useMemo(() => computeInsights(selectedUser, aggregated, MOCK_AUDIT), [selectedUser, aggregated])

  return (
    <div className="app app--page audit-page cliniq">
      <header className="cliniq__header">
        <h1 className="cliniq__logo">Audit</h1>
        <p className="cliniq__tagline">Usage per module and per user. See which model is used and how it matches usage (mocked data).</p>
      </header>

      <section className="audit-controls cliniq-card">
        <label className="audit-controls__label">
          Aggregate by user
          <select
            className="audit-controls__select"
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
          >
            <option value="">All users</option>
            {MOCK_USERS.map((u) => (
              <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
            ))}
          </select>
        </label>
      </section>

      <section className="audit-summary cliniq-card">
        <h2 className="audit-section__title">Model in use</h2>
        <p className="audit-model">{aggregated.model}</p>
      </section>

      <section className="audit-modules">
        <h2 className="audit-section__title">Usage by module</h2>
        <div className="audit-modules__grid">
        <div className="audit-card cliniq-card">
          <h3 className="audit-card__title">Medical Reports</h3>
          <dl className="audit-card__list">
            <dt>Accepts</dt>
            <dd>{aggregated.cliniq.accepts}</dd>
            <dt>Declines</dt>
            <dd>{aggregated.cliniq.declines}</dd>
          </dl>
        </div>

        <div className="audit-card cliniq-card">
          <h3 className="audit-card__title">Document Inspector</h3>
          <dl className="audit-card__list">
            <dt>Documents indexed</dt>
            <dd>{aggregated.documentInspector.documentsIndexed}</dd>
            <dt>Similarity queries</dt>
            <dd>{aggregated.documentInspector.similarityQueries}</dd>
            <dt>RAG asks</dt>
            <dd>{aggregated.documentInspector.ragAsks}</dd>
          </dl>
        </div>

        <div className="audit-card cliniq-card">
          <h3 className="audit-card__title">Artist Data</h3>
          <dl className="audit-card__list">
            <dt>Extractions run</dt>
            <dd>{aggregated.artistData.extractions}</dd>
            <dt>Overrides (edits)</dt>
            <dd>{aggregated.artistData.overrides}</dd>
            <dt>Additions (add row)</dt>
            <dd>{aggregated.artistData.additions}</dd>
            <dt>Persists</dt>
            <dd>{aggregated.artistData.persists}</dd>
          </dl>
        </div>
        </div>
      </section>

      <section className="audit-by-model">
        <h2 className="audit-section__title">Statistics per model</h2>
        <p className="audit-by-model__hint">Aggregated usage for each model across all users.</p>
        <div className="audit-by-model__grid">
          {Object.entries(byModel).map(([modelName, data]) => (
            <div key={modelName} className="audit-model-card cliniq-card">
              <h3 className="audit-model-card__title">{modelName}</h3>
              <p className="audit-model-card__users">Users: {data.users.join(', ')}</p>
              <dl className="audit-card__list">
                <dt>Medical Reports accepts</dt>
                <dd>{data.cliniq.accepts}</dd>
                <dt>Medical Reports declines</dt>
                <dd>{data.cliniq.declines}</dd>
                <dt>Doc. Inspector indexed</dt>
                <dd>{data.documentInspector.documentsIndexed}</dd>
                <dt>Similarity queries</dt>
                <dd>{data.documentInspector.similarityQueries}</dd>
                <dt>RAG asks</dt>
                <dd>{data.documentInspector.ragAsks}</dd>
                <dt>Artist Data extractions</dt>
                <dd>{data.artistData.extractions}</dd>
                <dt>Artist Data overrides</dt>
                <dd>{data.artistData.overrides}</dd>
                <dt>Artist Data additions</dt>
                <dd>{data.artistData.additions}</dd>
                <dt>Persists</dt>
                <dd>{data.artistData.persists}</dd>
              </dl>
            </div>
          ))}
        </div>
      </section>

      <section className="audit-insights cliniq-card">
        <h2 className="audit-section__title">Insights</h2>
        <p className="audit-insights__hint">Suggestions based on model choice vs. volume and override rates (mocked).</p>
        <ul className="audit-insights__list">
          {insights.map((item, i) => (
            <li key={i} className={`audit-insights__item audit-insights__item--${item.type}`}>
              {item.text}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
