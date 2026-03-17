import DoclingUpload from '../components/DoclingUpload'
import '../App.css'

export default function MedicalAnalysisPage() {
  return (
    <div className="app app--page">
      <header className="header">
        <h1>Medical Analysis</h1>
        <p>Upload medical documents (PDF, DOCX, images). Docling will extract text and structure.</p>
      </header>
      <DoclingUpload />
    </div>
  )
}
