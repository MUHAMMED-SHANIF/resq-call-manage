import React, { useState, useEffect } from 'react';
import { Check, AlertTriangle, Layers, QrCode } from 'lucide-react';
import Dropzone from './components/Dropzone';
import CardGrid from './components/CardGrid';
import FilterBar from './components/FilterBar';
import PlaceFilter from './components/PlaceFilter';
import SettingsModal from './components/SettingsModal';
import NavBar from './components/NavBar';
import HistoryPage from './components/HistoryPage';
import DuplicateHistoryModal from './components/DuplicateHistoryModal';
import { extractSheetData, parseExcelWorkbook } from './utils/excelParser';
import { DEFAULT_SITE, DEFAULT_STATUSES, DEFAULT_SHEET, getGroupsForPincodeDynamic } from './config';

export default function App() {
  // Navigation Routing State
  const [currentView, setCurrentView] = useState('pending'); // 'pending' | 'approved' | 'rejected'

  // Settings configurations
  const [siteFilter, setSiteFilter] = useState(() => localStorage.getItem('cc_site_filter') || DEFAULT_SITE);
  const [statusFilters, setStatusFilters] = useState(() => {
    const saved = localStorage.getItem('cc_status_filters');
    return saved ? JSON.parse(saved) : DEFAULT_STATUSES;
  });
  const [sheetName, setSheetName] = useState(() => localStorage.getItem('cc_sheet_name') || DEFAULT_SHEET);
  // Dynamic places and pincodes routing config
  const [placesConfig, setPlacesConfig] = useState(() => {
    const saved = localStorage.getItem('cc_places_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing cc_places_config, using default:', e);
      }
    }
    return [
      { name: 'Manjeri', pincodes: ['676121', '676122', '676123', '676509', '676506', '676507', '676514', '676517', '676519'] },
      { name: 'Kondotty', pincodes: ['673632', '673634', '673636', '673637', '673638', '673647'] },
      { name: 'Wandoor', pincodes: ['679327', '679328', '679329', '679330', '679331', '679332', '679333', '679334', '679339', '679342', '679344', '679355'] },
      { name: 'Areekode', pincodes: ['673639', '673640', '673641', '673642', '673644'] },
      { name: 'Malappuram', pincodes: ['676504', '676505', '676506', '676507', '676509', '676514', '676517', '676519', '676521', '676528', '676541'] },
      { name: 'transfer', pincodes: ['671319'] }
    ];
  });

  // File loading states
  const [fileName, setFileName] = useState(() => localStorage.getItem('cc_active_file_name') || '');
  const [sheetNames, setSheetNames] = useState([]);
  const [workbook, setWorkbook] = useState(null);

  // SQLite data states
  const [pendingCalls, setPendingCalls] = useState([]);
  const [showDropzone, setShowDropzone] = useState(false);

  // Filter & Search states
  const [activePlaceTab, setActivePlaceTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [cardStatusFilter, setCardStatusFilter] = useState('all'); // 'all' | 'pending' | 'approved' | 'rejected'

  // Modal Overlays toggle states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [duplicateCheckNumber, setDuplicateCheckNumber] = useState('');
  const [duplicateCheckCardId, setDuplicateCheckCardId] = useState(null);

  // SQLite error state
  const [dbError, setDbError] = useState(null);

  // UI state
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [toasts, setToasts] = useState([]);

  // ----------------------------------------------------
  // Sync Data on Mount & IPC Hook Setup
  // ----------------------------------------------------
  useEffect(() => {
    if (!window.api) {
      console.warn('[Vite Browser] window.api is not defined. SQLite persistence is disabled. Mock fallback activated.');
      return;
    }

    // Check Database health
    window.api.getDbStatus().then(({ initialized, error }) => {
      if (error) {
        setDbError(error);
      } else {
        loadPendingCalls();
      }
    });
  }, []);

  // Sync Dropzone visibility based on pending database calls count
  useEffect(() => {
    if (pendingCalls.length === 0) {
      setShowDropzone(true);
    } else {
      setShowDropzone(false);
    }
  }, [pendingCalls]);

  // Load pending records from database
  const loadPendingCalls = (currentPlaces = placesConfig) => {
    if (!window.api) return;
    window.api.getPendingCalls()
      .then(data => {
        const calls = (data || []).map(call => {
          // Re-evaluate place groups dynamically using the latest placesConfig
          const dynamicGroups = getGroupsForPincodeDynamic(call.pincode, currentPlaces);
          return {
            ...call,
            groups: dynamicGroups
          };
        });
        setPendingCalls(calls);
      })
      .catch(err => {
        console.error('Error loading pending calls from DB:', err);
      });
  };



  // Toast notifier helper
  const addToast = (message, isError = false) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, isError }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  // ----------------------------------------------------
  // Excel File Parsing & Database Import
  // ----------------------------------------------------
  const handleFileLoaded = (arrayBuffer, name) => {
    setErrorMessage(null);
    setIsProcessing(true);

    setTimeout(async () => {
      try {
        const wb = parseExcelWorkbook(arrayBuffer);
        setWorkbook(wb);
        setSheetNames(wb.SheetNames);
        setFileName(name);
        localStorage.setItem('cc_active_file_name', name);

        let targetSheet = sheetName;
        if (!wb.SheetNames.includes(targetSheet)) {
          targetSheet = wb.SheetNames.includes(DEFAULT_SHEET) ? DEFAULT_SHEET : wb.SheetNames[0];
          setSheetName(targetSheet);
        }

        const { filteredRows } = extractSheetData(
          wb,
          targetSheet,
          siteFilter,
          statusFilters,
          placesConfig
        );

        if (filteredRows.length === 0) {
          addToast('No Excel rows matched target Site and User Statuses.', true);
        } else {
          if (window.api) {
            // Store directly into SQLite database
            await window.api.importCalls(filteredRows);
            addToast(`Imported ${filteredRows.length} calls successfully!`);
            loadPendingCalls();
          } else {
            // Web Browser mock data fallback
            setPendingCalls(filteredRows.map((r, i) => ({
              ...r,
              id: i + 1,
              notes: '',
              phoneNumbers: '',
              isDuplicate: false,
              whatsappStatus: 'not_sent'
            })));
            addToast(`[Mock] Loaded ${filteredRows.length} calls in browser.`);
          }
          setShowDropzone(false);
        }
      } catch (err) {
        console.error('[FileLoad Error]', err);
        setErrorMessage(`Failed to read Excel file: ${err.message || err}. Try saving the file as .xlsx format and re-upload.`);
      } finally {
        setIsProcessing(false);
      }
    }, 100);
  };

  // Show dropzone manually to import additional work orders
  const handleImportNewFile = () => {
    setShowDropzone(true);
  };

  // ----------------------------------------------------
  // Card Actions & SQLite Synced Updates
  // ----------------------------------------------------

  // Persists Remarks note updates to SQLite database
  const handleUpdateCardNote = (callId, noteText) => {
    setPendingCalls(prev => prev.map(c => c.id === callId ? { ...c, notes: noteText } : c));
    
    if (window.api) {
      const callObj = pendingCalls.find(c => c.id === callId);
      const phonesList = callObj ? (callObj.phoneNumbers ? callObj.phoneNumbers.split(', ') : ['']) : [''];
      window.api.updateCallData(callId, noteText, phonesList);
    }
  };

  // Persists phone lists to SQLite database (re-triggering duplicate calculations)
  const handleUpdateCardPhones = (callId, phonesList) => {
    setPendingCalls(prev => prev.map(c => c.id === callId ? { ...c, phoneNumbers: phonesList.join(', ') } : c));

    if (window.api) {
      const callObj = pendingCalls.find(c => c.id === callId);
      const noteText = callObj ? callObj.notes : '';
      window.api.updateCallData(callId, noteText, phonesList)
        .then(() => {
          loadPendingCalls(); // Refresh data to dynamically recalculate duplicate indicators
        })
        .catch(err => console.error('Error saving updated phones:', err));
    }
  };

  // Single card approval (marks as approved in DB) — requires phone number
  const handleApproveCall = async (callId) => {
    const call = pendingCalls.find(c => c.id === callId);
    if (!call) return;

    // Block approval if card has no phone number
    const phones = call.phoneNumbers ? call.phoneNumbers.split(', ').filter(p => p.trim() !== '') : [];
    if (phones.length === 0) {
      addToast(`Cannot approve Call #${call.serviceOrder} — no phone number.`, true);
      return;
    }

    const notes = call.notes || '';
    const dynamicGroups = getGroupsForPincodeDynamic(call.pincode, placesConfig);

    if (window.api) {
      try {
        await window.api.approveCall(callId, notes, phones, '', dynamicGroups.join(','));
        addToast(`Call #${call.serviceOrder} approved.`);
      } catch (err) {
        console.error(err);
        addToast(`Error: ${err.message}`, true);
      } finally {
        loadPendingCalls();
      }
    } else {
      // Mock approved sequence in web browser
      setTimeout(() => {
        setPendingCalls(prev => prev.filter(c => c.id !== callId));
        addToast(`[Mock] Approved card #${call.serviceOrder} successfully!`);
      }, 1000);
    }
  };

  // Batch approve all currently visible filtered cards that have phone numbers
  const handleApproveAll = async () => {
    const withPhone = finalFilteredPending.filter(call => {
      const phones = call.phoneNumbers ? call.phoneNumbers.split(', ').filter(p => p.trim() !== '') : [];
      return phones.length > 0;
    });
    const withoutPhone = finalFilteredPending.filter(call => {
      const phones = call.phoneNumbers ? call.phoneNumbers.split(', ').filter(p => p.trim() !== '') : [];
      return phones.length === 0;
    });

    if (withPhone.length === 0) {
      addToast('No calls with phone numbers to approve.', true);
      return;
    }

    const callIds = withPhone.map(c => c.id);

    if (window.api) {
      try {
        await window.api.batchApproveCalls(callIds);
        if (withoutPhone.length > 0) {
          addToast(`Approved ${withPhone.length} call(s). ${withoutPhone.length} skipped — no phone number.`, false);
        } else {
          addToast(`Approved all ${withPhone.length} call(s) successfully!`);
        }
      } catch (err) {
        console.error(err);
        addToast(`Batch approve failed: ${err.message}`, true);
      } finally {
        loadPendingCalls();
      }
    } else {
      // Mock batch approve in web browser
      setPendingCalls(prev => prev.filter(c => !callIds.includes(c.id)));
      addToast(`[Mock] Approved ${withPhone.length} call(s).`);
    }
  };


  // Single card reject (marks as rejected in DB)
  const handleRejectCall = async (callId) => {
    if (window.api) {
      try {
        await window.api.rejectCall(callId);
        addToast('Call rejected and moved to History.');
      } catch (err) {
        console.error('Error rejecting call:', err);
        addToast('Failed to reject call.', true);
      } finally {
        loadPendingCalls();
      }
    } else {
      // Mock reject sequence in web browser
      setPendingCalls(prev => prev.filter(c => c.id !== callId));
      addToast('[Mock] Card rejected.');
    }
  };

  // Save Settings Config
  const handleSaveSettings = (settings) => {
    setSiteFilter(settings.site);
    setStatusFilters(settings.statuses);
    setSheetName(settings.sheetName);
    setPlacesConfig(settings.places);

    localStorage.setItem('cc_site_filter', settings.site);
    localStorage.setItem('cc_status_filters', JSON.stringify(settings.statuses));
    localStorage.setItem('cc_sheet_name', settings.sheetName);
    localStorage.setItem('cc_places_config', JSON.stringify(settings.places));

    addToast('Settings saved successfully!');
    
    // Update all database entries to reflect the new dynamic place groupings
    if (window.api) {
      window.api.updateAllPlaceGroups(settings.places)
        .then(() => {
          loadPendingCalls(settings.places);
        })
        .catch(err => {
          console.error('Error updating DB place groups:', err);
          loadPendingCalls(settings.places);
        });
    } else {
      loadPendingCalls(settings.places);
    }
  };

  // ----------------------------------------------------
  // Local Filtering Logic (Pending Views)
  // ----------------------------------------------------

  // Counts based on place groups for active pending calls
  const placeCounts = {
    All: pendingCalls.length
  };
  placesConfig.forEach(place => {
    placeCounts[place.name] = 0;
  });
  if (placeCounts['transfer'] === undefined) {
    placeCounts['transfer'] = 0;
  }

  pendingCalls.forEach(call => {
    if (call.groups && call.groups.length > 0) {
      call.groups.forEach(g => {
        if (placeCounts[g] !== undefined) {
          placeCounts[g]++;
        } else {
          placeCounts['transfer']++;
        }
      });
    }
  });

  const finalFilteredPending = pendingCalls.filter(call => {
    // 0. Filter by card status tab
    if (cardStatusFilter !== 'all') {
      const callStatus = call.status || 'pending';
      if (callStatus !== cardStatusFilter) return false;
    }

    // 1. Filter by active place group dropdown option
    if (activePlaceTab !== 'All') {
      if (!call.groups || !call.groups.includes(activePlaceTab)) {
        return false;
      }
    }

    // 2. Filter by search input query
    const q = searchQuery.trim().toLowerCase();
    if (q === '') return true;

    return (
      String(call.serviceOrder).toLowerCase().includes(q) ||
      String(call.soldToParty).toLowerCase().includes(q) ||
      String(call.brandName).toLowerCase().includes(q) ||
      (call.notes && String(call.notes).toLowerCase().includes(q)) ||
      (call.phoneNumbers && String(call.phoneNumbers).toLowerCase().includes(q))
    );
  });

  // Counts per status tab for the badge numbers
  const statusCounts = {
    all: pendingCalls.length,
    pending: pendingCalls.filter(c => (c.status || 'pending') === 'pending').length,
    approved: pendingCalls.filter(c => c.status === 'approved').length,
    rejected: pendingCalls.filter(c => c.status === 'rejected').length,
  };

  // ----------------------------------------------------
  // Core Rendering Logic
  // ----------------------------------------------------

  // If native database loading failed, show native compilation repair instructions
  if (dbError) {
    return (
      <div className="app-container">
        <header className="app-header" style={{ padding: '0.75rem 2rem' }}>
          <div className="header-content" style={{ maxWidth: '100%' }}>
            <div className="app-logo">
              <QrCode size={24} />
              <span>Call Distribution Dashboard</span>
            </div>
          </div>
        </header>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', padding: '5rem 2rem', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
          <AlertTriangle size={56} style={{ color: 'var(--color-error)' }} />
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Native SQLite Module Compile Error
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              The application could not initialize the native database driver (<code>better-sqlite3</code>) because it is built for a different Node.js/Electron environment than your system.
            </p>
            <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1rem', marginTop: '1.5rem', textAlign: 'left', fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-primary)' }}>
              1. Install Visual Studio Build Tools (C++ Workload)<br />
              2. Open a terminal in the project directory<br />
              3. Run: <strong>npm run rebuild</strong><br />
              4. Relaunch the application
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
              Error logs: {dbError}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Loading/Processing XLSB parser screen
  if (isProcessing) {
    return (
      <div className="app-container">
        <header className="app-header" style={{ padding: '0.75rem 2rem' }}>
          <div className="header-content" style={{ maxWidth: '100%' }}>
            <div className="app-logo">
              <QrCode size={24} />
              <span>Call Distribution Dashboard</span>
            </div>
          </div>
        </header>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', padding: '5rem 2rem' }}>
          <div className="loading-spinner"></div>
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Processing Excel Database...
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Parsing workbook tables, normalising headings, and resolving duplicate lists.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      
      {/* Shared Navbar */}
      <NavBar 
        currentView={currentView}
        setCurrentView={setCurrentView}
        pendingCount={pendingCalls.length}
        onOpenSettings={() => setIsSettingsOpen(true)}
        activeFileName={fileName}
      />

      <main className="main-content">
        
        {/* Error Alert Box */}
        {errorMessage && (
          <div className="error-toast" style={{ margin: '0 0 1rem 0' }}>
            <AlertTriangle size={18} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* View Router Switches */}
        {currentView === 'pending' && (
          showDropzone ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <Dropzone 
                onFileLoaded={handleFileLoaded} 
                onError={setErrorMessage} 
                errorMessage={errorMessage} 
              />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              <FilterBar 
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                filteredCount={finalFilteredPending.length}
                totalCount={pendingCalls.length}
                siteFilter={siteFilter}
                statusFilters={statusFilters}
                onResetFile={handleImportNewFile}
                cardStatusFilter={cardStatusFilter}
                setCardStatusFilter={setCardStatusFilter}
                statusCounts={statusCounts}
              />

              <PlaceFilter 
                activeTab={activePlaceTab}
                setActiveTab={setActivePlaceTab}
                counts={placeCounts}
                placesList={placesConfig}
                visibleCardsCount={finalFilteredPending.length}
                onApproveAll={handleApproveAll}
              />

              <CardGrid 
                cards={finalFilteredPending} 
                onUpdateNote={handleUpdateCardNote}
                onUpdatePhones={handleUpdateCardPhones}
                onApprove={handleApproveCall}
                onReject={handleRejectCall}
                onShowDuplicateHistory={(num, cardId) => {
                  setDuplicateCheckNumber(num);
                  setDuplicateCheckCardId(cardId);
                  setIsHistoryModalOpen(true);
                }}
                onCopyToast={addToast}
              />
            </div>
          )
        )}

        {currentView === 'history' && <HistoryPage placesList={placesConfig} />}

      </main>

      {/* Modal overlays stack */}
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        siteFilter={siteFilter}
        statusFilters={statusFilters}
        sheetName={sheetName}
        sheetNames={sheetNames}
        placesConfig={placesConfig}
        onSave={handleSaveSettings}
      />

      <DuplicateHistoryModal 
        isOpen={isHistoryModalOpen}
        onClose={() => {
          setIsHistoryModalOpen(false);
          setDuplicateCheckNumber('');
          setDuplicateCheckCardId(null);
        }}
        normalizedNumber={duplicateCheckNumber}
        currentServiceOrder={duplicateCheckCardId ? pendingCalls.find(c => c.id === duplicateCheckCardId)?.serviceOrder : null}
        onApproveAnyway={duplicateCheckCardId ? () => handleApproveCall(duplicateCheckCardId) : null}
      />

      {/* Toast Notification Stack */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast ${toast.isError ? 'toast-error' : ''}`}>
            {toast.isError ? <AlertTriangle size={16} /> : <Check size={16} />}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

    </div>
  );
}
