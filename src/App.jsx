import React, { useState } from 'react'
import ModernPeltierDashboard from './components/ModernPeltierDashboard'
import SettingsPage from './components/SettingsPage'

function App() {
  const [currentPage, setCurrentPage] = useState('monitor')

  const renderPage = () => {
    switch (currentPage) {
      case 'settings':
        return <SettingsPage onBack={() => setCurrentPage('monitor')} />
      case 'monitor':
      default:
        return <ModernPeltierDashboard onOpenSettings={() => setCurrentPage('settings')} />
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {renderPage()}
    </div>
  )
}

export default App