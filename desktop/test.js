const test = require('node:test');
const assert = require('node:assert');
const { Key } = require('@nut-tree-fork/nut-js');
const { toKey, inputQueue } = require('./input');
const Module = require('node:module');
// files.js importa electron; fuera de Electron basta un sustituto
const realLoad = Module._load;
Module._load = (req, ...rest) => (req === 'electron' ? {} : realLoad(req, ...rest));
const { safeName } = require('./files');
const { isNewer } = require('./updates');
const { STRINGS, setLang, t } = require('./i18n');

test('compara versiones como números, no como texto', () => {
  assert.equal(isNewer('v1.10.0', '1.9.2'), true);
  assert.equal(isNewer('1.0.1', '1.0.0'), true);
  assert.equal(isNewer('1.0.0', '1.0.0'), false);
  assert.equal(isNewer('v0.9.0', '1.0.0'), false);
  assert.equal(isNewer('1.1', '1.0.9'), true);
  assert.equal(isNewer('2.0.0-beta.1', '1.5.0'), true);
});

test('español e inglés tienen las mismas claves y las variables se reemplazan', () => {
  assert.deepEqual(Object.keys(STRINGS.en).sort(), Object.keys(STRINGS.es).sort());
  setLang('en');
  assert.equal(t('version', { v: '1.2.3' }), 'Version 1.2.3');
  setLang('xx'); // idioma desconocido -> español
  assert.equal(t('askMessage'), 'The Jr pide permiso para poseer tu equipo');
});

test('los nombres de archivo recibidos no pueden salir de la carpeta', () => {
  assert.equal(safeName('..\\..\\Windows\\system32\\x.dll'), 'x.dll');
  assert.equal(safeName('../../etc/passwd'), 'passwd');
  assert.equal(safeName('informe: final?.pdf'), 'informe_ final_.pdf');
  assert.equal(safeName('nombre. '), 'nombre');
  assert.equal(safeName(''), 'archivo');
  assert.equal(safeName('..'), 'archivo');
});

test('KeyboardEvent.code se traduce a teclas de nut-js', () => {
  assert.equal(toKey('KeyA'), Key.A);
  assert.equal(toKey('Digit7'), Key.Num7);
  assert.equal(toKey('Numpad3'), Key.NumPad3);
  assert.equal(toKey('ArrowLeft'), Key.Left);
  assert.equal(toKey('ControlLeft'), Key.LeftControl);
  assert.equal(toKey('MetaLeft'), Key.LeftWin);
  assert.equal(toKey('F5'), Key.F5);
  assert.equal(toKey('Semicolon'), Key.Semicolon); // la ñ en teclado español
  assert.equal(toKey('Inventada'), undefined);
});

test('los move en espera se juntan en el último sin cambiar el orden', async () => {
  const done = [];
  const q = inputQueue(async (m) => done.push(m.n));
  [{ t: 'move', n: 1 }, { t: 'move', n: 2 }, { t: 'down', n: 3 }, { t: 'move', n: 4 }, { t: 'move', n: 5 }, { t: 'up', n: 6 }].forEach(q);
  await new Promise((r) => setTimeout(r, 20));
  q({ t: 'move', n: 7 });
  await new Promise((r) => setTimeout(r, 20));
  assert.deepStrictEqual(done, [2, 3, 5, 6, 7]);
});
