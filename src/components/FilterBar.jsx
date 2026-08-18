import React, { useState, useRef, useEffect } from 'react';
import { Search, RefreshCw, Filter, Clock, CheckCircle2, XCircle, Layers, ChevronDown, Check } from 'lucide-react';

const STATUS_TABS = [
  { key: 'all',      label: 'All',      icon: Layers },
  { key: 'pending',  label: 'Pending',  icon: Clock },
  { key: 'approved', label: 'Approved', icon: CheckCircle2 },
  { key: 'rejected', label: 'Rejected', icon: XCircle },
];

// All possible User Status values (from the Excel filter screenshot)
export const ALL_USER_STATUSES = [
  'Assigned/WIP',
  'DOA',
  'In Process.',
  'Part in Transit to SVC',
  'Part Not Available',
  'Part Pending Approved',
  'Part Token Required',
  'Parts Pending',
  'Released to WFM',
  'Request For Validation',
];

export default function FilterBar({ 
  searchQuery, 
  setSearchQuery, 
  filteredCount, 
  totalCount, 
  siteFilter, 
  statusFilters,
  setStatusFilters,
  onResetFile,
  cardStatusFilter,
  setCardStatusFilter,
  statusCounts
}) {
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setStatusDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const allSelected = statusFilters.length === 0 || statusFilters.length === ALL_USER_STATUSES.length;

  const handleSelectAll = () => {
    // If all are selected, deselect all (show none); 
    // if not all are selected, select all (show all)
    if (allSelected) {
      setStatusFilters([]);
    } else {
      setStatusFilters([...ALL_USER_STATUSES]);
    }
  };

  const handleToggleStatus = (status) => {
    const isSelected = statusFilters.length === 0 
      ? true  // empty = all selected
      : statusFilters.includes(status);

    if (statusFilters.length === 0) {
      // Currently "all" — switching to only this one excluded
      setStatusFilters(ALL_USER_STATUSES.filter(s => s !== status));
    } else if (isSelected) {
      const next = statusFilters.filter(s => s !== status);
      setStatusFilters(next);
    } else {
      const next = [...statusFilters, status];
      // If all are now selected, normalize back to empty (all)
      setStatusFilters(next.length === ALL_USER_STATUSES.length ? [] : next);
    }
  };

  const isStatusChecked = (status) => {
    if (statusFilters.length === 0) return true; // empty means all
    return statusFilters.includes(status);
  };

  // Label for the dropdown button
  const dropdownLabel = () => {
    if (statusFilters.length === 0 || statusFilters.length === ALL_USER_STATUSES.length) {
      return 'Status: All';
    }
    if (statusFilters.length === 1) return `Status: ${statusFilters[0]}`;
    return `Status: ${statusFilters.length} selected`;
  };

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
          {/* User Status Multi-select Dropdown */}
          <div className="status-filter-dropdown" ref={dropdownRef}>
            <button
              type="button"
              className={`btn btn-secondary status-filter-btn ${statusDropdownOpen ? 'active' : ''}`}
              onClick={() => setStatusDropdownOpen(v => !v)}
              title="Filter by User Status"
            >
              <Filter size={14} />
              <span>{dropdownLabel()}</span>
              <ChevronDown size={13} style={{ transition: 'transform 0.2s', transform: statusDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
            </button>

            {statusDropdownOpen && (
              <div className="status-filter-panel">
                {/* Select All row */}
                <label className="status-filter-option status-filter-option--all" onClick={handleSelectAll}>
                  <span className={`status-checkbox ${allSelected ? 'checked' : ''}`}>
                    {allSelected && <Check size={11} />}
                  </span>
                  <span>(Select All)</span>
                </label>

                <div className="status-filter-divider" />

                {ALL_USER_STATUSES.map(status => {
                  const checked = isStatusChecked(status);
                  return (
                    <label
                      key={status}
                      className="status-filter-option"
                      onClick={() => handleToggleStatus(status)}
                    >
                      <span className={`status-checkbox ${checked ? 'checked' : ''}`}>
                        {checked && <Check size={11} />}
                      </span>
                      <span>{status}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

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
