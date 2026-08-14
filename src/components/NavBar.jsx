import React from 'react';
import { FileSpreadsheet, ClipboardList, History, Settings } from 'lucide-react';

export default function NavBar({ 
  currentView, 
  setCurrentView, 
  pendingCount, 
  onOpenSettings,
  activeFileName
}) {
  return (
    <header className="app-header" style={{ padding: '0.75rem 2rem' }}>
      <div className="header-content" style={{ maxWidth: '100%', gap: '2rem' }}>
        
        {/* Logo and Brand */}
        <div className="app-logo" style={{ cursor: 'pointer' }} onClick={() => setCurrentView('pending')}>
          <FileSpreadsheet size={24} />
          <span style={{ letterSpacing: '-0.025em' }}>Call Distribution</span>
        </div>

        {/* View Switcher Tabs */}
        <nav style={{ display: 'flex', gap: '0.5rem', flexGrow: 1 }}>
          <button
            type="button"
            className={`btn ${currentView === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setCurrentView('pending')}
            style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', gap: '0.4rem' }}
          >
            <ClipboardList size={15} />
            <span>Pending Grid</span>
            {pendingCount > 0 && (
              <span className="tab-count" style={{ 
                backgroundColor: currentView === 'pending' ? '#ffffff' : 'var(--color-accent)', 
                color: currentView === 'pending' ? 'var(--color-accent)' : '#ffffff',
                marginLeft: '0.25rem'
              }}>
                {pendingCount}
              </span>
            )}
          </button>

          <button
            type="button"
            className={`btn ${currentView === 'history' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setCurrentView('history')}
            style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', gap: '0.4rem' }}
          >
            <History size={15} />
            <span>History</span>
          </button>
        </nav>

        {/* Right side items: File name & Settings button */}
        <div className="header-actions" style={{ gap: '1.25rem' }}>
          
          {activeFileName && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500, borderRight: '1px solid var(--border-color)', paddingRight: '1.25rem', display: 'none' }}>
              File: <strong style={{ color: 'var(--text-primary)' }}>{activeFileName}</strong>
            </div>
          )}

          {/* Settings Button */}
          <button
            type="button"
            onClick={onOpenSettings}
            className="btn btn-secondary"
            style={{ 
              fontSize: '0.75rem', 
              padding: '0.4rem 0.875rem', 
              gap: '0.4rem', 
              borderRadius: '9999px',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <Settings size={13} />
            <span style={{ fontWeight: 700 }}>Settings</span>
          </button>

        </div>
      </div>
    </header>
  );
}
