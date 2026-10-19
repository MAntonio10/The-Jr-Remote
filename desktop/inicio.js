// Ventana principal: agente que recibe conexiones + formulario para conectarse a otro equipo.
const $ = (id) => document.getElementById(id);
let cfg, sig, ice = [], fails = 0, lockedUntil = 0, lastFile = null, passShown = false, screenStream = null;
const sessions = new Map(); // sid del The Jr -> { pc, files, device, time, dc }
const statuses = {}; // id guardado -> { online, lastSeen }

// Escritorio protegido: avisa a cada The Jr y le reenvía los fotogramas del servicio por el canal de entrada.
// shortcut: un fotograma grande puede pasar el límite del canal de datos (~256 KB); los diálogos de UAC y la pantalla de bloqueo comprimen bien. Trocear si aparece una pantalla protegida muy cargada.
const relay = (m) => sessions.forEach((x) => x.dc?.readyState === 'open' && x.dc.send(JSON.stringify(m)));
api.onSecure((on) => relay({ t: 'secure', on }));
api.onFrame((d) => relay({ t: 'img', d }));

(async () => {
  cfg = await api.config();
  setLang(cfg.lang);
  applyI18n();
  passToggle($('passShow'), $('pass'), false); // fija el ícono del ojo y su aria-label al idioma
  $('myId').textContent = formatCode(cfg.id);
  $('ask').checked = cfg.askBeforeAccept;
  renderSaved();
  if (cfg.server) connect();
  else { setStatus('setup'); openSettings(); } // primera vez: sin servidor no hay nada que hacer
  setInterval(refreshSaved, 30000);
})();

function connect() {
  sig?.close();
  sig = connectSignal(cfg.server, onSignal, (up) => !up && setStatus('down'));
}

function onSignal(m) {
  switch (m.t) {
    case 'hello': ice = m.iceServers; sig.send({ t: 'register', id: cfg.id, token: cfg.token }); break;
    case 'registered': setStatus('ok'); refreshSaved(); break;
    case 'error': setStatus(m.code); break;
    case 'status': statuses[m.id] = m; renderSaved(); break;
    case 'incoming': onIncoming(m); break;
    case 'signal': onRemoteSignal(m.from, m.data); break;
    case 'bye': endSession(m.from, false); break;
  }
}

// ---------- Estado del agente ----------
let state = 'down';
function setStatus(s) {
  state = s;
  const k = ['ok', 'down', 'id-taken', 'replaced', 'setup'].includes(s) ? s : 'down';
  const live = sessions.size > 0;
  $('stTitle').textContent = live ? t('inCharge') : t(`st_${k}`);
  $('stText').textContent = t(`st_${k}_text`, { host: cfg.server && new URL(cfg.server).host });
  $('seg1').className = 'seg ' + (s === 'ok' ? (live ? 'live' : 'ok') : 'fail');
  $('nodeServer').classList.toggle('fail', s !== 'ok');
  $('seg2').className = 'seg' + (live ? ' live' : '');
}

$('copy').onclick = async () => {
  await navigator.clipboard.writeText(`${t('code')}: ${formatCode(cfg.id)}\n${t('password')}: ${cfg.password}`);
  $('copy').textContent = t('copied');
  setTimeout(() => ($('copy').textContent = t('copyBoth')), 2000);
};
// Ícono de ojo / ojo tachado para el botón dentro del campo (clase "eye")
const EYE = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

