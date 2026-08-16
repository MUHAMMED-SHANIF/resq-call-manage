import React, { useState, useEffect } from 'react';
import { Copy, Check, PlusCircle, MinusCircle, Trash2, CheckCircle2, ShieldAlert } from 'lucide-react';
import { normalizePhoneNumber, isValidPhoneNumber } from '../utils/phoneNormalizer';

export default function DataCard({ 
  cardData, 
  index, 
  cardId,              // db id of this card (for approve anyway)
  note = '', 
  phones = [''], // Array of strings (phone numbers list)
  isDuplicate = false,
  duplicateNumberTrigger = null,
  whatsappStatus = 'not_sent',
  onUpdateNote, 
  onUpdatePhones,
  onApprove, 
  onReject, 
  onShowDuplicateHistory,
  onCopyToast 
}) {
  const [copied, setCopied] = useState(false);
  const isUp1 = String(cardData.cityBifurcation).toLowerCase().trim() === 'up1';

  // Handle phone changes and normalize
  const handlePhoneChange = (idx, value) => {
    const normalized = normalizePhoneNumber(value);
    const updatedPhones = [...phones];
    updatedPhones[idx] = normalized;
    onUpdatePhones(updatedPhones);
  };

  // Add a new phone field box
  const handleAddPhoneField = () => {
    onUpdatePhones([...phones, '']);
  };

  // Remove a phone field box
  const handleRemovePhoneField = (idx) => {
    const updatedPhones = phones.filter((_, i) => i !== idx);
    onUpdatePhones(updatedPhones.length > 0 ? updatedPhones : ['']);
  };

  // Copy card details to clipboard
  const handleCopy = async (e) => {
    e.stopPropagation();

    const formattedPhones = phones.filter(p => p.trim() !== '').join(', ');

    // Assemble fields in exact order requested:
    // Request Start, Id, Order Type, Sold To Party, Note/Remark, Phone Number, Brand Name, Product Description, City Bifurcation (conditional)
    const lines = [
      `Request Start: ${cardData.createdOn || '—'}`,
      `Id: ${cardData.serviceOrder || '—'}`,
      cardData.orderType || '—',
      cardData.soldToParty || '—'
    ];

    // Inject multiline notes if user typed anything
    if (note.trim() !== '') {
      lines.push(note.trim());
    }

    // Inject phone numbers list if present
    if (formattedPhones.trim() !== '') {
      lines.push(`Phone: ${formattedPhones}`);
    }

    lines.push(cardData.brandName || '—');
    lines.push(cardData.productDescription || '—');

    if (isUp1) {
      lines.push('up');
    }

    const formattedText = lines.join('\n');

    try {
      await navigator.clipboard.writeText(formattedText);
      setCopied(true);
      if (onCopyToast) {
        onCopyToast(`Copied Card #${index} (Id: ${cardData.serviceOrder})`);
      }
      setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch (err) {
      console.error('Failed to copy card to clipboard:', err);
    }
  };

  // Find exact duplicate number to open history modal with
  const handleHistoryClick = () => {
    const trigger = duplicateNumberTrigger || phones.find(p => p.trim() !== '');
    if (trigger && onShowDuplicateHistory) {
      // Pass both the number AND the card's db id so parent can wire up Approve Anyway
      onShowDuplicateHistory(trigger, cardId);
    }
  };

  const isHistoric = cardData.status && cardData.status !== 'pending';

  return (
    <div className={`data-card ${isDuplicate ? 'duplicate-highlight' : ''} ${isHistoric ? 'historic-locked' : ''}`}>
      
      {/* Top Header Row of Card */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span className="card-index">#{index}</span>
        </div>

        {/* Action Buttons Row — icon only */}
        <div className="card-actions-wrapper">
          
          {/* Reject/Delete Button — hidden if historic */}
          {!isHistoric && (
            <button
              type="button"
              className="card-action-btn reject"
              onClick={onReject}
              title="Reject / Remove this call"
              aria-label="Reject card"
            >
              <Trash2 size={13} />
            </button>
          )}

          {/* Copy Button — icon only */}
          <button 
            type="button"
            className={`card-action-btn copy ${copied ? 'copied' : ''}`}
            onClick={handleCopy}
            title="Copy card text to clipboard"
            aria-label="Copy card text"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>

          {/* Duplicate Button — Replaces Approve when duplicate */}
          {isDuplicate && !isHistoric && (
            <button
              type="button"
              className="card-action-btn"
              onClick={handleHistoryClick}
              title="Click to view call history & approve if needed"
              style={{
                backgroundColor: '#fee2e2',
                color: '#dc2626',
                borderColor: '#fca5a5',
                animation: 'pulse 2s infinite',
                width: 'auto',
                padding: '0 0.5rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontWeight: 700,
                fontSize: '0.65rem'
              }}
            >
              <ShieldAlert size={13} />
              <span>Duplicate</span>
            </button>
          )}

          {/* Approve Button — HIDDEN when duplicate OR historic */}
          {!isDuplicate && !isHistoric && (
            <button
              type="button"
              className="card-action-btn approve"
              onClick={onApprove}
              title="Approve & Move to History"
              aria-label="Approve card"
            >
              <CheckCircle2 size={13} />
            </button>
          )}
        </div>
      </div>


      <div className="card-fields">
        {/* Labeled Fields */}
        <div className="card-field-labeled">
          <span className="field-label">Request Start:</span>
          <span className="field-value">{cardData.createdOn}</span>
        </div>
        
        <div className="card-field-labeled">
          <span className="field-label">Id:</span>
          <span className="field-value field-value-highlight">{cardData.serviceOrder}</span>
        </div>

        <hr style={{ border: 0, borderTop: '1px solid var(--border-color)', margin: '0.25rem 0' }} />

        {/* Pure Data Fields */}
        <div className="card-field-raw" style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
          {cardData.orderType}
        </div>
        
        <div className="card-field-raw" style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.8rem' }}>
          {cardData.soldToParty}
        </div>

        {/* 1. Dynamic Phone Numbers Input Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', margin: '0.25rem 0' }}>
          <span className="field-label" style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Phone Numbers</span>
          
          {phones.map((phone, idx) => {
            const isInvalid = phone.trim() !== '' && !isValidPhoneNumber(phone);
            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <input
                  type="text"
                  className={`card-phone-input ${isInvalid ? 'input-invalid' : ''}`}
                  placeholder="10-digit mobile..."
                  value={phone}
                  onChange={(e) => handlePhoneChange(idx, e.target.value)}
                  disabled={isHistoric}
                  style={{ fontSize: '0.75rem', flexGrow: 1, padding: '0.2rem 0.4rem', height: '26px' }}
                />
                
                {!isHistoric && (
                  <>
                    {idx === 0 ? (
                      <button
                        type="button"
                        onClick={handleAddPhoneField}
                        style={{ background: 'none', border: 0, padding: 0, color: 'var(--color-accent)', cursor: 'pointer', display: 'flex' }}
                        title="Add phone number"
                      >
                        <PlusCircle size={15} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRemovePhoneField(idx)}
                        style={{ background: 'none', border: 0, padding: 0, color: 'var(--color-error)', cursor: 'pointer', display: 'flex' }}
                        title="Remove phone number"
                      >
                        <MinusCircle size={15} />
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* 2. Remarks Notes Area */}
        <div className="card-note-wrapper" style={{ margin: '0.25rem 0' }}>
          <span className="field-label" style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Remarks</span>
          <textarea
            className="card-note-input"
            placeholder="Add comments / remarks..."
            value={note}
            onChange={(e) => onUpdateNote(e.target.value)}
            disabled={isHistoric}
            rows={1}
            style={{ minHeight: '34px', fontSize: '0.75rem', padding: '0.25rem 0.4rem', marginTop: '0.15rem' }}
          />
        </div>

        <div className="card-field-raw" style={{ fontWeight: 600, color: 'var(--color-accent)' }}>
          {cardData.brandName}
        </div>

        <div className="card-field-raw" style={{ fontStyle: 'italic' }}>
          {cardData.productDescription}
        </div>

        {isUp1 && (
          <div className="card-field-raw" style={{ fontWeight: 700, color: 'var(--color-success)', textTransform: 'uppercase' }}>
            up
          </div>
        )}
      </div>
    </div>
  );
}
