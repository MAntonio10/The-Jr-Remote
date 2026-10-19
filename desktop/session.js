// Ventana de sesión: muestra la pantalla del otro equipo y le envía mouse y teclado.
const $ = (id) => document.getElementById(id);
const q = new URLSearchParams(location.search);
const target = { id: q.get('id'), password: q.get('password'), name: q.get('name') };
let sig, pc, dc, files, lastFile, agentSid = null, ended = false;

$('retry').onclick = () => location.reload();

// Cada motivo dice qué tramo de la ruta falló (0 ninguno, 1 servidor, 2 equipo); los textos son fail_<motivo> y fail_<motivo>_how
const FAILS = { server: 1, unknown: 2, offline: 2, 'bad-password': 0, locked: 0, 'too-many': 1, denied: 0, busy: 0, media: 2, ended: 0 };

function route(seg1, seg2, failNode) {
  $('seg1').className = 'seg ' + seg1;
  $('seg2').className = 'seg ' + seg2;
  $('nodeServer').classList.toggle('fail', failNode === 1);
  $('nodeRemote').classList.toggle('fail', failNode === 2);
}

function showStep(text, seg1 = '', seg2 = '') {
  $('why').textContent = text;
  $('how').textContent = '';
  route(seg1, seg2);
}

function fail(reason, lastSeen) {
  if (ended) return;
  ended = true;
  const r = reason in FAILS ? reason : 'ended', where = FAILS[r];
  $('why').textContent = r === 'offline' ? t('offlineWhy', { name: target.name, when: formatWhen(lastSeen) }) : t(`fail_${r}`);
  $('how').textContent = t(`fail_${r}_how`);
  route(where === 1 ? 'fail' : 'ok', where === 2 ? 'fail' : where === 1 ? '' : 'ok', where);
  $('retry').hidden = false;
  $('panel').hidden = false;
  $('bar').hidden = $('stage').hidden = $('fileBar').hidden = true;
  if (document.fullscreenElement) document.exitFullscreen();
  pc?.close();
  sig?.close();
  if (reason === 'server' || reason === 'media') setTimeout(() => location.reload(), 5000);
}

(async () => {
  const cfg = await api.config();
  setLang(cfg.lang);
  applyI18n();
  target.name ||= t('deviceName', { code: formatCode(target.id) });
  document.title = $('title').textContent = $('remoteName').textContent = target.name;
  const serverTimeout = setTimeout(() => fail('server'), 10000);
  sig = connectSignal(cfg.server, onSignal, (up) => up && clearTimeout(serverTimeout));

  function onSignal(m) {
    switch (m.t) {
      case 'hello':
        if (agentSid) return; // reconexión durante la sesión: WebRTC sigue por su cuenta
        pc ??= createPeer(m.iceServers);
        sig.send({ t: 'connect', id: target.id, password: target.password, device: cfg.device });
        return showStep(t('searching', { name: target.name }), 'ok');
      case 'rejected': return fail(m.reason, m.lastSeen);
      case 'accepted': agentSid = m.from; return showStep(t('waitingImage'), 'ok', 'ok');
      case 'signal': return onRemoteSignal(m.data);
      case 'bye': return fail('ended');
    }
  }

  function createPeer(iceServers) {
    const p = new RTCPeerConnection({ iceServers });
    p.onicecandidate = (e) => e.candidate && agentSid && sig.send({ t: 'signal', to: agentSid, data: { candidate: e.candidate } });
    p.ontrack = (e) => {
      // Mínimo colchón de reproducción = menos retraso de video (Chromium)
      try { if (e.receiver && 'playoutDelayHint' in e.receiver) e.receiver.playoutDelayHint = 0; } catch {}
      $('video').srcObject = e.streams[0];
      $('panel').hidden = true;
      $('bar').hidden = $('stage').hidden = false;
      $('video').focus();
    };
    p.ondatachannel = (e) => (e.channel.label === 'files' ? (files = fileChannel(e.channel, fileUi)) : (dc = e.channel, dc.onmessage = onSecureFrame));
    p.onconnectionstatechange = () => p.connectionState === 'failed' && fail('media');
    return p;
  }

  async function onRemoteSignal(data) {
    try {
      if (data.sdp) {
        await pc.setRemoteDescription(data.sdp);
        await pc.setLocalDescription();
        sig.send({ t: 'signal', to: agentSid, data: { sdp: pc.localDescription } });
      } else if (data.candidate) await pc.addIceCandidate(data.candidate);
    } catch (e) { console.error(e); }
  }

  $('cut').onclick = () => { sig.send({ t: 'bye', to: agentSid }); window.close(); };
  setInterval(showNetwork, 2000);
})();

