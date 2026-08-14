/**
 * Formats an Excel date serial number (or string) into a human-readable DD-MMM-YYYY format.
 * E.g., 46232 -> "01-Aug-2026"
 */
export function formatExcelDate(value) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return '—';
  }

  let numValue = value;

  // Handle strings containing digits
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) {
      numValue = parseInt(trimmed, 10);
    } else if (/^\d+\.\d+$/.test(trimmed)) {
      numValue = parseFloat(trimmed);
    } else {
      return trimmed; // Already a formatted string like "2026-08-01"
    }
  }

  if (typeof numValue === 'number' && !isNaN(numValue)) {
    // Excel dates are normally in this range (30000 is ~1982, 100000 is ~2173)
    if (numValue > 10000 && numValue < 100000) {
      try {
        // Excel base date is 1899-12-30 (due to 1900 leap year bug)
        const date = new Date(1899, 11, 30 + Math.floor(numValue));
        
        // Extract components
        const day = String(date.getDate()).padStart(2, '0');
        const months = [
          'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
        ];
        const month = months[date.getMonth()];
        const year = date.getFullYear();
        
        return `${day}-${month}-${year}`;
      } catch (err) {
        console.error('Error parsing Excel date serial:', numValue, err);
        return String(value);
      }
    }
  }

  return String(value);
}
