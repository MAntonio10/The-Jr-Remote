// Servidor de señalización: registra agentes, valida conexiones y reenvía mensajes WebRTC.
// En producción va detrás de nginx (TLS en el puerto 443), ver ../deploy.
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { WebSocketServer } = require('ws');

const TURN_SECRET = process.env.TURN_SECRET; // igual a static-auth-secret de coturn
const TURN_HOST = process.env.TURN_HOST; // p. ej. turn.tudominio.com
const PUBLIC_HOST = process.env.PUBLIC_HOST; // host de señalización (p. ej. remoto.tudominio.com): el relay 443 también se ofrece aquí
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'agents.json');
const MAX_CONNECTS_PER_MIN = 10;
const MAX_NEW_IDS_PER_HOUR = 5; // registros de códigos nuevos por IP
const MAX_STATUS_PER_MIN = 120;

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function iceServers(sid) {
  if (!TURN_SECRET || !TURN_HOST) return [{ urls: 'stun:stun.l.google.com:19302' }];
  // Credenciales temporales (TURN REST API): válidas 12 h
  const username = `${Math.floor(Date.now() / 1000) + 12 * 3600}:${sid}`;
  const credential = crypto.createHmac('sha1', TURN_SECRET).update(username).digest('base64');
  // turns 443: relay por TLS. Se ofrece también bajo el host de señalización (mismo 443, se
  // distingue por ALPN en nginx) porque algunos firewall filtran por nombre y solo dejan pasar ese.
  const tls = [`turns:${TURN_HOST}:443?transport=tcp`];
  if (PUBLIC_HOST && PUBLIC_HOST !== TURN_HOST) tls.push(`turns:${PUBLIC_HOST}:443?transport=tcp`);
  return [
    { urls: `stun:${TURN_HOST}:3478` },
    { urls: [`turn:${TURN_HOST}:3478?transport=udp`, ...tls], username, credential },
  ];
}

function start(port = 8080) {
  // id -> { tokenHash, lastSeen }; shortcut: archivo JSON, cambiar a SQLite si hay cientos de equipos
  let agents = {};
  try { agents = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch {}
  const save = () => fs.writeFile(DB_FILE, JSON.stringify(agents), () => {});

  const online = new Map(); // id del agente -> socket
  const sockets = new Map(); // sid -> socket
  const pairs = new Set(); // "sidA|sidB" autorizados a intercambiar señales
  const limits = new Map(); // "tipo|ip" -> { n, reset }
  const tooMany = (kind, ip, max, ms = 60000) => {
    const key = `${kind}|${ip}`, now = Date.now();
    let a = limits.get(key);
    if (!a || now > a.reset) limits.set(key, (a = { n: 0, reset: now + ms }));
    return ++a.n > max;
  };

  const send = (ws, msg) => ws && ws.readyState === 1 && ws.send(JSON.stringify(msg));
  const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

  const server = http.createServer((req, res) => res.end('ok'));
  const wss = new WebSocketServer({ server, maxPayload: 64 * 1024 });

  wss.on('connection', (ws, req) => {
    ws.sid = crypto.randomUUID();
    ws.ip = req.headers['x-real-ip'] || req.socket.remoteAddress;
    ws.alive = true;
    sockets.set(ws.sid, ws);
    ws.on('pong', () => (ws.alive = true));
    send(ws, { t: 'hello', sid: ws.sid, iceServers: iceServers(ws.sid) });

    ws.on('message', (raw) => {
      let m;
      try { m = JSON.parse(raw); } catch { return; }
      const id = typeof m.id === 'string' ? m.id : '';

      if (m.t === 'register') {
        if (!/^\d{9}$/.test(id) || typeof m.token !== 'string' || m.token.length < 32) return send(ws, { t: 'error', code: 'bad-register' });
        const rec = agents[id];
        if (rec && rec.tokenHash !== sha256(m.token)) return send(ws, { t: 'error', code: 'id-taken' });
        if (!rec && tooMany('register', ws.ip, MAX_NEW_IDS_PER_HOUR, 3600000)) return send(ws, { t: 'error', code: 'too-many' });
        agents[id] = { tokenHash: sha256(m.token), lastSeen: Date.now() };
        save();
        send(online.get(id), { t: 'error', code: 'replaced' });
        online.get(id)?.close();
        online.set(id, ws);
        ws.agentId = id;
        return send(ws, { t: 'registered', id });
      }

      if (m.t === 'status') {
        if (tooMany('status', ws.ip, MAX_STATUS_PER_MIN)) return;
        return send(ws, { t: 'status', id, online: online.has(id), lastSeen: agents[id]?.lastSeen ?? null });
      }

      if (m.t === 'connect') {
        if (tooMany('connect', ws.ip, MAX_CONNECTS_PER_MIN)) return send(ws, { t: 'rejected', reason: 'too-many' });
        const agent = online.get(id);
        if (!agent) return send(ws, { t: 'rejected', reason: agents[id] ? 'offline' : 'unknown', lastSeen: agents[id]?.lastSeen ?? null });
        // shortcut: la contraseña pasa por el servidor (cifrada por TLS); usar desafío HMAC si el servidor no es tuyo
        return send(agent, { t: 'incoming', from: ws.sid, password: String(m.password ?? ''), device: String(m.device ?? '').slice(0, 60) });
      }

      // Solo el agente responde a una solicitud entrante
      if ((m.t === 'accept' || m.t === 'reject') && ws.agentId) {
        const ctrl = sockets.get(m.to);
        if (!ctrl) return;
        if (m.t === 'accept') {
          pairs.add(pairKey(ws.sid, ctrl.sid));
          return send(ctrl, { t: 'accepted', from: ws.sid });
        }
        return send(ctrl, { t: 'rejected', reason: String(m.reason ?? 'denied') });
      }

      if ((m.t === 'signal' || m.t === 'bye') && pairs.has(pairKey(ws.sid, m.to))) {
        if (m.t === 'bye') pairs.delete(pairKey(ws.sid, m.to));
        return send(sockets.get(m.to), { t: m.t, from: ws.sid, data: m.data });
      }
    });

    ws.on('close', () => {
      sockets.delete(ws.sid);
      if (ws.agentId && online.get(ws.agentId) === ws) {
        online.delete(ws.agentId);
        agents[ws.agentId].lastSeen = Date.now();
        save();
      }
      for (const key of pairs) {
        const [a, b] = key.split('|');
        if (a !== ws.sid && b !== ws.sid) continue;
        pairs.delete(key);
        send(sockets.get(a === ws.sid ? b : a), { t: 'bye', from: ws.sid });
      }
    });
  });

  // Detecta conexiones muertas (los proxies corporativos cortan las inactivas)
  const timer = setInterval(() => {
    for (const [k, a] of limits) if (Date.now() > a.reset) limits.delete(k);
    for (const ws of wss.clients) {
      if (!ws.alive) { ws.terminate(); continue; }
      ws.alive = false;
      ws.ping();
    }
  }, 25000);
  server.on('close', () => clearInterval(timer));

  // HOST=127.0.0.1 en producción: solo nginx habla con este puerto
  return new Promise((resolve) => server.listen(port, process.env.HOST, () => resolve(server)));
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 8080;
  start(port).then(() => console.log(`Señalización escuchando en :${port}`));
}

module.exports = { start };