// ---------- Calidad de la conexión ----------
async function showNetwork() {
  if (!pc || $('bar').hidden) return;
  const stats = await pc.getStats();
  let pair;
  stats.forEach((s) => { if (s.type === 'transport' && s.selectedCandidatePairId) pair = stats.get(s.selectedCandidatePairId); });
  if (!pair) return;
  const relay = stats.get(pair.localCandidateId)?.candidateType === 'relay';
  const ms = Math.round((pair.currentRoundTripTime ?? 0) * 1000);
  $('net').textContent = t(relay ? 'netRelay' : 'netDirect', { ms });
}

// Escritorio protegido (UAC, bloqueo): el video se congela, así que se muestra encima la imagen del servicio SYSTEM
function onSecureFrame(e) {
  const m = JSON.parse(e.data);
  if (m.t === 'img') {
    $('secure').src = 'data:image/jpeg;base64,' + m.d;
    $('secure').hidden = false;
  } else if (m.t === 'secure' && !m.on) hideSecureWhenLive();
}

// Al salir del escritorio protegido, mantiene el último cuadro hasta que el video en vivo vuelva, para que no parpadee en negro
function hideSecureWhenLive() {
  const v = $('video');
  const hide = () => { $('secure').hidden = true; };
  if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(hide);
  else setTimeout(hide, 800);
}

// ---------- Mouse y teclado ----------
const video = $('video');
const send = (m) => dc?.readyState === 'open' && dc.send(JSON.stringify(m));

function pos(e) {
  // Con object-fit: contain quedan bandas; se calcula el área real de la imagen
  const r = video.getBoundingClientRect();
  const s = Math.min(r.width / video.videoWidth, r.height / video.videoHeight);
  const w = video.videoWidth * s, h = video.videoHeight * s;
  return { x: (e.clientX - r.left - (r.width - w) / 2) / w, y: (e.clientY - r.top - (r.height - h) / 2) / h };
}

video.addEventListener('mousemove', (e) => send({ t: 'move', ...pos(e) }));
video.addEventListener('mousedown', (e) => { video.focus(); send({ t: 'down', b: e.button, ...pos(e) }); });
video.addEventListener('mouseup', (e) => send({ t: 'up', b: e.button, ...pos(e) }));
video.addEventListener('contextmenu', (e) => e.preventDefault());
video.addEventListener('wheel', (e) => { e.preventDefault(); send({ t: 'wheel', dy: e.deltaY * 1.2 }); }, { passive: false });
// Lo que escribe una tecla viaja como texto y El Senior lo teclea con su propia distribución: los teclados pueden ser distintos.
// Los atajos (Ctrl+Z…) van por la letra, no por la posición; una tecla muerta (´) espera al carácter compuesto (é).
const sent = new Map(); // e.code -> código que se mandó al presionar (null si fue texto), para soltar lo mismo
video.addEventListener('keydown', (e) => {
  e.preventDefault();
  if (e.key === 'Dead') return;
  const chord = (e.ctrlKey || e.altKey || e.metaKey) && !e.getModifierState('AltGraph');
  if ([...e.key].length === 1 && !chord) { sent.set(e.code, null); return send({ t: 'text', s: e.key }); }
  const code = chord && /^[a-z]$/i.test(e.key) ? 'Key' + e.key.toUpperCase() : e.code;
  sent.set(e.code, code);
  send({ t: 'key', code, down: true });
});
video.addEventListener('keyup', (e) => {
  e.preventDefault();
  if (e.key === 'Dead') return;
  const code = sent.has(e.code) ? sent.get(e.code) : e.code;
  sent.delete(e.code);
  if (code) send({ t: 'key', code, down: false });
});
// Si cambias de ventana con una tecla presionada, la otra PC no se queda con ella pegada
window.addEventListener('blur', () => { sent.clear(); send({ t: 'release' }); });

function setMode(fit) {
  $('stage').classList.toggle('fit', fit);
  $('fit').setAttribute('aria-pressed', fit);
  $('real').setAttribute('aria-pressed', !fit);
}
$('fit').onclick = () => setMode(true);
$('real').onclick = () => setMode(false);
$('full').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : $('stage').requestFullscreen());
// ---------- Archivos ----------
const fileUi = {
  progress: (text) => { $('fileBar').hidden = false; $('fileInfo').textContent = text; },
  saved: (file) => {
    lastFile = file;
    fileUi.progress(t('fileArrived', { name: file.split(/[\\/]/).pop() }));
    $('showFile').hidden = false;
  },
};
$('sendFile').onclick = () => $('filePick').click();
$('filePick').onchange = () => {
  for (const f of $('filePick').files) files?.send(f);
  $('filePick').value = '';
};
$('stage').addEventListener('drop', (e) => [...e.dataTransfer.files].forEach((f) => files?.send(f)));
$('showFile').onclick = () => api.showFile(lastFile);
$('win').onclick = () => { send({ t: 'combo', codes: ['MetaLeft'] }); video.focus(); };
