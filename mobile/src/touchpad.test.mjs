import test from 'node:test';
import assert from 'node:assert';
import { padMove } from './touchpad.js';

const video = { w: 1000, h: 500 };

test('lento mueve poco, rápido mueve más', () => {
  const slow = padMove({ x: 0.5, y: 0.5 }, 10, 0, 0, video);
  const fast = padMove({ x: 0.5, y: 0.5 }, 10, 0, 2, video);
  assert.strictEqual(slow.x, 0.52);
  assert.ok(fast.x > slow.x);
});

test('no se sale de la pantalla', () => {
  assert.deepStrictEqual(padMove({ x: 0.99, y: 0.01 }, 500, -500, 1, video), { x: 1, y: 0 });
});

import { pinch, unzoom, typeDiff } from './touchpad.js';
const box = { w: 400, h: 200 };

test('pellizco: escala alrededor de los dedos sin dejar huecos y entre 1x y 4x', () => {
  const z = pinch({ s: 1, left: 0, top: 0 }, 100, 200, { x: 200, y: 100 }, { x: 200, y: 100 }, box);
  assert.deepStrictEqual(z, { s: 2, left: -200, top: -100 });
  assert.deepStrictEqual(unzoom({ x: 200, y: 100 }, z), { x: 200, y: 100 }); // el punto entre los dedos no se mueve
  assert.strictEqual(pinch(z, 100, 1000, { x: 0, y: 0 }, { x: 0, y: 0 }, box).s, 4);
  assert.deepStrictEqual(pinch(z, 100, 10, { x: 0, y: 0 }, { x: 0, y: 0 }, box), { s: 1, left: 0, top: 0 });
  assert.deepStrictEqual(pinch(z, 100, 100, { x: 0, y: 0 }, { x: 900, y: 900 }, box), { s: 2, left: 0, top: 0 });
});

test('teclado: solo envía lo que cambió', () => {
  assert.deepStrictEqual(typeDiff('hol', 'hola'), { back: 0, text: 'a' });
  assert.deepStrictEqual(typeDiff('hola', 'hol'), { back: 1, text: '' });
  assert.deepStrictEqual(typeDiff('qué tak', 'qué tal '), { back: 1, text: 'l ' });
  assert.deepStrictEqual(typeDiff('', ''), { back: 0, text: '' });
});
