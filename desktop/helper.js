// Cliente del servicio TheJrHelper (SYSTEM): captura e inyecta en el escritorio protegido (UAC, bloqueo).
// Si el servicio no está instalado, reintenta en silencio y todo sigue por el camino normal.
const net = require('node:net');

const PIPE = '\\\\.\\pipe\\TheJrHelper';

// Mensajes de la tubería: [tipo:1][largo:4 LE][datos]. Tipo 0 = JSON, 1 = JPEG.
function frame(type, data) {
  const h = Buffer.alloc(5);
  h[0] = type;
  h.writeUInt32LE(data.length, 1);
  return Buffer.concat([h, data]);
}

function parseFrames(buf) {
  const out = [];
  while (buf.length >= 5 && buf.length >= 5 + buf.readUInt32LE(1)) {
    const n = buf.readUInt32LE(1);
    out.push({ type: buf[0], data: buf.subarray(5, 5 + n) });
    buf = buf.subarray(5 + n);
  }
  return { frames: out, rest: buf };
}

function createHelper({ onSecure, onFrame, pipe = PIPE }) {
  let sock = null, buf = Buffer.alloc(0), secure = false, active = false;

  const send = (obj) => sock?.write(frame(0, Buffer.from(JSON.stringify(obj))));
  const sync = () => send({ t: 'frames', on: secure && active }); // video solo si hay sesión y escritorio protegido
  const setSecure = (v) => {
    if (v === secure) return;
    secure = v;
    onSecure(v);
    sync();
  };

  function connect() {
    const s = net.connect(pipe);
    s.on('connect', () => { sock = s; buf = Buffer.alloc(0); });
    s.on('data', (d) => {
      const r = parseFrames(Buffer.concat([buf, d]));
      buf = r.rest;
      for (const f of r.frames) {
        if (f.type === 1) onFrame(f.data);
        else try { setSecure(JSON.parse(f.data).desktop !== 'Default'); } catch {}
      }
    });
    s.on('error', () => {});
    s.on('close', () => {
      if (sock === s) sock = null;
      setSecure(false);
      setTimeout(connect, 2000).unref();
    });
  }

  return {
    start: connect,
    send,
    isUp: () => !!sock, // el servicio SYSTEM está conectado: puede inyectar en ventanas de administrador
    isSecure: () => secure,
    setActive: (a) => { active = a; sync(); },
  };
}

module.exports = { createHelper, parseFrames, frame };
