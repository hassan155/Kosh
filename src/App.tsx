import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import MeetingPage from './pages/MeetingPage'
import PdfToolsPage from './pages/PdfToolsPage'
import SettingsPage from './pages/SettingsPage'
import WarehousePage from './pages/WarehousePage'
import './lib/local-transcriber'
import OfflineSupport from './components/OfflineSupport'

export default function App() {
  return (
    <AppShell>
      <OfflineSupport />
      <Routes>
        <Route path="/" element={<WarehousePage />} />
        <Route path="/meetings/:id" element={<MeetingPage />} />
        <Route path="/pdf-tools" element={<PdfToolsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </AppShell>
  )
}