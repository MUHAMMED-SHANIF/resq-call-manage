import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  initDb, 
  importCalls, 
  getPendingCalls, 
  getHistoryCalls, 
  approveCall, 
  rejectCall, 
  updateCallData, 
  getDuplicateHistory,
  getCallById,
  getPhoneNumbersForCall,
  getDbStatus,
  updateAllPlaceGroups,
  batchApproveCalls
} from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    title: 'Call Distribution Dashboard',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

// ----------------------------------------------------
// IPC Query Handlers Setup
// ----------------------------------------------------

// SQLite status check
ipcMain.handle('db:get-status', async () => {
  return getDbStatus();
});

// Excel Batch Import
ipcMain.handle('db:import-calls', async (event, callsData) => {
  try {
    importCalls(callsData);
    return { success: true };
  } catch (err) {
    console.error('IPC db:import-calls error:', err);
    throw err;
  }
});

// Fetching lists
ipcMain.handle('db:get-pending-calls', async () => {
  return getPendingCalls();
});

ipcMain.handle('db:get-history-calls', async () => {
  return getHistoryCalls();
});

// Update data (Remark and Phones list)
ipcMain.handle('db:update-call-data', async (event, callId, note, phones) => {
  try {
    updateCallData(callId, note, phones);
    return { success: true };
  } catch (err) {
    console.error('IPC db:update-call-data error:', err);
    throw err;
  }
});

// Check number history
ipcMain.handle('db:get-duplicate-history', async (event, normalizedNumber) => {
  return getDuplicateHistory(normalizedNumber);
});

// Helper: Formats call object to standard copy text / WhatsApp message layout
function formatCallMessage(call, phones) {
  const formattedPhones = phones.filter(p => p.trim() !== '').join(', ');
  const lines = [
    `Request Start: ${call.request_start || '—'}`,
    `Id: ${call.request_id || '—'}`,
    call.order_type || '—',
    call.sold_to_party || '—'
  ];

  if (call.notes && call.notes.trim() !== '') {
    lines.push(call.notes.trim());
  }

  if (formattedPhones.trim() !== '') {
    lines.push(`Phone: ${formattedPhones}`);
  }

  lines.push(call.brand_name || '—');
  lines.push(call.product_description || '—');

  if (call.up_flag === 1) {
    lines.push('up');
  }

  return lines.join('\n');
}

// Single Call Approve
ipcMain.handle('db:approve-call', async (event, callId, note, phones, groupId, placeGroup) => {
  try {
    // Write the card changes (Remarks + Phones) and set status = approved
    // placeGroup is forwarded to approveCall which handles it internally in the DB module
    approveCall(callId, note, phones, placeGroup);
    return { success: true };
  } catch (err) {
    console.error('IPC db:approve-call error:', err);
    throw err;
  }
});

// Batch Approve All Calls
ipcMain.handle('db:batch-approve-calls', async (event, callIds) => {
  try {
    batchApproveCalls(callIds);
    return { success: true };
  } catch (err) {
    console.error('IPC db:batch-approve-calls error:', err);
    throw err;
  }
});

// Single Call Reject / Delete
ipcMain.handle('db:reject-call', async (event, callId) => {
  try {
    rejectCall(callId);
    return { success: true };
  } catch (err) {
    console.error('IPC db:reject-call error:', err);
    throw err;
  }
});

// Update all place groups dynamically in the DB
ipcMain.handle('db:update-all-place-groups', async (event, placesConfig) => {
  try {
    updateAllPlaceGroups(placesConfig);
    return { success: true };
  } catch (err) {
    console.error('IPC db:update-all-place-groups error:', err);
    throw err;
  }
});

// ----------------------------------------------------
// App Lifecycle events
// ----------------------------------------------------
app.whenReady().then(() => {
  // Initialize SQLite database & create schemas first
  initDb();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