// Botón para mostrar/ocultar una contraseña: texto "Mostrar" o, si tiene clase "eye", un ícono dentro del campo
function passToggle(btn, input, show = input.type === 'password') {
  input.type = show ? 'text' : 'password';
  btn.setAttribute('aria-pressed', show);
  if (btn.classList.contains('eye')) {
    btn.innerHTML = show ? EYE_OFF : EYE;
    btn.setAttribute('aria-label', t(show ? 'hide' : 'show'));
  } else {
    btn.textContent = t(show ? 'hide' : 'show');
  }
}
$('passShow').onclick = () => passToggle($('passShow'), $('pass'));
$('customShow').onclick = () => passToggle($('customShow'), $('customPass'));
function renderPass() {
  $('myPass').textContent = passShown ? cfg.password : '••••-••••';
  $('show').textContent = t(passShown ? 'hide' : 'show');
}
$('show').onclick = () => { passShown = !passShown; renderPass(); };
$('newPass').onclick = async () => {
  cfg.password = await api.newPassword();
  passShown = true;
  renderPass();
};
$('ask').onchange = async () => (cfg = await api.update({ askBeforeAccept: $('ask').checked }));
$('cut').onclick = () => [...sessions.keys()].forEach((sid) => endSession(sid, true));

// ---------- Archivos ----------
const fileUi = {
  progress: (text) => ($('fileInfo').textContent = text),
  saved: (file) => {
    lastFile = file;
    $('fileInfo').textContent = t('fileArrived', { name: file.split(/[\\/]/).pop() });
    $('showFile').hidden = false;
  },
};
$('sendFile').onclick = () => $('filePick').click();
$('filePick').onchange = () => {
  for (const f of $('filePick').files) for (const x of sessions.values()) x.files?.send(f); // a todos los The Jr
  $('filePick').value = '';
};
$('showFile').onclick = () => api.showFile(lastFile);

// ---------- Recibir una conexión ----------
async function onIncoming(m) {
  const reject = (reason) => sig.send({ t: 'reject', to: m.from, reason });
  if (Date.now() < lockedUntil) return reject('locked');
  if (sessions.has(m.from)) return reject('busy');
  if (m.password !== cfg.password) {
    if (++fails >= 5) { lockedUntil = Date.now() + 60000; fails = 0; }
    return reject('bad-password');
  }
  fails = 0;
  if (cfg.askBeforeAccept) {
    if ($('askDlg').open) return reject('busy'); // ya hay otra petición esperando respuesta
    if (!(await ask(m.device))) return reject('denied');
  }
  sig.send({ t: 'accept', to: m.from });
  startSession(m).catch((e) => { console.error(e); endSession(m.from, true); });
}

// Permiso con el diseño del programa; cerrar con Esc cuenta como rechazar
function ask(device) {
  api.showWindow();
  const d = $('askDlg');
  $('askDetail').textContent = t('askDetail', { device: device || t('askUnnamed') });
  d.returnValue = '';
  d.showModal();
  return new Promise((res) => d.addEventListener('close', () => res(d.returnValue === 'yes'), { once: true }));
}
$('askYes').onclick = () => $('askDlg').close('yes');
$('askNo').onclick = () => $('askDlg').close('no');

// Una sola captura de pantalla para todas las sesiones; se apaga cuando se va el último The Jr
async function shareScreen() {
  screenStream ??= (async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: await api.screenSource(), maxFrameRate: 30 } },
    });
    stream.getVideoTracks()[0].contentHint = 'detail'; // prioriza nitidez del texto sobre fluidez
    return stream;
  })();
  try {
    return await screenStream;
  } catch (e) {
    screenStream = null;
    throw e;
  }
}

