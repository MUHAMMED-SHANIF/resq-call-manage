import React, { useState } from 'react';
import { X, Save, Info, MapPin, Plus, Trash2 } from 'lucide-react';

export default function SettingsModal({ 
  isOpen, 
  onClose, 
  siteFilter, 
  statusFilters, 
  sheetName, 
  sheetNames,
  placesConfig = [],
  onSave 
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
