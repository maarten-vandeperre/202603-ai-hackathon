import DoclingUpload from '../components/DoclingUpload'
import '../App.css'

export default function DoclingPage() {
  return (
    <div className="app app--page">
      <header className="header">
        <h1>Docling</h1>
        <p>Upload a PDF, DOCX, or image. Docling will extract text and structure.</p>
      </header>
      <DoclingUpload />
    </div>
  )
}
