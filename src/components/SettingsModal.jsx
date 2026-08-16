import React, { useState } from 'react';
import { X, Save, Info, MapPin, Plus, Trash2, ShieldAlert, Lock, AlertTriangle } from 'lucide-react';

export default function SettingsModal({ 
  isOpen, 
  onClose, 
  siteFilter, 
  statusFilters, 
  sheetName, 
  sheetNames,
  placesConfig = [],
  onSave,
  onClearHistorySuccess
}) {
  const [site, setSite] = useState(siteFilter);
  const [statusesText, setStatusesText] = useState(statusFilters.join(', '));
  const [selectedSheet, setSelectedSheet] = useState(sheetName);
  
  // Local state for dynamic places table editing
  const [places, setPlaces] = useState(() => {
    return (placesConfig || []).map(p => ({
      name: p.name,
      pincodesText: Array.isArray(p.pincodes) ? p.pincodes.join(', ') : ''
    }));
  });

  const [validationError, setValidationError] = useState(null);

  // Danger Zone: Clear All History
  // Steps: 'idle' | 'confirm' | 'type' | 'password' | 'clearing'
  const [clearStep, setClearStep] = useState('idle');
  const [confirmText, setConfirmText] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [clearError, setClearError] = useState('');
  const [clearSuccess, setClearSuccess] = useState('');

  // Danger Zone: Set/Change Password
  const [showSetPassword, setShowSetPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [passwordSaveMsg, setPasswordSaveMsg] = useState('');

  const dangerPassword = localStorage.getItem('cc_danger_password') || '';

  const handleClearHistoryClick = () => {
    setClearStep('confirm');
    setClearError('');
    setClearSuccess('');
    setConfirmText('');
    setPasswordInput('');
  };

  const handleClearStep1 = () => {
    if (confirmText.trim().toUpperCase() !== 'DELETE ALL') {
      setClearError('You must type DELETE ALL exactly to proceed.');
      return;
    }
    setClearError('');
    if (dangerPassword) {
      setClearStep('password');
    } else {
      handleClearConfirmed();
    }
  };

  const handleClearStep2 = () => {
    if (passwordInput !== dangerPassword) {
      setClearError('Incorrect password. History was NOT cleared.');
      return;
    }
    handleClearConfirmed();
  };

  const handleClearConfirmed = async () => {
    setClearStep('clearing');
    setClearError('');
    try {
      if (window.api) {
        const result = await window.api.clearAllHistory();
        setClearSuccess(`Done! ${result.deleted} history records deleted.`);
      } else {
        setClearSuccess('[Mock] History cleared (no DB in browser mode).');
      }
      setClearStep('idle');
      setConfirmText('');
      setPasswordInput('');
      if (onClearHistorySuccess) onClearHistorySuccess();
    } catch (err) {
      setClearError(`Error: ${err.message || err}`);
      setClearStep('idle');
    }
  };

  const handleSavePassword = () => {
    if (newPassword !== newPasswordConfirm) {
      setPasswordSaveMsg('Passwords do not match.');
      return;
    }
    if (newPassword.trim() === '') {
      localStorage.removeItem('cc_danger_password');
      setPasswordSaveMsg('Password removed. History can be cleared without a password.');
    } else {
      localStorage.setItem('cc_danger_password', newPassword);
      setPasswordSaveMsg('Password saved successfully.');
    }
    setNewPassword('');
    setNewPasswordConfirm('');
    setTimeout(() => setPasswordSaveMsg(''), 3000);
  };

  if (!isOpen) return null;

  const updatePlace = (index, field, value) => {
    setPlaces(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const addPlace = () => {
    setPlaces(prev => [...prev, { name: '', pincodesText: '' }]);
  };

  const deletePlace = (index) => {
    setPlaces(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = (e) => {
    e.preventDefault();
    setValidationError(null);

    // Validate Places Configurations
    for (let i = 0; i < places.length; i++) {
      const p = places[i];
      if (!p.name.trim()) {
        setValidationError(`Place Name is required at row ${i + 1}.`);
        return;
      }
      if (!p.pincodesText.trim()) {
        setValidationError(`At least one Pincode is required for place "${p.name || `at row ${i + 1}`}".`);
        return;
      }
    }

    // Parse statuses from comma-separated list
    const parsedStatuses = statusesText
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    // Map dynamic places back to arrays
    const mappedPlaces = places.map(p => ({
      name: p.name.trim(),
      pincodes: p.pincodesText.split(',').map(pin => pin.trim()).filter(Boolean)
    }));

    onSave({
      site: site.trim(),
      statuses: parsedStatuses,
      sheetName: selectedSheet,
      places: mappedPlaces
    });
    
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '750px', width: '95%' }}>
        <div className="modal-header">
          <h3 className="modal-title">Settings & Filter Configuration</h3>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close settings">
            <X size={18} />
          </button>
        </div>
        
        <form onSubmit={handleSave}>
          <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', gap: '1.25rem' }}>
            
            {validationError && (
              <div className="error-toast" style={{ margin: '0', animation: 'none' }}>
                <span>{validationError}</span>
              </div>
            )}

            {/* General Settings Section */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              
              {/* Sheet Selection */}
              {sheetNames && sheetNames.length > 0 && (
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Active Sheet</label>
                  <div className="select-wrapper">
                    <select 
                      value={selectedSheet} 
                      onChange={(e) => setSelectedSheet(e.target.value)}
                      style={{ fontSize: '0.8rem', padding: '0.5rem 1.75rem 0.5rem 0.75rem' }}
                    >
                      {sheetNames.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              
              {/* Site Code */}
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Target Site Code</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. T0O3" 
                  value={site} 
                  onChange={(e) => setSite(e.target.value)} 
                  style={{ fontSize: '0.8rem', padding: '0.5rem 0.75rem' }}
                />
              </div>

              {/* User Statuses */}
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Included User Statuses (comma-separated)</label>
                <input 
                  type="text"
                  className="form-input" 
                  placeholder="e.g. Assigned/WIP, Released to WFM" 
                  value={statusesText} 
                  onChange={(e) => setStatusesText(e.target.value)}
                  style={{ fontSize: '0.8rem', padding: '0.5rem 0.75rem' }}
                />
              </div>
            </div>

            <hr style={{ border: '0', borderTop: '1px solid var(--border-color)', margin: '0.5rem 0' }} />

            {/* Dynamic Places Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <MapPin size={16} style={{ color: 'var(--color-accent)' }} />
                  Place-based Pincode Routing
                </h4>
                
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={addPlace}
                  style={{ fontSize: '0.7rem', padding: '0.4rem 0.75rem', gap: '0.35rem', borderRadius: '4px' }}
                >
                  <Plus size={13} />
                  <span>Add Place</span>
                </button>
              </div>

              {/* Dynamic places table */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflowX: 'auto', maxHeight: '250px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left', minWidth: '550px' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 700 }}>
                      <th style={{ padding: '0.625rem 0.75rem', width: '220px' }}>Place Name</th>
                      <th style={{ padding: '0.625rem 0.75rem' }}>Pincodes (comma-separated)</th>
                      <th style={{ padding: '0.625rem 0.75rem', width: '60px', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {places.length === 0 ? (
                      <tr>
                        <td colSpan="3" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                          No places configured. Click "Add Place" to add one.
                        </td>
                      </tr>
                    ) : (
                      places.map((place, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', verticalAlign: 'middle' }}>
                          
                          {/* Place Name Input */}
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            <input 
                              type="text" 
                              className="form-input" 
                              value={place.name}
                              placeholder="e.g. Manjeri"
                              onChange={(e) => updatePlace(idx, 'name', e.target.value)}
                              style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px', margin: '0' }}
                            />
                          </td>

                          {/* Pincodes Input */}
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            <input 
                              type="text" 
                              className="form-input" 
                              value={place.pincodesText}
                              placeholder="e.g. 676121, 676122"
                              onChange={(e) => updatePlace(idx, 'pincodesText', e.target.value)}
                              style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px', margin: '0' }}
                            />
                          </td>

                          {/* Delete Action Button */}
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => deletePlace(idx)}
                              style={{ 
                                background: 'transparent', 
                                border: 'none', 
                                color: 'var(--color-error)', 
                                padding: '0.25rem', 
                                cursor: 'pointer',
                                opacity: 0.8,
                                transition: 'opacity 0.2s'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                              onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}
                              title="Delete place configuration"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>

                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div style={{ 
              display: 'flex', 
              gap: '0.625rem', 
              backgroundColor: 'var(--color-accent-light)', 
              padding: '0.75rem', 
              borderRadius: 'var(--radius-sm)', 
              color: 'var(--color-accent)', 
              fontSize: '0.75rem', 
              alignItems: 'flex-start',
              lineHeight: 1.4
            }}>
              <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>
                Settings are saved in local storage. Changing place names or pincodes will immediately re-categorize both active pending lists and historical data records.
              </span>
            </div>

            {/* ═══ DANGER ZONE ═══ */}
            <hr style={{ border: '0', borderTop: '2px solid #fca5a5', margin: '0.5rem 0' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#dc2626', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <ShieldAlert size={16} />
                Danger Zone
              </h4>

              {/* Clear All History */}
              {clearStep === 'idle' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {clearSuccess && (
                    <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '4px', padding: '0.4rem 0.65rem' }}>
                      ✓ {clearSuccess}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem' }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#991b1b' }}>Clear All History</div>
                      <div style={{ fontSize: '0.7rem', color: '#b91c1c', marginTop: '0.15rem' }}>Permanently deletes all approved &amp; rejected records. Cannot be undone.</div>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearHistoryClick}
                      style={{ flexShrink: 0, background: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.4rem 0.85rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <Trash2 size={13} /> Clear History
                    </button>
                  </div>
                </div>
              )}

              {/* Step 1 — Type DELETE ALL */}
              {(clearStep === 'confirm') && (
                <div style={{ background: '#fef2f2', border: '1px solid #f87171', borderRadius: 'var(--radius-sm)', padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#991b1b', fontWeight: 700, fontSize: '0.8rem' }}>
                    <AlertTriangle size={14} /> Confirm Deletion — Step 1 of {dangerPassword ? 2 : 1}
                  </div>
                  <p style={{ fontSize: '0.72rem', color: '#b91c1c', margin: 0 }}>This will permanently erase ALL approved and rejected call records. Type <strong>DELETE ALL</strong> below to confirm.</p>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Type: DELETE ALL"
                    value={confirmText}
                    onChange={e => { setConfirmText(e.target.value); setClearError(''); }}
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem', borderColor: '#f87171' }}
                    autoFocus
                  />
                  {clearError && <div style={{ fontSize: '0.7rem', color: '#dc2626', fontWeight: 600 }}>{clearError}</div>}
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={() => { setClearStep('idle'); setClearError(''); }} style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', background: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, color: '#475569' }}>Cancel</button>
                    <button type="button" onClick={handleClearStep1} style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 700 }}>Continue →</button>
                  </div>
                </div>
              )}

              {/* Step 2 — Password (only if set) */}
              {clearStep === 'password' && (
                <div style={{ background: '#fef2f2', border: '1px solid #f87171', borderRadius: 'var(--radius-sm)', padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#991b1b', fontWeight: 700, fontSize: '0.8rem' }}>
                    <Lock size={14} /> Confirm Deletion — Step 2 of 2
                  </div>
                  <p style={{ fontSize: '0.72rem', color: '#b91c1c', margin: 0 }}>Enter the danger-zone password to proceed.</p>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Enter password"
                    value={passwordInput}
                    onChange={e => { setPasswordInput(e.target.value); setClearError(''); }}
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem', borderColor: '#f87171' }}
                    autoFocus
                  />
                  {clearError && <div style={{ fontSize: '0.7rem', color: '#dc2626', fontWeight: 600 }}>{clearError}</div>}
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={() => { setClearStep('idle'); setClearError(''); }} style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', background: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, color: '#475569' }}>Cancel</button>
                    <button type="button" onClick={handleClearStep2} style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 700 }}>Delete All →</button>
                  </div>
                </div>
              )}

              {clearStep === 'clearing' && (
                <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 700, textAlign: 'center', padding: '0.75rem' }}>Clearing history...</div>
              )}

              {/* Set / Change Password */}
              <div style={{ borderTop: '1px dashed #fca5a5', paddingTop: '0.65rem' }}>
                <button
                  type="button"
                  onClick={() => { setShowSetPassword(p => !p); setPasswordSaveMsg(''); }}
                  style={{ fontSize: '0.72rem', fontWeight: 700, color: '#b91c1c', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', padding: 0 }}
                >
                  <Lock size={12} /> {dangerPassword ? 'Change Danger-Zone Password' : 'Set Danger-Zone Password (optional)'}
                </button>

                {showSetPassword && (
                  <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="New password (leave blank to remove)"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem' }}
                    />
                    <input
                      type="password"
                      className="form-input"
                      placeholder="Confirm new password"
                      value={newPasswordConfirm}
                      onChange={e => setNewPasswordConfirm(e.target.value)}
                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem' }}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button type="button" onClick={handleSavePassword} style={{ fontSize: '0.72rem', padding: '0.3rem 0.65rem', background: '#b91c1c', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 700 }}>Save Password</button>
                      {passwordSaveMsg && <span style={{ fontSize: '0.68rem', color: '#16a34a', fontWeight: 600 }}>{passwordSaveMsg}</span>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <Save size={16} />
              <span>Apply & Save</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
