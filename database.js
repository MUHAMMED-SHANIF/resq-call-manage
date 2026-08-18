import initSqlJs from 'sql.js';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';
import { normalizePhoneNumber } from './src/utils/phoneNormalizer.js';
import { getGroupsForPincodeDynamic } from './src/config.js';

let SQL;
let sqlDb;
let dbPath;
let dbError = null;
let isInTransaction = false; // Track active transaction to avoid redundant saveDb() calls

class Statement {
  constructor(sql) {
    this.sql = sql;
  }

  run(...params) {
    const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    // Map undefined to null to avoid SQL serialization errors
    const cleanParams = flatParams.map(val => val === undefined ? null : val);
    sqlDb.run(this.sql, cleanParams);
    // Only persist to disk if NOT inside an active transaction
    // (saves happen at COMMIT time; saving mid-transaction would export uncommitted state)
    if (!isInTransaction) {
      saveDb();
    }
    return { changes: 1, lastInsertRowid: 0 };
  }

  get(...params) {
    const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    const cleanParams = flatParams.map(val => val === undefined ? null : val);
    const stmt = sqlDb.prepare(this.sql);
    let result = null;
    try {
      stmt.bind(cleanParams);
      if (stmt.step()) {
        result = stmt.getAsObject();
      }
    } finally {
      stmt.free();
    }
    if (result && Object.keys(result).length === 0) {
      return null;
    }
    return result;
  }

  all(...params) {
    const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    const cleanParams = flatParams.map(val => val === undefined ? null : val);
    const stmt = sqlDb.prepare(this.sql);
    const results = [];
    try {
      stmt.bind(cleanParams);
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
    } finally {
      stmt.free();
    }
    return results;
  }
}

class SQLiteWrapper {
  prepare(sql) {
    return new Statement(sql);
  }

  exec(sql) {
    sqlDb.run(sql);
    if (!isInTransaction) {
      saveDb();
    }
  }

  transaction(fn) {
    return (...args) => {
      sqlDb.run("BEGIN TRANSACTION");
      isInTransaction = true;
      try {
        const result = fn(...args);
        sqlDb.run("COMMIT");
        isInTransaction = false;
        saveDb(); // Only save once after successful commit
        return result;
      } catch (err) {
        isInTransaction = false;
        // sql.js auto-rolls-back internally when a SQL error occurs inside a transaction.
        // Calling ROLLBACK again would throw "no transaction is active" — suppress that
        // secondary error and re-throw the original to avoid confusing the caller.
        try {
          sqlDb.run("ROLLBACK");
        } catch (rollbackErr) {
          console.warn('[Database] Rollback suppressed (already rolled back by sql.js):', rollbackErr.message);
        }
        throw err;
      }
    };
  }
}

const db = new SQLiteWrapper();

function saveDb() {
  try {
    const data = sqlDb.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  } catch (err) {
    console.error('[Database] Persisting to disk failed:', err);
  }
}

/**
 * Checks database loading status.
 */
export function getDbStatus() {
  return { initialized: !!sqlDb, error: dbError };
}

/**
 * Initializes the call-distribution.db SQLite file and schemas.
 */
