export const DEFAULT_SITE = 'T0o3';

export const DEFAULT_STATUSES = ['Assigned/WIP', 'Released to WFM'];

export const DEFAULT_SHEET = 'Open Calls Data';

// Defined list of extracted fields to show on cards and copy to clipboard
export const REQUIRED_FIELDS = [
  { key: 'orderType', label: 'Order Type', aliases: ['order type', 'ordertype', 'order_type'] },
  { key: 'brick', label: 'Brick', aliases: ['brick'] },
  { key: 'serviceOrder', label: 'Service Order', aliases: ['service order', 'serviceorder', 'service_order'] },
  { key: 'createdOn', label: 'Created On', aliases: ['created on', 'created_on', 'createdon', 'date'] },
  { key: 'soldToParty', label: 'Sold To Party', aliases: ['sold to party', 'sold_to_party', 'soldtoparty', 'sold_to', 'customer'] },
  { key: 'productDescription', label: 'Product Description', aliases: ['prduct description', 'product description', 'product_description', 'productdescription', 'description', 'fg article description'] },
  { key: 'brandName', label: 'Brand Name', aliases: ['brand name', 'brand_name', 'brandname', 'brand'] },
  { key: 'cityBifurcation', label: 'City Bifurcation', aliases: ['city bifurcation', 'city_bifurcation', 'citybifurcation'] }
];

// Required columns for filtering rows
export const FILTER_FIELDS = {
  site: { key: 'site', label: 'Site', aliases: ['site'] },
  userStatus: { key: 'userStatus', label: 'User Status', aliases: ['user status', 'user_status', 'userstatus', 'status'] }
};

// Help helper to match Excel columns based on aliases
export function resolveColumnName(rowKeys, aliases) {
  const normalizedRowKeys = rowKeys.map(k => String(k).toLowerCase().trim());
  for (const alias of aliases) {
    const idx = normalizedRowKeys.indexOf(alias.toLowerCase());
    if (idx !== -1) {
      return rowKeys[idx]; // Return the original Excel key
    }
  }
  return null;
}

// Pincode grouping configuration
export const PINCODE_GROUPS = {
  Manjeri: ['676121', '676122', '676123', '676509', '676506', '676507', '676514', '676517', '676519'],
  Kondotty: ['673632', '673634', '673636', '673637', '673638', '673647'],
  Wandoor: ['679327', '679328', '679329', '679330', '679331', '679332', '679333', '679334', '679339', '679342', '679344', '679355'],
  Areekode: ['673639', '673640', '673641', '673642', '673644'],
  Malappuram: ['676504', '676505', '676506', '676507', '676509', '676514', '676517', '676519', '676521', '676528', '676541'],
  transfer: ['671319']
};

/**
 * Returns all groups a pincode belongs to.
 * Handled as array since pincodes can overlap.
 */
export function getGroupsForPincode(pincode) {
  const pinStr = String(pincode).trim();
  const groups = [];
  
  if (PINCODE_GROUPS.Manjeri.includes(pinStr)) groups.push('Manjeri');
  if (PINCODE_GROUPS.Kondotty.includes(pinStr)) groups.push('Kondotty');
  if (PINCODE_GROUPS.Wandoor.includes(pinStr)) groups.push('Wandoor');
  if (PINCODE_GROUPS.Areekode.includes(pinStr)) groups.push('Areekode');
  if (PINCODE_GROUPS.Malappuram.includes(pinStr)) groups.push('Malappuram');
  
  if (PINCODE_GROUPS.transfer.includes(pinStr)) {
    if (!groups.includes('transfer')) {
      groups.push('transfer');
    }
  }
  
  // If pincode doesn't match any of the main groups, map it to transfer
  if (groups.length === 0) {
    groups.push('transfer');
  }
  
  return groups;
}

export function getGroupsForPincodeDynamic(pincode, placesConfig) {
  const pinStr = String(pincode).trim();
  const groups = [];
  let matchedOther = false;
  
  if (placesConfig && Array.isArray(placesConfig)) {
    // First pass: match all places except 'transfer'
    placesConfig.forEach(place => {
      if (place.name.toLowerCase() !== 'transfer') {
        if (place.pincodes && Array.isArray(place.pincodes)) {
          if (place.pincodes.map(p => String(p).trim()).includes(pinStr)) {
            groups.push(place.name);
            matchedOther = true;
          }
        }
      }
    });
    
    // Second pass: check 'transfer' explicit pincodes
    const transferPlace = placesConfig.find(p => p.name.toLowerCase() === 'transfer');
    if (transferPlace) {
      if (transferPlace.pincodes && Array.isArray(transferPlace.pincodes)) {
        if (transferPlace.pincodes.map(p => String(p).trim()).includes(pinStr)) {
          if (!groups.includes(transferPlace.name)) {
            groups.push(transferPlace.name);
          }
        }
      }
    }
  }
  
  // Fallback: if it matched nothing at all, it must go to 'transfer'
  if (groups.length === 0) {
    groups.push('transfer');
  }
  
  return groups;
}
