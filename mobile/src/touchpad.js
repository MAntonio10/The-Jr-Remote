// Touchpad: mueve el puntero de forma relativa, con aceleración (deslizar rápido llega más lejos).
// pos y el resultado van en fracción de la pantalla remota (0..1); dx, dy en puntos del teléfono; speed en puntos/ms.
export function padMove(pos, dx, dy, speed, video) {
  const gain = 2 + 4 * Math.min(speed, 1.5); // shortcut: aceleración fija, hacerla configurable si se siente lenta o brusca
  const clamp = (v) => Math.min(Math.max(v, 0), 1);
  return { x: clamp(pos.x + (dx * gain) / video.w), y: clamp(pos.y + (dy * gain) / video.h) };
}

// Zoom de la imagen: z = { s: escala, left, top } en puntos de la pantalla del teléfono.
// La imagen ampliada nunca deja huecos: sus bordes no pasan hacia adentro de la caja.
export const clampZoom = (z, box) => ({
  s: z.s,
  left: Math.min(0, Math.max(box.w - box.w * z.s, z.left)),
  top: Math.min(0, Math.max(box.h - box.h * z.s, z.top)),
});

// Pellizco: escala entre 1x y 4x alrededor del punto medio de los dedos, y lo arrastra con ellos
export function pinch(start, d0, d, m0, m, box) {
  const s = Math.min(Math.max((start.s * d) / d0, 1), 4);
  const k = s / start.s;
  return clampZoom({ s, left: m.x - (m0.x - start.left) * k, top: m.y - (m0.y - start.top) * k }, box);
}

// Punto tocado sobre la imagen ampliada -> punto en la imagen sin ampliar
export const unzoom = (p, z) => ({ x: (p.x - z.left) / z.s, y: (p.y - z.top) / z.s });

// Teclado: compara lo que había en el campo con lo nuevo -> cuántos borrados y qué texto enviar
export function typeDiff(prev, next) {
  let i = 0;
  while (i < prev.length && i < next.length && prev[i] === next[i]) i++;
  return { back: prev.length - i, text: next.slice(i) };
}
