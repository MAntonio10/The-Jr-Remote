import { Pressable, Text, View, StyleSheet } from 'react-native';
import { t } from './i18n';

export const C = {
  ink: '#1D2733', paper: '#F7F8F9', rack: '#E6E9EC', rule: '#D5DADF', muted: '#4E5A67',
  cable: '#D8A017', fault: '#B23A0E', night: '#262D36', idle: '#9AA4AE', line: '#8C96A1', soft: '#C9CFD5',
};
export const F = {
  regular: 'AtkinsonHyperlegibleNext_400Regular',
  bold: 'AtkinsonHyperlegibleNext_700Bold',
  mono: 'AtkinsonHyperlegibleMono_400Regular',
};

export function Button({ title, onPress, kind = 'primary', style, textStyle, ...rest }) {
  const k = styles[kind];
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.btn, k, pressed && { opacity: 0.7 }, style]} {...rest}>
      <Text style={[styles.btnText, kind === 'primary' && { color: '#fff' }, textStyle]}>{title}</Text>
    </Pressable>
  );
}

// Glifo corto de la ruta: punto — línea — punto (punteado y hueco si falla)
export function RouteDot({ fail }) {
  const c = fail ? C.fault : C.ink;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }} accessible={false}>
      <View style={[styles.dot, { backgroundColor: C.ink }]} />
      <View style={{ width: 16, borderTopWidth: 2.5, borderColor: c, borderStyle: fail ? 'dashed' : 'solid' }} />
      <View style={[styles.dot, fail ? { borderWidth: 2, borderColor: C.fault } : { backgroundColor: C.ink }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  btn: { minHeight: 48, paddingHorizontal: 18, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: C.ink, minHeight: 56 },
  ghost: { borderWidth: 1.5, borderColor: C.ink },
  btnText: { fontFamily: F.bold, fontSize: 17, color: C.ink },
  dot: { width: 8, height: 8, borderRadius: 4 },
});

export const formatCode = (id) => String(id ?? '').replace(/(\d{3})(?=\d)/g, '$1 ');

export function formatWhen(ts) {
  if (!ts) return t('whenLongAgo');
  const d = new Date(ts);
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(ts).setHours(0, 0, 0, 0)) / 864e5);
  if (days === 0) return t('whenToday', { time });
  if (days === 1) return t('whenYesterday', { time });
  return t('whenDate', { date: `${d.getDate()}/${d.getMonth() + 1}`, time });
}

// Conexión al servidor de señalización, con reconexión automática (igual que en desktop/signal.js)
export function connectSignal(url, onMessage, onState) {
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
