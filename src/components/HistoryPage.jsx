import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Download, Search, Calendar, Filter, FileText, Trash2 } from 'lucide-react';

export default function HistoryPage({ placesList = [] }) {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [noApi, setNoApi] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlace, setSelectedPlace] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedOrderType, setSelectedOrderType] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Row-level delete confirmation state (stores the id of the row awaiting confirm)
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  // Dropdown lists
  const [orderTypes, setOrderTypes] = useState([]);

  // Fetch unified history calls
  const fetchHistoryCalls = () => {
    setLoading(true);
    setFetchError(null);
    if (!window.api) {
      console.warn('[HistoryPage] window.api is undefined — running in browser-only mode.');
      setNoApi(true);
      setCalls([]);
      setLoading(false);
      return;
    }
    setNoApi(false);
    window.api.getHistoryCalls()
      .then(data => {
        const callsData = data || [];
        setCalls(callsData);
        
        // Extract distinct order types for filters
        const oSet = new Set();
        callsData.forEach(item => {
          if (item.order_type) oSet.add(item.order_type);
        });
        setOrderTypes(Array.from(oSet).sort());
      })
      .catch(err => {
        console.error('Error fetching history calls:', err);
        setFetchError(err.message || 'Unknown error');
        setCalls([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchHistoryCalls();
  }, []);

  const handleDeleteCall = async (callId) => {
    if (!window.api) return;
    setDeleteError(null);
    try {
      await window.api.deleteHistoryCall(callId);
      setPendingDeleteId(null);
      fetchHistoryCalls();
    } catch (err) {
      setDeleteError(`Failed to delete: ${err.message || err}`);
      setPendingDeleteId(null);
    }
  };

  // Filter logic
  const filteredCalls = calls.filter(item => {
    // 1. Text Search (Request ID, Sold to Party, Notes, Phone Numbers)
    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      const matchText = 
        (item.request_id || '').toLowerCase().includes(q) ||
        (item.sold_to_party || '').toLowerCase().includes(q) ||
        (item.notes || '').toLowerCase().includes(q) ||
        (item.phone_numbers || '').toLowerCase().includes(q);
      
      if (!matchText) return false;
    }

    // 2. Filter by Place Group
    if (selectedPlace !== 'All') {
      const groups = item.place_group ? item.place_group.split(',') : [];
      if (!groups.includes(selectedPlace)) return false;
    }

    // 3. Filter by Status (Approved vs Rejected)
    if (selectedStatus !== 'All' && item.status !== selectedStatus) {
      return false;
    }

    // 4. Filter by Order Type
    if (selectedOrderType !== 'All' && item.order_type !== selectedOrderType) {
      return false;
    }

    // 5. Date Range Filter (checks approved_date or rejected_date depending on status)
    const actionDateStr = item.status === 'approved' ? item.approved_date : item.rejected_date;
    if (actionDateStr) {
      const actionDate = new Date(actionDateStr).setHours(0,0,0,0);
      if (startDate) {
        const start = new Date(startDate).setHours(0,0,0,0);
        if (actionDate < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate).setHours(23,59,59,999);
        if (actionDate > end) return false;
      }
    } else {
      if (startDate || endDate) return false;
    }

    return true;
  });

  // Export to Excel handler
  const handleExportExcel = () => {
    if (filteredCalls.length === 0) return;

    // Prepare rows for Excel
    const rows = filteredCalls.map((r, index) => {
      const actionDate = r.status === 'approved' ? r.approved_date : r.rejected_date;
      return {
        'SL No': index + 1,
        'Request ID': r.request_id || '—',
        'Status': r.status ? r.status.toUpperCase() : '—',
        'Order Type': r.order_type || '—',
        'Sold to Party': r.sold_to_party || '—',
        'Product Description': r.product_description || '—',
        'Pincode': r.pincode || '—',
        'Place Group': r.place_group || '—',
        'Phone Numbers': r.phone_numbers || '—',
        'Remarks/Notes': r.notes || '—',
        'Start Date': r.request_start || '—',
        'Action Date': actionDate ? new Date(actionDate).toLocaleString('en-IN') : '—'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Call Distribution History');

    // Adjust column widths automatically
    const maxLens = {};
    rows.forEach(row => {
      Object.keys(row).forEach(key => {
        const val = String(row[key]);
        maxLens[key] = Math.max(maxLens[key] || 10, val.length);
      });
    });
    worksheet['!cols'] = Object.keys(maxLens).map(key => ({ wch: maxLens[key] + 3 }));

    // Generate output file name with date stamp
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `call_distribution_history_${dateStr}.xlsx`;

    XLSX.writeFile(workbook, filename);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Top Filter and Actions Bar */}
      <div className="filter-bar-container">
        <div className="filter-bar-top">
          <div className="search-input-wrapper">
            <Search size={16} />
            <input 
              type="text" 
              className="search-input" 
              placeholder="Search by Request ID, party name, remark, or mobile..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button 
              className="btn btn-secondary" 
              onClick={fetchHistoryCalls}
              title="Refresh database records"
              style={{ padding: '0.5rem 1rem' }}
            >
              Refresh
            </button>

            <button 
              className="btn btn-primary" 
              onClick={handleExportExcel}
              disabled={filteredCalls.length === 0}
              style={{ opacity: filteredCalls.length === 0 ? 0.6 : 1, cursor: filteredCalls.length === 0 ? 'not-allowed' : 'pointer' }}
            >
              <Download size={16} />
              <span>Export Selected ({filteredCalls.length})</span>
            </button>
          </div>
        </div>

        <hr style={{ border: '0', borderTop: '1px solid var(--border-color)', margin: '0' }} />

        {/* Filter Controls Row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600 }}>
            <Filter size={14} style={{ color: 'var(--color-accent)' }} />
            <span>FILTERS:</span>
          </div>

          {/* Place Dropdown */}
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.65rem' }}>Place Group</label>
            <div className="select-wrapper">
              <select 
                value={selectedPlace} 
                onChange={(e) => setSelectedPlace(e.target.value)}
                style={{ padding: '0.5rem 1.75rem 0.5rem 0.75rem', fontSize: '0.75rem', borderRadius: 'var(--radius-sm)' }}
              >
                <option value="All">All Places</option>
                {placesList.map(p => (
                  <option key={p.name} value={p.name}>{p.name}</option>
                ))}
                {!placesList.some(p => p.name.toLowerCase() === 'transfer') && (
                  <option value="transfer">Transfer</option>
                )}
              </select>
            </div>
          </div>

          {/* Status Dropdown */}
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.65rem' }}>Status</label>
            <div className="select-wrapper">
              <select 
                value={selectedStatus} 
                onChange={(e) => setSelectedStatus(e.target.value)}
                style={{ padding: '0.5rem 1.75rem 0.5rem 0.75rem', fontSize: '0.75rem', borderRadius: 'var(--radius-sm)' }}
              >
                <option value="All">All Statuses</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          {/* Order Type Dropdown */}
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.65rem' }}>Order Type</label>
            <div className="select-wrapper">
              <select 
                value={selectedOrderType} 
                onChange={(e) => setSelectedOrderType(e.target.value)}
                style={{ padding: '0.5rem 1.75rem 0.5rem 0.75rem', fontSize: '0.75rem', borderRadius: 'var(--radius-sm)' }}
              >
                <option value="All">All Order Types</option>
                {orderTypes.map(ot => <option key={ot} value={ot}>{ot}</option>)}
              </select>
            </div>
          </div>

          {/* Start Date */}
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.65rem' }}>Start Date</label>
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <input 
                type="date" 
                className="form-input" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
                style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem', width: '130px', borderRadius: 'var(--radius-sm)' }}
              />
            </div>
          </div>

          {/* End Date */}
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.65rem' }}>End Date</label>
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <input 
                type="date" 
                className="form-input" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
                style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem', width: '130px', borderRadius: 'var(--radius-sm)' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* History List Grid or Table */}
      <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
            <div className="loading-spinner" style={{ width: '32px', height: '32px' }}></div>
          </div>
        ) : noApi ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚠️</div>
            <div style={{ fontWeight: 700, marginBottom: '0.25rem', color: 'var(--color-error)' }}>Running in Browser Mode</div>
            <div style={{ fontSize: '0.8rem' }}>History requires the Electron desktop app. Open the app via <code>npm run dev</code> and use the Electron window, not the browser tab.</div>
          </div>
        ) : fetchError ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-error)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>❌</div>
            <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Database Error</div>
            <div style={{ fontSize: '0.8rem' }}>{fetchError}</div>
          </div>
        ) : calls.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
            <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>No History Records Yet</div>
            <div style={{ fontSize: '0.8rem' }}>No calls have been approved or rejected yet. Approve calls from the Pending tab to see them here.</div>
          </div>
        ) : filteredCalls.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</div>
            <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>No Records Match Filters</div>
            <div style={{ fontSize: '0.8rem' }}>There are {calls.length} total records in history, but none match the current filters. Try clearing some filters.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="history-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left', minWidth: '950px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 700 }}>
                  <th style={{ padding: '0.75rem 0.5rem', width: '100px' }}>Request ID</th>
                  <th style={{ padding: '0.75rem 0.5rem', width: '90px' }}>Status</th>
                  <th style={{ padding: '0.75rem 0.5rem', width: '90px' }}>Order Type</th>
                  <th style={{ padding: '0.75rem 0.5rem', width: '200px' }}>Sold to Party</th>
                  <th style={{ padding: '0.75rem 0.5rem', width: '180px' }}>Product</th>
                  <th style={{ padding: '0.75rem 0.5rem', width: '100px' }}>Pincode</th>
                  <th style={{ padding: '0.75rem 0.5rem', width: '100px' }}>Place Group</th>
                  <th style={{ padding: '0.75rem 0.5rem', width: '140px' }}>Phone Numbers</th>
                  <th style={{ padding: '0.75rem 0.5rem', width: '180px' }}>Remarks</th>
                  <th style={{ padding: '0.75rem 0.5rem', width: '110px' }}>Start Date</th>
                  <th style={{ padding: '0.75rem 0.5rem', width: '110px' }}>Action Date</th>
                  <th style={{ padding: '0.75rem 0.5rem', width: '60px', textAlign: 'center' }}>Del</th>
                </tr>
              </thead>
              <tbody>
                {filteredCalls.map(item => {
                  const isRejected = item.status === 'rejected';
                  const actionDate = isRejected ? item.rejected_date : item.approved_date;
                  
                  return (
                    <tr 
                      key={item.id} 
                      style={{ 
                        borderBottom: '1px solid var(--border-color)', 
                        backgroundColor: isRejected ? 'rgba(239, 68, 68, 0.06)' : 'transparent',
                        color: isRejected ? '#991b1b' : 'inherit'
                      }}
                    >
                      {/* Request ID */}
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <div style={{ fontWeight: 700, fontFamily: 'monospace' }}>{item.request_id}</div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        {isRejected ? (
                          <span className="badge badge-error" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', backgroundColor: '#fecaca', color: '#dc2626' }}>
                            Rejected
                          </span>
                        ) : (
                          <span className="badge badge-success" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
                            Approved
                          </span>
                        )}
                      </td>

                      {/* Order Type */}
                      <td style={{ padding: '0.75rem 0.5rem' }}>{item.order_type || '—'}</td>

                      {/* Sold to Party */}
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>{item.sold_to_party || '—'}</td>

                      {/* Product Description */}
                      <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }}>{item.product_description || '—'}</td>

                      {/* Pincode */}
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>{item.pincode || '—'}</td>

                      {/* Place Group */}
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <span className="badge badge-info" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
                          {item.place_group || 'transfer'}
                        </span>
                      </td>

                      {/* Phone Numbers */}
                      <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'monospace' }}>{item.phone_numbers || '—'}</td>

                      {/* Remarks */}
                      <td style={{ padding: '0.75rem 0.5rem', fontStyle: 'italic' }}>{item.notes || '—'}</td>

                      {/* Request Start */}
                      <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)' }}>{item.request_start || '—'}</td>

                      {/* Action Date */}
                      <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)' }}>
                        {actionDate ? new Date(actionDate).toLocaleString('en-IN') : '—'}
                      </td>

                      {/* Delete Action */}
                      <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                        {pendingDeleteId === item.id ? (
                          <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                            <button
                              onClick={() => handleDeleteCall(item.id)}
                              title="Confirm delete"
                              style={{ fontSize: '0.6rem', fontWeight: 700, background: '#dc2626', color: '#fff', border: 'none', borderRadius: '3px', padding: '0.15rem 0.35rem', cursor: 'pointer' }}
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setPendingDeleteId(null)}
                              title="Cancel"
                              style={{ fontSize: '0.6rem', fontWeight: 700, background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '3px', padding: '0.15rem 0.35rem', cursor: 'pointer' }}
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setPendingDeleteId(item.id)}
                            title="Delete this history record"
                            style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', opacity: 0.6, display: 'inline-flex', padding: '0.25rem' }}
                            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                            onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Statistics Bar Footer */}
        <div style={{ padding: '0.75rem 1.5rem', backgroundColor: 'var(--bg-hover)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          <div>
            Total: {filteredCalls.length} records shown
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span>Approved: {filteredCalls.filter(c => c.status === 'approved').length}</span>
            <span>Rejected: {filteredCalls.filter(c => c.status === 'rejected').length}</span>
          </div>
        </div>
      </div>
      
    </div>
  );
}
