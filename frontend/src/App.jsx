import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './Layout'
import DoclingPage from './pages/DoclingPage'
import MedicalAnalysisPage from './pages/MedicalAnalysisPage'
import DocumentInspectorPage from './pages/DocumentInspectorPage'
import ArtistDataPage from './pages/ArtistDataPage'
import AdminPage from './pages/AdminPage'
import AuditPage from './pages/AuditPage'
import './App.css'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<DoclingPage />} />
          <Route path="medical-analysis" element={<MedicalAnalysisPage />} />
          <Route path="document-inspector" element={<DocumentInspectorPage />} />
          <Route path="artist-data" element={<ArtistDataPage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="audit" element={<AuditPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
