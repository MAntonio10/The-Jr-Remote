const test = require('node:test');
const assert = require('node:assert');
const os = require('node:os');
const path = require('node:path');
process.env.DB_FILE = path.join(os.tmpdir(), `agents-test-${process.pid}.json`);
const WebSocket = require('ws');
const { start } = require('./index');

function client(port) {
  const ws = new WebSocket(`ws://localhost:${port}`);
  const queue = [];
  const waiters = [];
  ws.on('message', (raw) => {
    const m = JSON.parse(raw);
    const w = waiters.shift();
    w ? w(m) : queue.push(m);
  });
  ws.next = () => (queue.length ? Promise.resolve(queue.shift()) : new Promise((r) => waiters.push(r)));
  ws.sendJson = (m) => ws.send(JSON.stringify(m));
  return ws;
}

test('registro, conexión con contraseña y reenvío de señales', async () => {
  const server = await start(0);
  const { port } = server.address();
  const token = 'x'.repeat(40);

  const agent = client(port);
  const hello = await agent.next();
  assert.equal(hello.t, 'hello');
  agent.sendJson({ t: 'register', id: '123456789', token });
  assert.equal((await agent.next()).t, 'registered');

  const thief = client(port);
  await thief.next();
  thief.sendJson({ t: 'register', id: '123456789', token: 'y'.repeat(40) });
  assert.equal((await thief.next()).code, 'id-taken');

  const ctrl = client(port);
  const ctrlHello = await ctrl.next();
  ctrl.sendJson({ t: 'status', id: '123456789' });
  assert.equal((await ctrl.next()).online, true);
  ctrl.sendJson({ t: 'connect', id: '000000000', password: 'x' });
  assert.equal((await ctrl.next()).reason, 'unknown');

  // Sin aceptar, las señales no pasan
  ctrl.sendJson({ t: 'signal', to: hello.sid, data: 'antes' });

  ctrl.sendJson({ t: 'connect', id: '123456789', password: 'secreta', device: 'Prueba' });
  const inc = await agent.next();
  assert.deepEqual([inc.t, inc.password, inc.from], ['incoming', 'secreta', ctrlHello.sid]);
  agent.sendJson({ t: 'accept', to: inc.from });
  const acc = await ctrl.next();
  assert.deepEqual([acc.t, acc.from], ['accepted', hello.sid]);

  ctrl.sendJson({ t: 'signal', to: acc.from, data: { sdp: 'oferta' } });
  const sig = await agent.next();
  assert.deepEqual([sig.t, sig.data.sdp], ['signal', 'oferta']);

  ctrl.close();
  assert.equal((await agent.next()).t, 'bye');

  [agent, thief].forEach((w) => w.close());
  server.close();
});

test('una IP no puede registrar códigos nuevos sin límite', async () => {
  const server = await start(0);
  const { port } = server.address();
  const ws = client(port);
  await ws.next();
  for (let i = 0; i < 5; i++) {
    ws.sendJson({ t: 'register', id: `20000000${i}`, token: 'z'.repeat(40) });
    assert.equal((await ws.next()).t, 'registered');
  }
  ws.sendJson({ t: 'register', id: '200000009', token: 'z'.repeat(40) });
  assert.equal((await ws.next()).code, 'too-many');
  const again = client(port); // un código ya conocido sí entra
  await again.next();
  again.sendJson({ t: 'register', id: '200000000', token: 'z'.repeat(40) });
  assert.equal((await again.next()).t, 'registered');
  [ws, again].forEach((w) => w.close());
  server.close();
});
