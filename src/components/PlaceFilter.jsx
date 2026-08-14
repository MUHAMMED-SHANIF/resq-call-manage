import React from 'react';
import { MapPin, CheckSquare } from 'lucide-react';

export default function PlaceFilter({ 
  activeTab, 
  setActiveTab, 
  counts,
  visibleCardsCount = 0,
  onApproveAll,
  placesList = []
}) {
  const options = [
    { id: 'All', label: 'All Places' },
    ...placesList.map(p => ({ id: p.name, label: p.name }))
  ];

  // Always append Transfer as fallback option if not already in configured places list
  if (!options.some(opt => opt.id.toLowerCase() === 'transfer')) {
    options.push({ id: 'transfer', label: 'Transfer' });
  }

  return (
    <div className="place-filter-dropdown-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
      
      {/* Dropdown filter selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div className="place-filter-dropdown-label">
          <MapPin size={16} />
          <span>Filter by Place:</span>
        </div>
        <div className="select-wrapper" style={{ width: '220px' }}>
          <select 
            value={activeTab} 
            onChange={(e) => setActiveTab(e.target.value)}
            className="place-filter-select"
            aria-label="Filter cards by place"
          >
            {options.map(opt => {
              const count = counts[opt.id] || 0;
              return (
                <option key={opt.id} value={opt.id}>
                  {opt.label} ({count})
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Batch Approve All button */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button 
          type="button" 
          className="btn btn-primary"
          onClick={onApproveAll}
          disabled={visibleCardsCount === 0}
          title={`Approve all ${visibleCardsCount} calls in this view`}
          style={{ fontSize: '0.75rem', padding: '0.5rem 1.25rem', gap: '0.4rem', borderRadius: 'var(--radius-md)' }}
        >
          <CheckSquare size={14} />
          <span>Approve All ({visibleCardsCount})</span>
        </button>
      </div>

    </div>
  );
}
