const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  config: () => ipcRenderer.invoke('config'),
  update: (patch) => ipcRenderer.invoke('config:update', patch),
  newPassword: () => ipcRenderer.invoke('password:new'),
  setPassword: (p) => ipcRenderer.invoke('password:set', p),
  about: () => ipcRenderer.invoke('about'),
  checkUpdates: () => ipcRenderer.invoke('updates:check'),
  openRepo: () => ipcRenderer.send('open:repo'),
  openRelease: () => ipcRenderer.send('open:release'),
  screenSource: () => ipcRenderer.invoke('screen:source'),
  showWindow: () => ipcRenderer.send('window:show'),
  input: (msg) => ipcRenderer.send('input', msg),
  onSecure: (cb) => { ipcRenderer.removeAllListeners('helper:secure'); ipcRenderer.on('helper:secure', (_e, on) => cb(on)); },
  onFrame: (cb) => { ipcRenderer.removeAllListeners('helper:frame'); ipcRenderer.on('helper:frame', (_e, b64) => cb(b64)); },
  sessionActive: (active) => ipcRenderer.send('session:active', active),
  openSession: (target) => ipcRenderer.send('session:open', target),
  fileStart: (f) => ipcRenderer.send('file:start', { id: f.id, name: f.name, size: f.size }),
  fileChunk: (id, bytes) => ipcRenderer.send('file:chunk', id, bytes),
  fileEnd: (id) => ipcRenderer.send('file:end', id),
  fileAbort: (id) => ipcRenderer.send('file:abort', id),
  showFile: (file) => ipcRenderer.send('file:show', file),
  onFileSaved: (cb) => {
    ipcRenderer.removeAllListeners('file:saved'); // una sesión a la vez
    ipcRenderer.on('file:saved', (_e, info) => cb(info));
  },
});