async function startSession(m) {
  const pc = new RTCPeerConnection({ iceServers: ice });
  const me = { pc, files: null, device: m.device, time: null };
  sessions.set(m.from, me);
  pc.onicecandidate = (e) => e.candidate && sig.send({ t: 'signal', to: m.from, data: { candidate: e.candidate } });
  pc.onconnectionstatechange = () => ['failed', 'closed'].includes(pc.connectionState) && endSession(m.from, true);
  const dc = me.dc = pc.createDataChannel('input');
  dc.onmessage = (e) => api.input(JSON.parse(e.data));
  me.files = fileChannel(pc.createDataChannel('files'), fileUi);

  const stream = await shareScreen();
  if (sessions.get(m.from) !== me) return; // se cortó mientras tanto
  const [track] = stream.getVideoTracks();
  const sender = pc.addTrack(track, stream);
  // Menos latencia: techo de bitrate alto (el control de congestión usa menos si la red no da, así que no satura)
  // y ante congestión baja resolución antes que congelarse, para que el control se sienta fluido.
  try {
    const params = sender.getParameters();
    params.encodings = params.encodings?.length ? params.encodings : [{}];
    params.encodings[0].maxBitrate = 12_000_000;
    params.degradationPreference = 'maintain-framerate';
    await sender.setParameters(params);
  } catch (e) { console.error('sender params', e); }
  await pc.setLocalDescription();
  sig.send({ t: 'signal', to: m.from, data: { sdp: pc.localDescription } });

  me.time = new Date().toLocaleTimeString(getLang(), { hour: '2-digit', minute: '2-digit' });
  renderBand();
  $('band').hidden = false;
  setStatus(state);
  api.sessionActive(true);
}

function renderBand() {
  const live = [...sessions.values()].filter((x) => x.time);
  $('bandTitle').textContent = live.length > 1 ? t('bandTitleMany', { n: live.length }) : t('bandTitle');
  $('bandInfo').textContent = live.map((x) => t('bandInfo', { device: x.device || t('unnamedDevice'), time: x.time })).join('; ');
}

async function onRemoteSignal(from, data) {
  const pc = sessions.get(from)?.pc;
  if (!pc) return;
  try {
    if (data.sdp) await pc.setRemoteDescription(data.sdp);
    else if (data.candidate) await pc.addIceCandidate(data.candidate);
  } catch (e) { console.error(e); }
}

function endSession(from, notify) {
  const me = sessions.get(from);
  if (!me) return;
  sessions.delete(from);
  if (notify) sig.send({ t: 'bye', to: from });
  me.pc.close();
  api.input({ t: 'release' }); // suelta teclas o botones que hayan quedado presionados
  if (!sessions.size) {
    screenStream?.then((st) => st.getTracks().forEach((t) => t.stop()), () => {});
    screenStream = null;
    $('fileInfo').textContent = '';
    $('showFile').hidden = true;
    $('band').hidden = true;
    api.sessionActive(false);
  }
  renderBand();
  setStatus(state);
}

// ---------- Conectar a otro equipo ----------
$('code').oninput = () => ($('code').value = formatCode($('code').value.replace(/\D/g, '').slice(0, 9)));
$('form').addEventListener('input', () => ($('formError').hidden = true)); // el aviso se va al corregir

$('form').onsubmit = async (e) => {
  e.preventDefault();
  const id = $('code').value.replace(/\D/g, ''), password = $('pass').value, name = $('name').value.trim();
  if (!id && !password) return; // Enter con el formulario vacío (p. ej. desde el teclado de The Jr): nada que avisar
  const error = !cfg.server ? t('needServer') : id.length !== 9 ? t('errCode') : !password ? t('errPass') : '';
  $('formError').textContent = error;
  $('formError').hidden = !error;
  if (error) return;
  if (name) {
    cfg = await api.update({ saved: [...cfg.saved.filter((d) => d.id !== id), { id, password, name }] });
    renderSaved();
    refreshSaved();
  }
  api.openSession({ id, password, name });
  $('form').reset();
  passToggle($('passShow'), $('pass'), false);
};

function refreshSaved() {
  for (const d of cfg.saved) sig?.send({ t: 'status', id: d.id });
}

