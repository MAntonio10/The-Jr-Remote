const { app, BrowserWindow, Tray, Menu, ipcMain, desktopCapturer, safeStorage, powerSaveBlocker, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const crypto = require('node:crypto');
const { handleInput } = require('./input');
const { createHelper } = require('./helper');
const { registerFileHandlers } = require('./files');
const { setLang, t } = require('./i18n');
const { repoUrl, checkUpdates } = require('./updates');

if (!app.requestSingleInstanceLock()) app.quit();

const ALPHABET = 'abcdefghjkmnpqrstuvwxyzACDEFGHJKLMNPQRTUVWXY34679'; // sin 0/O, 1/l/I, 5/S…
const newPassword = () => {
  const c = Array.from({ length: 8 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('');
  return `${c.slice(0, 4)}-${c.slice(4)}`;
};
const validPassword = (p) => typeof p === 'string' && p.length >= 8 && p.length <= 64;
const validServer = (s) => { try { const u = new URL(s); return ['ws:', 'wss:'].includes(u.protocol) && !!u.hostname; } catch { return false; } };

// Contraseñas y token cifrados en disco con DPAPI de Windows
const enc = (s) => (s && safeStorage.isEncryptionAvailable() ? 'enc:' + safeStorage.encryptString(s).toString('base64') : s);
const dec = (s) => (s?.startsWith('enc:') ? safeStorage.decryptString(Buffer.from(s.slice(4), 'base64')) : s);

let configFile, config, win, tray, quitting = false;

// Servicio SYSTEM para el escritorio protegido (UAC, bloqueo). Si no está instalado, reintenta en silencio.
// Mientras hay escritorio protegido: la entrada va al servicio y sus fotogramas (base64) se reenvían a cada The Jr.
const helper = createHelper({
  onSecure: (on) => win && win.webContents.send('helper:secure', on),
  onFrame: (jpeg) => win && win.webContents.send('helper:frame', jpeg.toString('base64')),
});

function loadConfig() {
  configFile = path.join(app.getPath('userData'), 'config.json');
  let c = {};
  try { c = JSON.parse(fs.readFileSync(configFile, 'utf8')); } catch {}
  c.server ??= ''; // vacío: la ventana pide la dirección del servidor la primera vez
  c.id ??= String(crypto.randomInt(100000000, 1000000000));
  c.token = dec(c.token) || crypto.randomBytes(32).toString('hex');
  c.password = dec(c.password) || newPassword();
  c.askBeforeAccept ??= false;
  c.lang ??= app.getLocale().startsWith('es') ? 'es' : 'en';
  setLang(c.lang);
  c.saved = (c.saved ?? []).map((d) => ({ ...d, password: dec(d.password) }));
  config = c;
  saveConfig();
}

function saveConfig() {
  const out = { ...config, token: enc(config.token), password: enc(config.password), saved: config.saved.map((d) => ({ ...d, password: enc(d.password) })) };
  fs.writeFileSync(configFile, JSON.stringify(out, null, 2));
}

const icon = path.join(__dirname, 'icon.ico'); // generado desde logo/the-jr.svg

const prefs = { preload: path.join(__dirname, 'preload.js'), backgroundThrottling: false };

function createMain() {
  win = new BrowserWindow({
    width: 780, height: 640, minWidth: 700, minHeight: 560, title: 'The Jr', autoHideMenuBar: true, icon,
    backgroundColor: '#F7F8F9', show: !process.argv.includes('--hidden'), webPreferences: prefs,
  });
  win.loadFile('index.html');
  if (!process.argv.includes('--hidden')) win.maximize(); // abrir a pantalla completa, no en ventana pequeña
  // Cerrar la ventana no apaga el agente: sigue en la bandeja
  win.on('close', (e) => { if (!quitting) { e.preventDefault(); win.hide(); } });
}

app.on('second-instance', () => win?.show());

app.whenReady().then(() => {
  loadConfig();
  registerFileHandlers();
  createMain();
  tray = new Tray(icon);
  tray.setToolTip('The Jr');
  trayMenu();
  tray.on('click', () => win.show());
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: true, args: ['--hidden'] });
  powerSaveBlocker.start('prevent-app-suspension'); // una PC suspendida no recibe conexiones
  helper.start();
});

app.on('window-all-closed', () => {}); // seguir en la bandeja

function trayMenu() {
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: t('trayOpen'), click: () => win.show() },
    { label: t('trayQuit'), click: () => { quitting = true; app.quit(); } },
  ]));
}

ipcMain.handle('config', () => ({ ...config, device: os.hostname() }));
ipcMain.handle('config:update', (_e, patch) => {
  for (const k of ['askBeforeAccept', 'saved']) if (k in patch) config[k] = patch[k];
  if (validServer(patch.server)) config.server = patch.server;
  if (['es', 'en'].includes(patch.lang)) {
    config.lang = patch.lang;
    setLang(patch.lang);
    trayMenu();
  }
  saveConfig();
  return { ...config, device: os.hostname() };
});

// ---------- Configuración: acerca de y actualizaciones ----------
let releaseUrl = null;
ipcMain.handle('about', () => ({ version: app.getVersion(), hasRepo: !!repoUrl }));
ipcMain.handle('updates:check', async () => {
  const r = await checkUpdates(app.getVersion());
  releaseUrl = r.url ?? null;
  return r;
});
// La ventana solo pide "abre el repositorio" o "abre la versión nueva"; las direcciones las decide este proceso
ipcMain.on('open:repo', () => repoUrl && shell.openExternal(repoUrl));
ipcMain.on('open:release', () => releaseUrl && shell.openExternal(releaseUrl));
ipcMain.handle('password:new', () => { config.password = newPassword(); saveConfig(); return config.password; });
ipcMain.handle('screen:source', async () => (await desktopCapturer.getSources({ types: ['screen'] }))[0]?.id);
ipcMain.on('window:show', () => { win.show(); win.focus(); }); // el permiso se pregunta dentro de la ventana
// Contraseña elegida por la persona: se valida aquí también porque la ventana no es de confianza
ipcMain.handle('password:set', (_e, p) => {
  if (!validPassword(p)) return null;
  config.password = p;
  saveConfig();
  return p;
});
// Con el servicio conectado, toda la entrada va por él (SYSTEM): así escribe también en ventanas de administrador
// y en el escritorio protegido. Sin servicio, cae a la inyección normal.
ipcMain.on('input', (_e, msg) => (helper.isUp() ? helper.send(msg) : handleInput(msg)));
ipcMain.on('session:active', (_e, active) => {
  tray.setToolTip(active ? t('trayActive') : 'The Jr');
  if (active) win.show();
  helper.setActive(active); // el servicio solo captura el escritorio protegido mientras hay sesión
});
ipcMain.on('session:open', (_e, target) => {
  const w = new BrowserWindow({
    width: 1280, height: 800, title: target.name || target.id, autoHideMenuBar: true, icon,
    backgroundColor: '#262D36', webPreferences: prefs,
  });
  w.loadFile('session.html', { query: { id: target.id, password: target.password, name: target.name || '' } });
});
