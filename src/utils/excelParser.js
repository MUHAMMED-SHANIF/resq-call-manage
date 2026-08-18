import * as XLSX from 'xlsx';
import { REQUIRED_FIELDS, FILTER_FIELDS, resolveColumnName, getGroupsForPincode, getGroupsForPincodeDynamic } from '../config';
import { formatExcelDate } from './dateFormatter';

/**
 * Normalizes a status string exactly as Excel AutoFilter does:
 * strips non-breaking spaces (U+00A0), collapses internal whitespace,
 * trims leading/trailing spaces, then lowercases.
 */
function normalizeStatus(str) {
  return String(str)
    .replace(/\u00A0/g, ' ')  // non-breaking space → regular space
    .replace(/\s+/g, ' ')      // multiple spaces → single space
    .trim()
    .toLowerCase();
}

/**
 * Parses the Excel file buffer using SheetJS.
 * Supports .xlsx, .xlsb, and .xls formats.
 * @param {ArrayBuffer} arrayBuffer 
 * @returns {XLSX.WorkBook}
 */
export function parseExcelWorkbook(arrayBuffer) {
  // Disable formula and HTML parsing for better XLSB compatibility
  const workbook = XLSX.read(arrayBuffer, { 
    type: 'array',
    cellFormula: false,
    cellHTML: false,
    cellText: false,
  });
  return workbook;
}

/**
 * Extracts and filters rows from a specific worksheet.
 * @param {XLSX.WorkBook} workbook 
 * @param {string} sheetName 
 * @param {string} siteFilter 
 * @param {string[]} statusFilters 
 * @returns {{allRows: Array, filteredRows: Array, stats: {total: number, filtered: number}}}
 */
export function extractSheetData(workbook, sheetName, siteFilter, statusFilters, placesConfig) {
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error(`Sheet "${sheetName}" was not found in this workbook.`);
  }

  // Convert the sheet to JSON array of objects
  const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
  
  if (rawData.length === 0) {
    return {
      allRows: [],
      filteredRows: [],
      stats: { total: 0, filtered: 0 }
    };
  }

  // Extract all keys from the first row to determine column mappings
  const firstRowKeys = Object.keys(rawData[0]);
  
  // Resolve actual column names in this Excel sheet
  const resolvedMappings = {};
  REQUIRED_FIELDS.forEach(field => {
    resolvedMappings[field.key] = resolveColumnName(firstRowKeys, field.aliases);
  });

  const resolvedFilterMappings = {
    site: resolveColumnName(firstRowKeys, FILTER_FIELDS.site.aliases),
    userStatus: resolveColumnName(firstRowKeys, FILTER_FIELDS.userStatus.aliases)
  };

  const pincodeKey = resolveColumnName(firstRowKeys, ['pincode', 'pin code', 'pin', 'postal code', 'postalcode']);

  // Convert raw rows to standardized rows containing only our needed columns
  const allRows = rawData.map((row, index) => {
    const rawStatus = resolvedFilterMappings.userStatus ? String(row[resolvedFilterMappings.userStatus]) : '';
    const standardizedRow = {
      id: index,
      originalSite: resolvedFilterMappings.site ? String(row[resolvedFilterMappings.site]).trim() : '',
      originalStatus: normalizeStatus(rawStatus)
    };

    REQUIRED_FIELDS.forEach(field => {
      const excelKey = resolvedMappings[field.key];
      let value = excelKey !== null ? row[excelKey] : '';
      
      // Clean string values
      if (typeof value === 'string') {
        value = value.trim();
      }

      // Convert date column values
      if (field.key === 'createdOn') {
        standardizedRow[field.key] = formatExcelDate(value);
      } else {
        standardizedRow[field.key] = (value !== null && value !== undefined && String(value).trim() !== '') 
          ? String(value).trim() 
          : '—';
      }
    });

    // Pincode extraction logic
    let pincode = '';
    
    // 1. Try dedicated column first
    if (pincodeKey && row[pincodeKey]) {
      const val = String(row[pincodeKey]).trim();
      const match = val.match(/\b(\d{6})\b/);
      if (match) {
        pincode = match[1];
      }
    }

    // 2. Fall back to parsing from Sold To Party text
    if (!pincode) {
      const soldToKey = resolvedMappings['soldToParty'];
      if (soldToKey && row[soldToKey]) {
        const soldToVal = String(row[soldToKey]).trim();
        const match = soldToVal.match(/\b(\d{6})\b/);
        if (match) {
          pincode = match[1];
        }
      }
    }

    // Determine place grouping
    standardizedRow.pincode = pincode;
    standardizedRow.groups = getGroupsForPincodeDynamic(pincode, placesConfig);

    return standardizedRow;
  });

  // Apply filters — uses normalizeStatus for exact Excel-equivalent matching
  const siteFilterLower = String(siteFilter).trim().toLowerCase();
  const statusFiltersNorm = statusFilters.map(s => normalizeStatus(s));

  const filteredRows = allRows.filter(row => {
    // Site code filter (if config code is set, match case-insensitively)
    const rowSite = row.originalSite.toLowerCase();
    const siteMatches = siteFilterLower === '' || rowSite === siteFilterLower;

    // User status filter — exact normalized match (like Excel AutoFilter)
    const rowStatus = row.originalStatus; // already normalized above
    const statusMatches = statusFiltersNorm.length === 0 || statusFiltersNorm.includes(rowStatus);

    return siteMatches && statusMatches;
  });

  return {
    allRows,
    filteredRows,
    stats: {
      total: rawData.length,
      filtered: filteredRows.length
    }
  };
}
