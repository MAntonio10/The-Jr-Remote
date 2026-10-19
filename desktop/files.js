// Guarda en Descargas\The Jr los archivos que llegan por la sesión (proceso principal).
const { app, ipcMain, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

// Solo el nombre, sin rutas ni caracteres que Windows no acepta
function safeName(name) {
  const base = path.win32.basename(String(name ?? '')).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/, '');
  return base.slice(0, 150) || 'archivo';
}

function uniquePath(dir, name) {
  const { name: stem, ext } = path.parse(name);
  let file = path.join(dir, name);
  for (let n = 1; fs.existsSync(file); n++) file = path.join(dir, `${stem} (${n})${ext}`);
  return file;
}

function registerFileHandlers() {
  const dir = path.join(app.getPath('downloads'), 'The Jr');
  const incoming = new Map(); // id -> { stream, file, size, got }

  const abort = (id) => {
    const f = incoming.get(id);
    if (!f) return;
    incoming.delete(id);
    f.stream.destroy();
    fs.rm(f.file, { force: true }, () => {});
  };

  ipcMain.on('file:start', (_e, { id, name, size }) => {
    fs.mkdirSync(dir, { recursive: true });
    const file = uniquePath(dir, safeName(name));
    incoming.set(id, { stream: fs.createWriteStream(file), file, size: Number(size) || 0, got: 0 });
  });
  ipcMain.on('file:chunk', (_e, id, bytes) => {
    const f = incoming.get(id);
    if (!f) return;
    f.got += bytes.byteLength;
    if (f.got > f.size) return abort(id); // más datos de los anunciados
    f.stream.write(Buffer.from(bytes));
  });
  ipcMain.on('file:end', (e, id) => {
    const f = incoming.get(id);
    if (!f) return;
    incoming.delete(id);
    f.stream.end(() => !e.sender.isDestroyed() && e.sender.send('file:saved', { id, file: f.file }));
  });
  ipcMain.on('file:abort', (_e, id) => abort(id));
  ipcMain.on('file:show', (_e, file) => String(file).startsWith(dir + path.sep) && shell.showItemInFolder(file));
}

module.exports = { registerFileHandlers, safeName };
