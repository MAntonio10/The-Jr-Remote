// Archivos en ambos sentidos por el canal "files":
// {t:'start', id, name, size} + trozos binarios + {t:'end', id}; quien recibe confirma con {t:'saved', id}.
const CHUNK = 16 * 1024;

// Soltar un archivo sobre la ventana no debe abrirlo en lugar de la app
for (const t of ['dragover', 'drop']) document.addEventListener(t, (e) => e.preventDefault());

function fileChannel(dc, show) {
  dc.binaryType = 'arraybuffer';
  dc.bufferedAmountLowThreshold = 64 * CHUNK;
  let incoming = null, queue = Promise.resolve();
  const sent = new Map(); // id -> nombre, esperando confirmación
  const running = (name, part) =>
    show.progress(t('fileRunning', { name, pct: Math.min(100, Math.floor(part * 100)) }));

  dc.onmessage = (e) => {
    if (typeof e.data !== 'string') {
      if (!incoming) return;
      incoming.got += e.data.byteLength;
      api.fileChunk(incoming.id, new Uint8Array(e.data));
      return running(incoming.name, incoming.got / incoming.size);
    }
    const m = JSON.parse(e.data);
    if (m.t === 'start') {
      incoming = { id: String(m.id), name: String(m.name), size: Math.max(Number(m.size) || 0, 1), got: 0 };
      api.fileStart(incoming);
      running(incoming.name, 0);
    } else if (m.t === 'end' && incoming?.id === m.id) {
      api.fileEnd(incoming.id);
      incoming = null;
    } else if (m.t === 'saved' && sent.has(m.id)) {
      show.progress(t('fileDelivered', { name: sent.get(m.id) }));
      sent.delete(m.id);
    }
  };
  dc.onclose = () => incoming && api.fileAbort(incoming.id);
  api.onFileSaved(({ id, file }) => {
    if (dc.readyState === 'open') dc.send(JSON.stringify({ t: 'saved', id }));
    show.saved(file);
  });

  const waitDrain = () => new Promise((r) => {
    dc.addEventListener('bufferedamountlow', r, { once: true });
    dc.addEventListener('close', r, { once: true });
  });

  return {
    send(file) {
      queue = queue.then(async () => {
        const id = crypto.randomUUID();
        sent.set(id, file.name);
        dc.send(JSON.stringify({ t: 'start', id, name: file.name, size: file.size }));
        running(file.name, 0);
        for (let off = 0; off < file.size; off += CHUNK) {
          if (dc.bufferedAmount > 256 * CHUNK) await waitDrain();
          if (dc.readyState !== 'open') throw new Error(t('connectionCut'));
          dc.send(await file.slice(off, off + CHUNK).arrayBuffer());
          running(file.name, (off + CHUNK) / file.size);
        }
        dc.send(JSON.stringify({ t: 'end', id }));
        show.progress(t('fileSaving', { name: file.name }));
      }).catch((e) => show.progress(t('fileFailed', { name: file.name, why: e.message })));
    },
  };
}
