import { REQUIRED_FIELDS, FILTER_FIELDS, resolveColumnName, getGroupsForPincodeDynamic } from '../config';
import { formatExcelDate } from './dateFormatter';

/**
 * Parses a raw CSV text string into an array of standardized row objects.
 * - productDescription: blank (filled by the user via the description prompt)
 * - cityBifurcation: always 'Local' (no city bifurcation in CSV)
 * - City Bifurcation column is intentionally excluded from CSV imports
 *
 * @param {string} csvText - Raw CSV file content
 * @param {string} siteFilter - Target site code
 * @param {string[]} statusFilters - Allowed user status values
 * @param {Array}  placesConfig - Dynamic places pincode routing config
 * @param {string} descriptionOverride - User-supplied description applied to all rows
 * @returns {{ filteredRows: Array, stats: { total: number, filtered: number } }}
 */
export function parseCsvData(csvText, siteFilter, statusFilters, placesConfig, descriptionOverride = '') {
  // Normalize line endings
  const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  if (lines.length < 2) {
    return { filteredRows: [], stats: { total: 0, filtered: 0 } };
  }

  // Parse CSV header
  const headers = parseCsvLine(lines[0]);

  // Resolve column indexes using config aliases
  const fieldKeys = {};
  REQUIRED_FIELDS.forEach(field => {
    if (field.key === 'productDescription' || field.key === 'cityBifurcation') return; // skipped for CSV
    const idx = resolveColumnIndex(headers, field.aliases);
    if (idx !== -1) fieldKeys[field.key] = idx;
  });

  const siteIdx = resolveColumnIndex(headers, FILTER_FIELDS.site.aliases);
  const userStatusIdx = resolveColumnIndex(headers, FILTER_FIELDS.userStatus.aliases);
  const pincodeIdx = resolveColumnIndex(headers, ['pincode', 'pin code', 'pin', 'postal code', 'postalcode']);

  // Parse all data rows
  const allRows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cells = parseCsvLine(line);

    const originalSite = siteIdx !== -1 ? (cells[siteIdx] || '').trim() : '';
    const originalStatus = normalizeStatus(userStatusIdx !== -1 ? (cells[userStatusIdx] || '') : '');

    const standardizedRow = {
      id: i,
      originalSite,
      originalStatus
    };

    // Map each required field
    REQUIRED_FIELDS.forEach(field => {
      if (field.key === 'productDescription') {
        // Use the user-supplied description for all CSV rows
        standardizedRow[field.key] = descriptionOverride || '—';
        return;
      }
      if (field.key === 'cityBifurcation') {
        // No city bifurcation in CSV
        standardizedRow[field.key] = 'Local';
        return;
      }

      const idx = fieldKeys[field.key];
      let value = idx !== undefined ? (cells[idx] || '') : '';
      value = typeof value === 'string' ? value.trim() : value;

      if (field.key === 'createdOn') {
        standardizedRow[field.key] = formatExcelDate(value) || value;
      } else {
        standardizedRow[field.key] = value !== '' ? value : '—';
      }
    });

    // Extract pincode
    let pincode = '';
    if (pincodeIdx !== -1 && cells[pincodeIdx]) {
      const match = String(cells[pincodeIdx]).match(/\b(\d{6})\b/);
      if (match) pincode = match[1];
    }
    if (!pincode && standardizedRow.soldToParty) {
      const match = String(standardizedRow.soldToParty).match(/\b(\d{6})\b/);
      if (match) pincode = match[1];
    }

    standardizedRow.pincode = pincode;
    standardizedRow.groups = getGroupsForPincodeDynamic(pincode, placesConfig);

    allRows.push(standardizedRow);
  }

  // Apply filters (exact match — same as Excel)
  const siteFilterLower = String(siteFilter).trim().toLowerCase();
  const statusFiltersLower = statusFilters.map(s => normalizeStatus(s));

  const filteredRows = allRows.filter(row => {
    const rowSite = row.originalSite.toLowerCase();
    const siteMatches = siteFilterLower === '' || rowSite === siteFilterLower;

    const rowStatus = row.originalStatus;
    const statusMatches = statusFiltersLower.length === 0 || statusFiltersLower.includes(rowStatus);

    return siteMatches && statusMatches;
  });

  return {
    filteredRows,
    stats: { total: allRows.length, filtered: filteredRows.length }
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parses a single CSV line, respecting quoted fields containing commas.
 */
function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

/**
 * Resolves a column index in the header row based on a list of aliases.
 */
function resolveColumnIndex(headers, aliases) {
  const normalizedHeaders = headers.map(h => String(h).toLowerCase().trim());
  for (const alias of aliases) {
    const idx = normalizedHeaders.indexOf(alias.toLowerCase());
    if (idx !== -1) return idx;
  }
  return -1;
}

/**
 * Normalizes a status string for exact comparison:
 * - Trim, collapse multiple whitespace, remove non-breaking spaces.
 */
function normalizeStatus(str) {
  return String(str)
    .replace(/\u00A0/g, ' ')  // non-breaking space → regular space
    .replace(/\s+/g, ' ')      // multiple spaces → one
    .trim()
    .toLowerCase();
}