export async function initDb() {
  dbPath = path.join(app.getPath('userData'), 'call-distribution.db');
  
  // Ensure the app directory exists
  const appDataDir = path.dirname(dbPath);
  if (!fs.existsSync(appDataDir)) {
    fs.mkdirSync(appDataDir, { recursive: true });
  }

  try {
    SQL = await initSqlJs();
    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath);
      sqlDb = new SQL.Database(fileBuffer);
    } else {
      sqlDb = new SQL.Database();
    }
  } catch (err) {
    dbError = err.message;
    console.error('[Database] Failed to load sql.js WASM or database file:', err);
    return;
  }
  
  try {
    // 1. Create the new schema without the UNIQUE constraint on request_id
    db.exec(`
      CREATE TABLE IF NOT EXISTS calls_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id TEXT, 
        order_type TEXT,
        sold_to_party TEXT,
        brand_name TEXT,
        product_description TEXT,
        pincode TEXT,
        place_group TEXT,
        notes TEXT,
        request_start TEXT,
        created_on TEXT DEFAULT (datetime('now', 'localtime')),
        up_flag INTEGER,
        status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
        approved_date TEXT,
        rejected_date TEXT,
        whatsapp_status TEXT CHECK(whatsapp_status IN ('not_sent', 'sending', 'sent', 'failed')) DEFAULT 'not_sent',
        sent_at TEXT,
        imported_at TEXT DEFAULT (datetime('now', 'localtime')),
        original_status TEXT,
        warranty_status TEXT,
        amount TEXT
      );
    `);

    // 2. Check if old calls table exists and if it has a unique constraint
    // We can infer the old table needs migration if calls exists but calls_v2 is empty
    const checkV2 = sqlDb.exec("SELECT count(*) as cnt FROM calls_v2");
    if (checkV2.length === 0 || checkV2[0].values[0][0] === 0) {
      const checkOld = sqlDb.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='calls'");
      if (checkOld.length > 0) {
        console.log('[Database] Migrating schema to remove UNIQUE constraint on request_id...');
        db.exec("PRAGMA foreign_keys = OFF;");
        db.exec("INSERT INTO calls_v2 (id, request_id, order_type, sold_to_party, brand_name, product_description, pincode, place_group, notes, request_start, created_on, up_flag, status, approved_date, rejected_date, whatsapp_status, sent_at, imported_at) SELECT id, request_id, order_type, sold_to_party, brand_name, product_description, pincode, place_group, notes, request_start, created_on, up_flag, status, approved_date, rejected_date, whatsapp_status, sent_at, imported_at FROM calls;");
        db.exec("DROP TABLE calls;");
        db.exec("PRAGMA foreign_keys = ON;");
      }
    }

    // Ensure the table is named calls
    const checkFinal = sqlDb.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='calls'");
    if (checkFinal.length === 0) {
      db.exec("ALTER TABLE calls_v2 RENAME TO calls;");
    } else {
      // If calls exists but calls_v2 also exists and we already migrated, drop calls_v2
      db.exec("DROP TABLE IF EXISTS calls_v2;");
    }


    // Run column migration checks for older databases
    const columns = db.prepare("PRAGMA table_info(calls)").all();
    const colNames = columns.map(c => c.name.toLowerCase());

    const migrations = [
      { name: 'approved_date', def: 'ALTER TABLE calls ADD COLUMN approved_date TEXT' },
      { name: 'rejected_date', def: 'ALTER TABLE calls ADD COLUMN rejected_date TEXT' },
      { name: 'whatsapp_status', def: "ALTER TABLE calls ADD COLUMN whatsapp_status TEXT CHECK(whatsapp_status IN ('not_sent', 'sending', 'sent', 'failed')) DEFAULT 'not_sent'" },
      { name: 'sent_at', def: 'ALTER TABLE calls ADD COLUMN sent_at TEXT' },
      { name: 'imported_at', def: "ALTER TABLE calls ADD COLUMN imported_at TEXT DEFAULT (datetime('now', 'localtime'))" },
      { name: 'original_status', def: 'ALTER TABLE calls ADD COLUMN original_status TEXT' },
      { name: 'warranty_status', def: 'ALTER TABLE calls ADD COLUMN warranty_status TEXT' },
      { name: 'amount', def: 'ALTER TABLE calls ADD COLUMN amount TEXT' }
    ];

    for (const m of migrations) {
      if (!colNames.includes(m.name.toLowerCase())) {
        console.log(`[Database] Migrating: Adding missing column ${m.name}`);
        db.exec(m.def);
      }
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS phone_numbers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        call_id INTEGER REFERENCES calls(id) ON DELETE CASCADE,
        raw_input TEXT,
        normalized_number TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE INDEX IF NOT EXISTS idx_phone_numbers_normalized ON phone_numbers(normalized_number);

      CREATE TABLE IF NOT EXISTS duplicate_flags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        normalized_number TEXT,
        matched_call_id INTEGER REFERENCES calls(id),
        flagged_call_id INTEGER REFERENCES calls(id),
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      );

      CREATE INDEX IF NOT EXISTS idx_duplicate_flags_normalized ON duplicate_flags(normalized_number);
    `);
  } catch (err) {
    dbError = err.message;
    console.error('[Database] Schema execution or migration failed:', err);
  }
}

/**
 * Bulk imports parsed rows from an Excel file into the SQLite DB.
 * It uses a transaction to ensure fast writes and maps unassigned pincodes to 'transfer'.
 */
export function importCalls(calls) {
  const now = db.prepare(`SELECT datetime('now', 'localtime') as t`).get().t;

  const findCall = db.prepare(`SELECT id, status FROM calls WHERE request_id = ? LIMIT 1`);
  
  const updatePendingCall = db.prepare(`
    UPDATE calls SET
      order_type = ?,
      sold_to_party = ?,
      brand_name = ?,
      product_description = ?,
      pincode = ?,
      place_group = ?,
      request_start = ?,
      up_flag = ?,
      original_status = ?,
      imported_at = ?
    WHERE id = ?
  `);

  const updateImportedAt = db.prepare(`UPDATE calls SET imported_at = ? WHERE id = ?`);

  const insertCall = db.prepare(`
    INSERT INTO calls (request_id, order_type, sold_to_party, brand_name, product_description, pincode, place_group, request_start, up_flag, status, original_status, imported_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `);

  const deletePhones = db.prepare(`DELETE FROM phone_numbers WHERE call_id = ?`);
  const insertPhone = db.prepare(`
    INSERT INTO phone_numbers (call_id, raw_input, normalized_number)
    VALUES (?, ?, ?)
  `);

  const transaction = db.transaction((rows) => {
    for (const row of rows) {
      const existingCall = findCall.get(row.serviceOrder);
      let targetCallId = null;

      if (existingCall) {
        targetCallId = existingCall.id;
        if (existingCall.status === 'pending') {
          // Update the existing pending call
          updatePendingCall.run(
            row.orderType,
            row.soldToParty,
            row.brandName,
            row.productDescription,
            row.pincode,
            row.groups.join(','),
            row.createdOn,
            row.cityBifurcation.toLowerCase().trim() === 'up1' ? 1 : 0,
            row.originalStatus || null,
            now,
            targetCallId
          );
          // Clear previous phone numbers for this pending call to avoid duplicates on re-import
          deletePhones.run(targetCallId);
        } else {
          // It's in history (approved/rejected). Just update imported_at so it shows in current batch.
          updateImportedAt.run(now, targetCallId);
          targetCallId = null; // Do not clear/insert phones since it's locked
        }
      } else {
        // Insert a new pending call
        insertCall.run(
          row.serviceOrder,
          row.orderType,
          row.soldToParty,
          row.brandName,
          row.productDescription,
          row.pincode,
          row.groups.join(','),
          row.createdOn,
          row.cityBifurcation.toLowerCase().trim() === 'up1' ? 1 : 0,
          'pending',
          row.originalStatus || null,
          now
        );
        const newCall = db.prepare(`SELECT id FROM calls WHERE request_id = ? ORDER BY id DESC LIMIT 1`).get(row.serviceOrder);
        targetCallId = newCall.id;
      }

      // Extract phone number from Sold to Party if present
      if (targetCallId) {
        const phoneMatch = String(row.soldToParty).match(/\b([6-9]\d{9})\b/);
        if (phoneMatch) {
          const rawPhone = phoneMatch[1];
          const normPhone = normalizePhoneNumber(rawPhone);
          if (normPhone.length === 10) {
            insertPhone.run(targetCallId, rawPhone, normPhone);
          }
        }
      }
    }
  });

  transaction(calls);
  
  // Re-calculate duplicate flags globally after import
  rebuildDuplicateFlags();
}

/**
 * Re-scans the DB and builds the duplicate_flags lookup index.
 */
function rebuildDuplicateFlags() {
  db.exec(`DELETE FROM duplicate_flags`);
  
  const dups = db.prepare(`
    SELECT p1.normalized_number, p1.call_id as matched_call_id, p2.call_id as flagged_call_id
    FROM phone_numbers p1
    JOIN phone_numbers p2 ON p1.normalized_number = p2.normalized_number AND p1.call_id < p2.call_id
    WHERE p1.normalized_number != ''
  `).all();

  const insertFlag = db.prepare(`
    INSERT INTO duplicate_flags (normalized_number, matched_call_id, flagged_call_id)
    VALUES (?, ?, ?)
  `);

  const transaction = db.transaction((flags) => {
    for (const f of flags) {
      insertFlag.run(f.normalized_number, f.matched_call_id, f.flagged_call_id);
    }
  });
  
  transaction(dups);
}

/**
 * Loads pending call records with associated phone lists and duplicate indicators.
 */
export function getPendingCalls() {
  const rows = db.prepare(`
    SELECT 
      c.id,
      c.status,
      c.request_id as serviceOrder,
      c.order_type as orderType,
      c.sold_to_party as soldToParty,
      c.brand_name as brandName,
      c.product_description as productDescription,
      c.pincode,
      c.place_group as placeGroup,
      c.notes as notes,
      c.request_start as createdOn,
      c.up_flag as upFlag,
      c.whatsapp_status as whatsappStatus,
      c.original_status as originalStatus,
      c.warranty_status as warrantyStatus,
      c.amount as amount,
      (
        SELECT GROUP_CONCAT(pn.raw_input, ', ')
        FROM phone_numbers pn
        WHERE pn.call_id = c.id
      ) as phoneNumbers,
      (
        SELECT pn.raw_input
        FROM phone_numbers pn
        JOIN phone_numbers other ON other.normalized_number = pn.normalized_number AND other.call_id != pn.call_id
        JOIN calls other_call ON other.call_id = other_call.id
        WHERE pn.call_id = c.id AND pn.normalized_number != ''
        LIMIT 1
      ) as duplicateNumberTrigger
    FROM calls c
    WHERE c.status = 'pending' OR c.imported_at = (SELECT MAX(imported_at) FROM calls)
    ORDER BY c.imported_at DESC
  `).all();

  return rows.map(r => ({
    id: r.id,
    status: r.status,
    serviceOrder: r.serviceOrder,
    orderType: r.orderType,
    soldToParty: r.soldToParty,
    brandName: r.brandName,
    productDescription: r.productDescription,
    pincode: r.pincode,
    groups: r.placeGroup ? r.placeGroup.split(',') : [],
    notes: r.notes || '',
    createdOn: r.createdOn,
    cityBifurcation: r.upFlag === 1 ? 'up1' : 'Local',
    phoneNumbers: r.phoneNumbers || '',
    isDuplicate: r.duplicateNumberTrigger !== null,
    duplicateNumberTrigger: r.duplicateNumberTrigger,
    whatsappStatus: r.whatsappStatus,
    originalStatus: r.originalStatus || '',
    warrantyStatus: r.warrantyStatus || null,
    amount: r.amount || ''
  }));
}

/**
 * Updates the warranty status for a call (in/out/null).
 */
export function updateWarrantyStatus(callId, warrantyStatus) {
  db.prepare(`UPDATE calls SET warranty_status = ? WHERE id = ?`).run(
    warrantyStatus || null,
    callId
  );
}

/**
 * Updates the amount field for a call.
 */
export function updateAmount(callId, amount) {
  db.prepare(`UPDATE calls SET amount = ? WHERE id = ?`).run(
    amount || null,
    callId
  );
}

/**
 * Loads both approved and rejected call records (unified history) with notes and phone numbers.
 */
export function getHistoryCalls() {
  const rows = db.prepare(`
    SELECT 
      c.id,
      c.request_id,
      c.order_type,
      c.sold_to_party,
      c.brand_name,
      c.product_description,
      c.pincode,
      c.place_group,
      c.notes,
      c.request_start,
      c.status,
      c.approved_date,
      c.rejected_date,
      c.whatsapp_status,
      c.sent_at,
      COALESCE(
        (
          SELECT GROUP_CONCAT(pn.raw_input, ', ')
          FROM phone_numbers pn
          WHERE pn.call_id = c.id
        ),
        ''
      ) as phone_numbers
    FROM calls c
    WHERE c.status IN ('approved', 'rejected')
    ORDER BY COALESCE(c.approved_date, c.rejected_date) DESC
  `).all();

  // Sanitize null values from sql.js so they never render as the string "null" in the UI
  return rows.map(r => ({
    ...r,
    notes: r.notes || '',
    phone_numbers: r.phone_numbers || '',
    place_group: r.place_group || '',
    request_start: r.request_start || '',
  }));
}

/**
 * Live updates remarks and phone list inputs for a card, re-indexing duplicate checks.
 */
export function updateCallData(callId, note, phones) {
  // Wrap the data writes in a single transaction
  const writeData = db.transaction(() => {
    // Update notes column
    db.prepare(`UPDATE calls SET notes = ? WHERE id = ?`).run(note, callId);

    // Clear previous linked phone numbers
    db.prepare(`DELETE FROM phone_numbers WHERE call_id = ?`).run(callId);
    
    const insertPhone = db.prepare(`
      INSERT INTO phone_numbers (call_id, raw_input, normalized_number)
      VALUES (?, ?, ?)
    `);

    for (const p of phones) {
      if (p !== undefined && p !== null) {
        const norm = p.trim() !== '' ? normalizePhoneNumber(p) : '';
        insertPhone.run(callId, p, norm);
      }
    }
  });

  writeData();
}

/**
 * Approves a call atomically: saves notes/phones, sets status=approved, updates place_group.
 * rebuildDuplicateFlags() runs after commit to avoid nested transactions.
 */
export function approveCall(callId, note, phones, placeGroup) {
  // Write notes, phones, status, and place_group in one atomic transaction
  const doApprove = db.transaction(() => {
    // Update notes
    db.prepare(`UPDATE calls SET notes = ? WHERE id = ?`).run(note, callId);

    // Clear and re-insert phone numbers
    db.prepare(`DELETE FROM phone_numbers WHERE call_id = ?`).run(callId);
    const insertPhone = db.prepare(`INSERT INTO phone_numbers (call_id, raw_input, normalized_number) VALUES (?, ?, ?)`);
    for (const p of phones) {
      if (p && p.trim() !== '') {
        const norm = normalizePhoneNumber(p);
        insertPhone.run(callId, p, norm);
      }
    }

    // Mark as approved
    db.prepare(`
      UPDATE calls 
      SET status = 'approved', approved_date = datetime('now', 'localtime') 
      WHERE id = ?
    `).run(callId);

    // Update place group if provided
    if (placeGroup) {
      db.prepare(`UPDATE calls SET place_group = ? WHERE id = ?`).run(placeGroup, callId);
    }
  });

  doApprove();
}

/**
 * Approves multiple calls in a single transaction (batch approve).
 */
export function batchApproveCalls(callIds) {
  const runBatch = db.transaction(() => {
    const stmt = db.prepare(`
      UPDATE calls 
      SET status = 'approved', approved_date = datetime('now', 'localtime') 
      WHERE id = ?
    `);
    for (const id of callIds) {
      stmt.run(id);
    }
  });
  runBatch();
}

/**
 * Rejects a call, setting status and rejected date.
 */
export function rejectCall(callId) {
  db.prepare(`
    UPDATE calls 
    SET status = 'rejected', rejected_date = datetime('now', 'localtime') 
    WHERE id = ?
  `).run(callId);
}

/**
 * Fetches call history of a specific phone number for duplicate checking.
 */
export function getDuplicateHistory(normalizedNumber, excludeCallId) {
  let query = `
    SELECT 
      c.request_id,
      c.brand_name,
      c.product_description,
      c.status,
      c.notes,
      c.approved_date,
      c.rejected_date,
      c.created_on
    FROM calls c
    JOIN phone_numbers pn ON pn.call_id = c.id
    WHERE pn.normalized_number = ?
  `;
  const params = [normalizedNumber];

  if (excludeCallId) {
    query += ` AND c.id != ?`;
    params.push(excludeCallId);
  }

  query += ` ORDER BY COALESCE(c.approved_date, c.rejected_date, c.created_on) DESC`;

  return db.prepare(query).all(...params);
}

/**
 * Updates WhatsApp send status and logs timestamps.
 */
export function updateWhatsAppStatus(callId, status, sentAt = null) {
  if (sentAt) {
    db.prepare(`
      UPDATE calls 
      SET whatsapp_status = ?, sent_at = ? 
      WHERE id = ?
    `).run(status, sentAt, callId);
  } else {
    db.prepare(`
      UPDATE calls 
      SET whatsapp_status = ? 
      WHERE id = ?
    `).run(status, callId);
  }
}

/**
 * Fetches a single call record by its ID.
 */
export function getCallById(id) {
  return db.prepare(`SELECT * FROM calls WHERE id = ?`).get(id);
}

/**
 * Fetches list of raw phone number strings for a call.
 */
export function getPhoneNumbersForCall(callId) {
  return db.prepare(`SELECT raw_input FROM phone_numbers WHERE call_id = ?`).all(callId).map(p => p.raw_input);
}

/**
 * Re-evaluates and updates all place groups in the SQLite DB based on dynamic places config.
 */
export function updateAllPlaceGroups(placesConfig) {
  const runUpdates = db.transaction(() => {
    const allCalls = db.prepare(`SELECT id, pincode FROM calls`).all();
    const updateCallGroup = db.prepare(`UPDATE calls SET place_group = ? WHERE id = ?`);

    for (const call of allCalls) {
      const groups = getGroupsForPincodeDynamic(call.pincode, placesConfig);
      updateCallGroup.run(groups.join(','), call.id);
    }
  });

  runUpdates();
}

/**
 * Permanently deletes a single history record (approved or rejected) and its phone numbers.
 * Only allowed if the record is in 'approved' or 'rejected' status.
 */
export function deleteHistoryCall(callId) {
  const call = db.prepare(`SELECT id, status FROM calls WHERE id = ?`).get(callId);
  if (!call) throw new Error(`Call ${callId} not found.`);
  if (!['approved', 'rejected'].includes(call.status)) {
    throw new Error(`Call ${callId} is not in history (status: ${call.status}). Only approved/rejected calls can be deleted from history.`);
  }

  const doDelete = db.transaction(() => {
    db.prepare(`DELETE FROM phone_numbers WHERE call_id = ?`).run(callId);
    db.prepare(`DELETE FROM duplicate_flags WHERE matched_call_id = ? OR flagged_call_id = ?`).run(callId, callId);
    db.prepare(`DELETE FROM calls WHERE id = ?`).run(callId);
  });

  doDelete();
}

/**
 * Permanently wipes ALL approved and rejected call records and their associated data.
 * This is a destructive, irreversible operation.
 */
export function clearAllHistory() {
  const doClear = db.transaction(() => {
    // Get all approved/rejected call IDs
    const historicIds = db.prepare(`SELECT id FROM calls WHERE status IN ('approved', 'rejected')`).all().map(r => r.id);

    if (historicIds.length === 0) return 0;

    // Remove associated phone numbers and duplicate flags
    for (const id of historicIds) {
      db.prepare(`DELETE FROM phone_numbers WHERE call_id = ?`).run(id);
      db.prepare(`DELETE FROM duplicate_flags WHERE matched_call_id = ? OR flagged_call_id = ?`).run(id, id);
    }

    // Delete all historic call rows
    db.prepare(`DELETE FROM calls WHERE status IN ('approved', 'rejected')`).run();

    return historicIds.length;
  });

  return doClear();
}

