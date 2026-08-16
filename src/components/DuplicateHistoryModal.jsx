import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, CheckCircle2 } from 'lucide-react';

export default function DuplicateHistoryModal({ 
  isOpen, 
  onClose, 
  normalizedNumber,
  currentServiceOrder = null,  // service order of the card being reviewed
  currentCallId = null,        // db id of the card being reviewed
  onApproveAnyway = null        // callback to approve this card despite duplicate
}) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !normalizedNumber) return;

    setLoading(true);
    if (!window.api) {
      setHistory([]);
      setLoading(false);
      return;
    }
    window.api.getDuplicateHistory(normalizedNumber, currentCallId)
      .then(data => {
        setHistory(data || []);
      })
      .catch(err => {
        console.error('Error fetching duplicate history:', err);
        setHistory([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, normalizedNumber]);

  if (!isOpen) return null;

  // Check if the EXACT same service order ID already exists in history
  // (don't allow approving the exact same request_id twice)
  const sameIdInHistory = currentServiceOrder
    ? history.some(item => String(item.request_id) === String(currentServiceOrder))
    : false;

  const canApproveAnyway = !!onApproveAnyway && !sameIdInHistory;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '780px', width: '92%' }}>
        <div className="modal-header">
          <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldAlert size={18} style={{ color: 'var(--color-error)' }} />
            <span>Duplicate Call History — <code style={{ fontSize: '0.85em' }}>{normalizedNumber}</code></span>
          </h3>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '1.25rem 1.5rem', maxHeight: '450px', overflowY: 'auto' }}>

          {/* Warning if same ID already exists */}
          {sameIdInHistory && (
            <div style={{
              backgroundColor: 'rgba(239,68,68,0.1)',
              border: '1px solid var(--color-error)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              fontSize: '0.8rem',
              color: 'var(--color-error)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <ShieldAlert size={15} />
              <span>
                This call (<strong>{currentServiceOrder}</strong>) already exists in history. Approval is blocked to prevent exact duplicate records.
              </span>
            </div>
          )}

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3rem' }}>
              <div className="loading-spinner" style={{ width: '32px', height: '32px' }}></div>
            </div>
          ) : history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              No past records found for this phone number.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="history-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '0.5rem' }}>Request ID</th>
                    <th style={{ padding: '0.5rem' }}>Brand &amp; Product</th>
                    <th style={{ padding: '0.5rem' }}>Status</th>
                    <th style={{ padding: '0.5rem' }}>Action Date</th>
                    <th style={{ padding: '0.5rem' }}>Remark/Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item, index) => {
                    let statusBadgeClass = 'badge-info';
                    if (item.status === 'approved') statusBadgeClass = 'badge-success';
                    if (item.status === 'rejected') statusBadgeClass = 'badge-error';
                    if (item.status === 'pending') statusBadgeClass = 'badge-warning';

                    const actionDate = item.status === 'approved' 
                      ? item.approved_date 
                      : item.status === 'rejected' 
                        ? item.rejected_date 
                        : item.created_on;

                    // Highlight rows that match the current service order
                    const isSameId = currentServiceOrder && String(item.request_id) === String(currentServiceOrder);

                    return (
                      <tr 
                        key={index} 
                        style={{ 
                          borderBottom: '1px solid var(--border-color)', 
                          verticalAlign: 'top',
                          backgroundColor: isSameId ? 'rgba(239,68,68,0.08)' : 'transparent'
                        }}
                      >
                        <td style={{ padding: '0.625rem 0.5rem', fontWeight: 700, fontFamily: 'monospace' }}>
                          {item.request_id}
                          {isSameId && (
                            <span style={{ marginLeft: '0.4rem', fontSize: '0.6rem', color: 'var(--color-error)', fontFamily: 'sans-serif' }}>
                              ← same ID
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.625rem 0.5rem' }}>
                          <div style={{ fontWeight: 600 }}>{item.brand_name}</div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>{item.product_description}</div>
                        </td>
                        <td style={{ padding: '0.625rem 0.5rem' }}>
                          <span className={`badge ${statusBadgeClass}`} style={{ textTransform: 'capitalize' }}>
                            {item.status}
                          </span>
                        </td>
                        <td style={{ padding: '0.625rem 0.5rem', color: 'var(--text-secondary)' }}>
                          {actionDate ? new Date(actionDate).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                        </td>
                        <td style={{ padding: '0.625rem 0.5rem', color: 'var(--text-secondary)', maxWidth: '200px', wordBreak: 'break-word' }}>
                          {item.notes || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>

          {/* Approve Anyway — only shown if caller provides the callback */}
          {onApproveAnyway && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canApproveAnyway}
              title={
                sameIdInHistory
                  ? `Cannot approve — ${currentServiceOrder} already exists in history`
                  : 'Approve this call despite the duplicate phone number'
              }
              style={{
                opacity: canApproveAnyway ? 1 : 0.45,
                cursor: canApproveAnyway ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.8rem'
              }}
              onClick={() => {
                if (canApproveAnyway) {
                  onApproveAnyway();
                  onClose();
                }
              }}
            >
              <CheckCircle2 size={15} />
              <span>
                {sameIdInHistory ? 'Already in History' : 'Approve Anyway'}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