function renderSaved() {
  const ul = $('saved');
  ul.replaceChildren();
  if (!cfg.saved.length) {
    ul.append(Object.assign(document.createElement('li'), { className: 'empty', textContent: t('emptySaved') }));
    return;
  }
  for (const d of cfg.saved) {
    const st = statuses[d.id];
    const li = document.createElement('li');
    li.innerHTML = `<div class="info"><span class="name"></span><span class="line"><span class="dot"><i></i></span><span class="muted"></span><span class="st"></span></span></div>
      <button class="ghost connect"></button><button class="ghost remove"></button>`;
    li.querySelector('.connect').textContent = t('connect');
    li.querySelector('.remove').textContent = t('remove');
    li.querySelector('.name').textContent = d.name;
    li.querySelector('.muted').textContent = formatCode(d.id);
    const text = !st ? t('querying') : st.online ? t('ready') : t('noReplySince', { when: formatWhen(st.lastSeen) });
    li.querySelector('.st').textContent = text;
    if (st && !st.online) {
      li.querySelector('.dot').classList.add('fail');
      li.querySelector('.st').classList.add('fail-text');
    }
    li.querySelector('.connect').onclick = () => api.openSession(d);
    li.querySelector('.remove').onclick = async () => {
      cfg = await api.update({ saved: cfg.saved.filter((x) => x.id !== d.id) });
      renderSaved();
    };
    ul.append(li);
  }
}

// ---------- Configuración ----------
$('openSettings').onclick = openSettings;
async function openSettings() {
  const about = await api.about();
  $('lang').value = getLang();
  $('version').textContent = t('version', { v: about.version });
  $('repo').hidden = !about.hasRepo;
  $('noRepo').hidden = about.hasRepo;
  $('checkUpd').disabled = !about.hasRepo; // sin repositorio no hay dónde buscar
  $('customPass').value = '';
  passToggle($('customShow'), $('customPass'), false);
  $('customInfo').textContent = t('customHint');
  $('customInfo').classList.remove('fail-text');
  $('serverUrl').value = cfg.server || 'wss://';
  $('serverInfo').textContent = t('serverHint');
  $('serverInfo').classList.remove('fail-text');
  $('settings').showModal();
}
$('serverSave').onclick = async () => {
  const url = $('serverUrl').value.trim().replace(/\/$/, '');
  const prev = cfg.server;
  cfg = await api.update({ server: url });
  const ok = cfg.server === url; // el proceso principal descarta direcciones inválidas
  $('serverInfo').textContent = ok ? t('serverSaved', { host: new URL(url).host }) : t('errAddress');
  $('serverInfo').classList.toggle('fail-text', !ok);
  if (!ok || url === prev) return;
  for (const k in statuses) delete statuses[k]; // los estados eran del servidor anterior
  renderSaved();
  connect();
};
$('customSave').onclick = async () => {
  const p = $('customPass').value;
  const ok = p.length >= 8 && p.length <= 64;
  const saved = ok && (await api.setPassword(p));
  $('customInfo').textContent = t(saved ? 'passSaved' : 'passTooShort');
  $('customInfo').classList.toggle('fail-text', !saved);
  if (!saved) return;
  cfg.password = saved;
  $('customPass').value = '';
  passShown = true;
  renderPass();
};
$('closeSettings').onclick = () => $('settings').close();
$('repo').onclick = () => api.openRepo();
$('download').onclick = () => api.openRelease();

// Cambiar de idioma sin recargar la ventana: recargarla cortaría una sesión abierta
$('lang').onchange = async () => {
  cfg = await api.update({ lang: $('lang').value });
  setLang(cfg.lang);
  applyI18n();
  setStatus(state);
  renderPass();
  passToggle($('passShow'), $('pass'), false);
  passToggle($('customShow'), $('customPass'), false);
  renderBand();
  renderSaved();
  $('version').textContent = t('version', { v: (await api.about()).version });
  $('updInfo').textContent = '';
  $('download').hidden = true;
};

$('checkUpd').onclick = async () => {
  $('checkUpd').disabled = true;
  $('download').hidden = true;
  $('updInfo').textContent = t('checking');
  const r = await api.checkUpdates();
  $('updInfo').textContent = t(`upd_${r.state}`, r);
  $('download').hidden = r.state !== 'new';
  $('checkUpd').disabled = r.state === 'no-repo';
};
