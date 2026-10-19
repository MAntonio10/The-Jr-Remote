// Conexión al servidor de señalización, con reconexión automática.
function connectSignal(url, onMessage, onState) {
  let ws, delay = 1000, closed = false;
  const open = () => {
    ws = new WebSocket(url);
    ws.onopen = () => { delay = 1000; onState(true); };
    ws.onmessage = (e) => onMessage(JSON.parse(e.data));
    ws.onclose = () => {
      onState(false);
      if (!closed) setTimeout(open, delay);
      delay = Math.min(delay * 2, 30000);
    };
  };
  open();
  return {
    send: (m) => ws.readyState === 1 && ws.send(JSON.stringify(m)),
    close: () => { closed = true; ws.close(); },
  };
}

const formatCode = (id) => String(id).replace(/(\d{3})(?=\d)/g, '$1 ');

function formatWhen(ts) {
  if (!ts) return t('whenLongAgo');
  const d = new Date(ts), time = d.toLocaleTimeString(getLang(), { hour: '2-digit', minute: '2-digit' });
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(ts).setHours(0, 0, 0, 0)) / 864e5);
  if (days === 0) return t('whenToday', { time });
  if (days === 1) return t('whenYesterday', { time });
  return t('whenDate', { date: d.toLocaleDateString(getLang(), { day: 'numeric', month: 'short' }), time });
}
