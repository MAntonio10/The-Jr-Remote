// Inyecta en Windows el mouse y el teclado que llegan del equipo que controla.
const { mouse, keyboard, screen, Key, Button, Point } = require('@nut-tree-fork/nut-js');

mouse.config.autoDelayMs = 0;
keyboard.config.autoDelayMs = 0;

// KeyboardEvent.code -> nombre de tecla en nut-js (lo que no está aquí se deduce en toKey)
const KEYS = {
  Enter: 'Enter', NumpadEnter: 'Enter', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
  BracketLeft: 'LeftBracket', BracketRight: 'RightBracket', Backquote: 'Grave', ContextMenu: 'Menu', PrintScreen: 'Print',
  ShiftLeft: 'LeftShift', ShiftRight: 'RightShift', ControlLeft: 'LeftControl', ControlRight: 'RightControl',
  AltLeft: 'LeftAlt', AltRight: 'RightAlt', MetaLeft: 'LeftWin', MetaRight: 'RightWin',
  NumpadAdd: 'Add', NumpadSubtract: 'Subtract', NumpadMultiply: 'Multiply', NumpadDivide: 'Divide', NumpadDecimal: 'Decimal',
};
const toKey = (code) =>
  Key[KEYS[code] ?? String(code).replace(/^Key/, '').replace(/^Digit/, 'Num').replace(/^Numpad(\d)$/, 'NumPad$1')];

const BUTTONS = [Button.LEFT, Button.MIDDLE, Button.RIGHT];
const MODS = new Set(['LeftShift', 'RightShift', 'LeftControl', 'RightControl', 'LeftAlt', 'RightAlt']);
const held = new Set(); // teclas y botones presionados, para soltarlos si se corta la sesión
let size = null;
let chain = Promise.resolve();

const clamp = (v) => Math.min(Math.max(Number(v) || 0, 0), 1);

async function run(m) {
  if (m.t === 'release') {
    for (const h of held) await (typeof h === 'string' ? keyboard.releaseKey(Key[h]) : mouse.releaseButton(h));
    held.clear();
    size = null;
    return;
  }
  if ('x' in m) {
    size ??= [await screen.width(), await screen.height()];
    await mouse.setPosition(new Point(Math.round(clamp(m.x) * (size[0] - 1)), Math.round(clamp(m.y) * (size[1] - 1))));
  }
  const b = BUTTONS[m.b] ?? Button.LEFT;
  switch (m.t) {
    case 'down': held.add(b); return mouse.pressButton(b);
    case 'up': held.delete(b); return mouse.releaseButton(b);
    case 'click': return mouse.click(b);
    case 'wheel': {
      // Unidades de Windows: 120 = un paso de rueda
      const amount = Math.min(Math.abs(Math.round(Number(m.dy) || 0)), 2400);
      return m.dy > 0 ? mouse.scrollDown(amount) : mouse.scrollUp(amount);
    }
    case 'key': {
      const k = toKey(m.code);
      if (k === undefined) return;
      m.down ? held.add(Key[k]) : held.delete(Key[k]);
      return m.down ? keyboard.pressKey(k) : keyboard.releaseKey(k);
    }
    case 'combo': {
      const keys = (Array.isArray(m.codes) ? m.codes : []).map(toKey).filter((k) => k !== undefined);
      if (!keys.length) return;
      await keyboard.pressKey(...keys);
      return keyboard.releaseKey(...keys);
    }
    case 'text': {
      // Shift o AltGr sostenidos cambiarían el carácter: se sueltan mientras se teclea y se vuelven a presionar
      const mods = [...held].filter((h) => MODS.has(h)).map((h) => Key[h]);
      if (mods.length) await keyboard.releaseKey(...mods);
      await keyboard.type(String(m.s ?? '').slice(0, 500));
      if (mods.length) await keyboard.pressKey(...mods);
      return;
    }
  }
}

// En orden: si dos eventos se ejecutan a la vez, un "soltar" puede llegar antes que su "presionar".
// Los "move" seguidos que aún esperan turno se juntan en el último, para que no se acumule retraso.
function inputQueue(exec) {
  let slot = null;
  const enqueue = (fn, m) => (chain = chain.then(fn).catch((e) => console.error('input', m.t, e.message)));
  return (m) => {
    if (!m || typeof m.t !== 'string') return;
    if (m.t !== 'move') { slot = null; return enqueue(() => exec(m), m); }
    if (slot) { slot.m = m; return; }
    const mine = (slot = { m });
    enqueue(() => { if (slot === mine) slot = null; return exec(mine.m); }, m);
  };
}

const handleInput = inputQueue(run);

module.exports = { handleInput, inputQueue, toKey };
