import React, { useState, useEffect } from 'react';
import DataCard from './DataCard';
import { Layers } from 'lucide-react';

export default function CardGrid({ 
  cards, 
  onCopyToast, 
  onUpdateNote, 
  onUpdatePhones, 
  onApprove, 
  onReject, 
  onShowDuplicateHistory,
  onUpdateWarranty,
  onUpdateAmount
}) {
  const [visibleCount, setVisibleCount] = useState(100);

  // Reset visible count when cards set changes
  useEffect(() => {
    setVisibleCount(100);
  }, [cards]);

  if (cards.length === 0) {
    return (
      <div className="empty-state">
        <Layers size={48} className="empty-state-icon" />
        <h3 className="empty-state-title">No matching records</h3>
        <p>Try adjusting your search terms or verify your filter settings.</p>
      </div>
    );
  }

  const visibleCards = cards.slice(0, visibleCount);
  const hasMore = cards.length > visibleCount;

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + 100);
  };

  return (
    <div className="grid-container">
      <div className="cards-grid">
        {visibleCards.map((card, index) => (
          <DataCard 
            key={`${card.serviceOrder}-${card.id || index}`} 
            cardData={card} 
            index={index + 1}
            cardId={card.id}
            note={card.notes || ''}
            phones={card.phoneNumbers ? card.phoneNumbers.split(', ') : ['']}
            isDuplicate={card.isDuplicate}
            duplicateNumberTrigger={card.duplicateNumberTrigger}
            whatsappStatus={card.whatsappStatus}
            warrantyStatus={card.warrantyStatus || null}
            amount={card.amount || ''}
            onUpdateNote={(text) => onUpdateNote(card.id, text)}
            onUpdatePhones={(phonesList) => onUpdatePhones(card.id, phonesList)}
            onApprove={() => onApprove(card.id)}
            onReject={() => onReject(card.id)}
            onShowDuplicateHistory={onShowDuplicateHistory}
            onCopyToast={onCopyToast}
            onUpdateWarranty={(status) => onUpdateWarranty(card.id, status)}
            onUpdateAmount={(amt) => onUpdateAmount(card.id, amt)}
          />
        ))}
      </div>

      {hasMore && (
        <div className="load-more-container">
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={handleLoadMore}
          >
            Load More ({cards.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
}
