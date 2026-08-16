const { contextBridge, ipcRenderer } = require('electron');

// Expose safe, indexed IPC APIs to the React renderer process
contextBridge.exposeInMainWorld('api', {
  // SQLite Status API
  getDbStatus: () => ipcRenderer.invoke('db:get-status'),

  // SQLite Import API
  importCalls: (callsData) => ipcRenderer.invoke('db:import-calls', callsData),

  // SQLite Fetch Queries
  getPendingCalls: () => ipcRenderer.invoke('db:get-pending-calls'),
  getHistoryCalls: () => ipcRenderer.invoke('db:get-history-calls'),

  // Call Actions
  approveCall: (callId, note, phones, groupId, placeGroup) => ipcRenderer.invoke('db:approve-call', callId, note, phones, groupId, placeGroup),
  rejectCall: (callId) => ipcRenderer.invoke('db:reject-call', callId),
  updateCallData: (callId, note, phones, placeGroup) => ipcRenderer.invoke('db:update-call-data', callId, note, phones, placeGroup),
  getDuplicateHistory: (normalizedNumber, excludeCallId) => ipcRenderer.invoke('db:get-duplicate-history', normalizedNumber, excludeCallId),
  batchApproveCalls: (callIds, groupIdOrMap) => ipcRenderer.invoke('db:batch-approve-calls', callIds, groupIdOrMap),
  updateAllPlaceGroups: (placesConfig) => ipcRenderer.invoke('db:update-all-place-groups', placesConfig),

  // History Deletion APIs
  deleteHistoryCall: (callId) => ipcRenderer.invoke('db:delete-history-call', callId),
  clearAllHistory: () => ipcRenderer.invoke('db:clear-all-history'),
});
