// Archivos en ambos sentidos por el canal "files" (mismo protocolo que desktop/transfer.js):
// {t:'start', id, name, size} + trozos binarios + {t:'end', id}; quien recibe confirma con {t:'saved', id}.
import { Directory, File, Paths } from 'expo-file-system';
import { t } from './i18n';

const CHUNK = 16 * 1024;
const safeName = (name) =>
  String(name ?? '').split(/[\\/]/).pop().replace(/[<>:"|?*\x00-\x1f]/g, '_').replace(/[. ]+$/, '').slice(0, 150) || 'archivo';

export function fileChannel(dc, show) {
  dc.binaryType = 'arraybuffer';
  dc.bufferedAmountLowThreshold = 64 * CHUNK;
  let incoming = null, queue = Promise.resolve();
  const sent = new Map(); // id -> nombre, esperando confirmación
  const running = (name, part) =>
    show.progress(t('fileRunning', { name, pct: Math.min(100, Math.floor(part * 100)) }));

  const drop = () => {
    if (!incoming) return;
    incoming.handle.close();
    incoming.file.delete();
    incoming = null;
  };

  dc.onmessage = (e) => {
    if (typeof e.data !== 'string') {
      if (!incoming) return;
      incoming.got += e.data.byteLength;
      if (incoming.got > incoming.size) return drop(); // más datos de los anunciados
      incoming.handle.writeBytes(new Uint8Array(e.data));
      return running(incoming.name, incoming.got / Math.max(incoming.size, 1));
    }
    const m = JSON.parse(e.data);
    if (m.t === 'start') {
      drop();
      const dir = new Directory(Paths.cache, 'the-jr');
      if (!dir.exists) dir.create();
      const name = safeName(m.name);
      const file = new File(dir, name);
      if (file.exists) file.delete();
      file.create();
      incoming = { id: String(m.id), name, size: Number(m.size) || 0, got: 0, file, handle: file.open() };
      running(name, 0);
    } else if (m.t === 'end' && incoming?.id === m.id) {
      const { id, name, file, handle } = incoming;
      handle.close();
      incoming = null;
      dc.send(JSON.stringify({ t: 'saved', id }));
      show.saved(file.uri, name);
    } else if (m.t === 'saved' && sent.has(m.id)) {
      show.progress(t('fileDelivered', { name: sent.get(m.id) }));
      sent.delete(m.id);
    }
  };
  dc.onclose = drop;

  const waitDrain = () => new Promise((r) => {
    dc.addEventListener('bufferedamountlow', r, { once: true });
    dc.addEventListener('close', r, { once: true });
  });

  return {
    // file: un File de expo-file-system (por ejemplo, el de File.pickFileAsync)
    send(file) {
      const name = file.name;
      queue = queue.then(async () => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const size = file.size;
        sent.set(id, name);
        dc.send(JSON.stringify({ t: 'start', id, name, size }));
        running(name, 0);
        const handle = file.open();
        try {
          for (let off = 0; off < size; off += CHUNK) {
            if (dc.bufferedAmount > 256 * CHUNK) await waitDrain();
            if (dc.readyState !== 'open') throw new Error(t('connectionCut'));
            dc.send(handle.readBytes(Math.min(CHUNK, size - off)));
            running(name, (off + CHUNK) / size);
          }
        } finally {
          handle.close();
        }
        dc.send(JSON.stringify({ t: 'end', id }));
        show.progress(t('fileSaving', { name }));
      }).catch((e) => show.progress(t('fileFailed', { name, why: e.message })));
    },
  };
}
