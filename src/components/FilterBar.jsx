import React from 'react';
import { Search, RefreshCw, Filter, Clock, CheckCircle2, XCircle, Layers } from 'lucide-react';

const STATUS_TABS = [
  { key: 'all',      label: 'All',      icon: Layers },
  { key: 'pending',  label: 'Pending',  icon: Clock },
  { key: 'approved', label: 'Approved', icon: CheckCircle2 },
  { key: 'rejected', label: 'Rejected', icon: XCircle },
];

export default function FilterBar({ 
  searchQuery, 
  setSearchQuery, 
  filteredCount, 
  totalCount, 
  siteFilter, 
  statusFilters,
  onResetFile,
  cardStatusFilter,
  setCardStatusFilter,
  statusCounts
}) {
  return (
    <div className="filter-bar-container">
      <div className="filter-bar-top">
        <div className="search-input-wrapper">
          <Search size={18} />
          <input 
            type="text" 
            className="search-input" 
            placeholder="Search by Service Order, Sold To Party, or Brand..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="header-actions">
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={onResetFile}
            title="Upload a different Excel file"
          >
            <RefreshCw size={16} />
            <span>Upload New File</span>
          </button>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="status-tab-bar">
        {STATUS_TABS.map(({ key, label, icon: Icon }) => {
          const count = statusCounts?.[key] ?? 0;
          const isActive = cardStatusFilter === key;
          return (
            <button
              key={key}
              type="button"
              className={`status-tab ${isActive ? 'status-tab-active status-tab-active--' + key : ''}`}
              onClick={() => setCardStatusFilter(key)}
            >
              <Icon size={13} />
              <span>{label}</span>
              <span className={`status-tab-count status-tab-count--${key}`}>{count}</span>
            </button>
          );
        })}
      </div>
      
      <div className="stats-summary" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span>
            Showing <strong>{filteredCount}</strong> of <strong>{totalCount}</strong> rows
          </span>
          <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <Filter size={10} /> Site: {siteFilter || 'Any'}
          </span>
        </div>
        
        {searchQuery.trim() !== '' && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Filtered by search term
          </span>
        )}
      </div>
    </div>
  );
}
