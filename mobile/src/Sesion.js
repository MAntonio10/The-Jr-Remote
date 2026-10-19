import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Keyboard, PanResponder, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { RTCPeerConnection, RTCView } from 'react-native-webrtc';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useKeepAwake } from 'expo-keep-awake';
import * as Sharing from 'expo-sharing';
import { Button, C, F, connectSignal, formatWhen } from './ui';
import { fileChannel } from './files';
import { padMove, pinch, unzoom, typeDiff } from './touchpad';
import { t } from './i18n';

// Tramo que falla por motivo (0 ninguno, 1 servidor, 2 equipo); los textos son fail_<motivo> y fail_<motivo>_how
const FAILS = { server: 1, unknown: 2, offline: 2, 'bad-password': 0, locked: 0, 'too-many': 1, denied: 0, busy: 0, media: 2, ended: 0 };

// Letra o número -> KeyboardEvent.code, para combinarlo con Ctrl/Alt
const charCode = (ch) => (/^[a-z]$/i.test(ch) ? 'Key' + ch.toUpperCase() : /^\d$/.test(ch) ? 'Digit' + ch : ch === ' ' ? 'Space' : null);

export default function Sesion({ target, server, onExit }) {
  useKeepAwake();
  const name = target.name || t('deviceName', { code: target.id });
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState('connecting'); // connecting | live | failed
  const [step, setStep] = useState({ why: t('connectingYourServer'), how: '', seg1: '', seg2: '', failNode: 0 });
  const [streamURL, setStreamURL] = useState(null);
  // Escritorio protegido (UAC, bloqueo): doble búfer para que no parpadee: la capa anterior se ve mientras la nueva decodifica
  const [sec, setSec] = useState({ cur: null, prev: null });
  const [net, setNet] = useState('');
  const [mods, setMods] = useState([]); // modificadores en espera: 'ControlLeft', 'AltLeft'
  const [text, setText] = useState('');
  const [arrows, setArrows] = useState(false); // la zona del touchpad muestra flechas
  const [typing, setTyping] = useState(false); // teclado abierto: se muestra lo escrito
  const [fileText, setFileText] = useState('');
  const [received, setReceived] = useState(null); // { uri, name } del último archivo que llegó
  const zoomAnim = useRef({ s: new Animated.Value(1), left: new Animated.Value(0), top: new Animated.Value(0) }).current;
  const r = useRef({ video: { w: 16, h: 9 }, box: { w: 1, h: 1 }, pos: { x: 0.5, y: 0.5 }, zoom: { s: 1, left: 0, top: 0 }, origin: { x: 0, y: 0 } }).current; // origin: esquina del escenario en la página // pos: dónde quedó el puntero
  const keyboardRef = useRef(null);
  const stageRef = useRef(null);

  const send = (m) => r.dc?.readyState === 'open' && r.dc.send(JSON.stringify(m));

  useEffect(() => {
    ScreenOrientation.lockAsync(phase === 'live' ? ScreenOrientation.OrientationLock.LANDSCAPE : ScreenOrientation.OrientationLock.PORTRAIT_UP);
  }, [phase]);

  // Al cerrar el teclado con "atrás" no siempre llega onBlur: así la barra de texto se oculta igual
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidHide', () => { keyboardRef.current?.blur(); setTyping(false); });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let ended = false, agentSid = null, pc = null, statsTimer, retryTimer;
    setPhase('connecting');
    setStep({ why: t('connectingYourServer'), how: '', seg1: '', seg2: '', failNode: 0 });

    const fail = (reason, lastSeen) => {
      if (ended) return;
      ended = true;
      const r = reason in FAILS ? reason : 'ended', where = FAILS[r];
      setStep({
        why: r === 'offline' ? t('offlineWhy', { name, when: formatWhen(lastSeen) }) : t(`fail_${r}`),
        how: t(`fail_${r}_how`),
        seg1: where === 1 ? 'fail' : 'ok',
        seg2: where === 2 ? 'fail' : where === 1 ? '' : 'ok',
        failNode: where,
      });
      setPhase('failed');
      pc?.close();
      sig.close();
      if (reason === 'server' || reason === 'media') retryTimer = setTimeout(() => setAttempt((a) => a + 1), 5000);
    };

    const timeout = setTimeout(() => fail('server'), 10000);
    const sig = connectSignalSafe(server, onSignal, (up) => up && clearTimeout(timeout), () => fail('server'));

    function onSignal(m) {
      if (m.t === 'hello') {
        if (agentSid) return; // reconexión durante la sesión: WebRTC sigue por su cuenta
        pc ??= createPeer(m.iceServers);
        sig.send({ t: 'connect', id: target.id, password: target.password, device: t('androidPhone') });
        setStep((s) => ({ ...s, why: t('searching', { name }), seg1: 'ok' }));
      } else if (m.t === 'rejected') fail(m.reason, m.lastSeen);
      else if (m.t === 'accepted') {
        agentSid = m.from;
        setStep((s) => ({ ...s, why: t('waitingImage'), seg2: 'ok' }));
      } else if (m.t === 'signal') onRemoteSignal(m.data);
      else if (m.t === 'bye') fail('ended');
    }

    function createPeer(iceServers) {
      const p = new RTCPeerConnection({ iceServers });
      p.onicecandidate = (e) => e.candidate && agentSid && sig.send({ t: 'signal', to: agentSid, data: { candidate: e.candidate } });
      p.ontrack = (e) => {
        setStreamURL(e.streams[0].toURL());
        setPhase('live');
      };
      p.ondatachannel = (e) => {
        if (e.channel.label !== 'files') {
          r.dc = e.channel;
          r.dc.onmessage = (ev) => {
            const m = JSON.parse(ev.data);
            if (m.t === 'img') { const uri = 'data:image/jpeg;base64,' + m.d; setSec((s) => ({ cur: uri, prev: s.cur })); }
            else if (m.t === 'secure' && !m.on) setTimeout(() => setSec({ cur: null, prev: null }), 800); // deja volver el video antes de quitar la capa
          };
          return;
        }
        r.files = fileChannel(e.channel, {
          progress: setFileText,
          saved: (uri, fileName) => { setReceived({ uri, name: fileName }); setFileText(t('fileArrived', { name: fileName })); },
        });
      };
      p.onconnectionstatechange = () => p.connectionState === 'failed' && fail('media');
      return p;
    }

    async function onRemoteSignal(data) {
      try {
        if (data.sdp) {
          await pc.setRemoteDescription(data.sdp);
          await pc.setLocalDescription(await pc.createAnswer());
          sig.send({ t: 'signal', to: agentSid, data: { sdp: pc.localDescription } });
        } else if (data.candidate) await pc.addIceCandidate(data.candidate);
      } catch (e) { console.warn(e); }
    }

    // Latencia, si va directo o por el servidor, y el tamaño real de la imagen
    statsTimer = setInterval(async () => {
      if (!pc) return;
      const stats = await pc.getStats();
      let pair;
      stats.forEach((st) => {
        if (st.type === 'inbound-rtp' && st.kind === 'video' && st.frameWidth) r.video = { w: st.frameWidth, h: st.frameHeight };
        if (st.type === 'candidate-pair' && st.nominated && st.state === 'succeeded') pair = st;
      });
      if (!pair) return;
      const relay = stats.get(pair.localCandidateId)?.candidateType === 'relay';
      setNet(t(relay ? 'netRelay' : 'netDirect', { ms: Math.round((pair.currentRoundTripTime ?? 0) * 1000) }));
    }, 2000);

    return () => {
      ended = true;
      clearTimeout(timeout);
      clearInterval(statsTimer);
      clearTimeout(retryTimer);
      pc?.close();
      sig.close();
      r.dc = r.files = null;
      setStreamURL(null);
      setSec({ cur: null, prev: null });
    };
  }, [attempt]);

  // ---------- Toques -> mouse ----------
  // Tocar = clic, mantener = clic derecho, arrastrar = arrastrar con clic,
  // dos dedos: pellizcar = zoom (y mover la imagen ampliada), deslizar sin zoom = rueda
  const pan = useMemo(() => {
    let start, last, dragging, twoFingers, handled, longTimer, mode, g0, lastMy;
    const toRemote = (px, py) => {
      const { box, video } = r;
      const { x, y } = unzoom({ x: px, y: py }, r.zoom);
      const sc = Math.min(box.w / video.w, box.h / video.h);
      const w = video.w * sc, h = video.h * sc;
      return { x: (x - (box.w - w) / 2) / w, y: (y - (box.h - h) / 2) / h };
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        start = last = r.pos = toRemote(e.nativeEvent.locationX, e.nativeEvent.locationY);
        dragging = twoFingers = handled = false;
        mode = g0 = null;
        send({ t: 'move', ...start });
        longTimer = setTimeout(() => { handled = true; send({ t: 'click', b: 2, ...start }); }, 550);
      },
      onPanResponderMove: (e, g) => {
        if (g.numberActiveTouches >= 2 || twoFingers) {
          clearTimeout(longTimer);
          twoFingers = true;
          const [a, b] = e.nativeEvent.touches;
          if (!b) return;
          const d = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
          const m = { x: (a.pageX + b.pageX) / 2 - r.origin.x, y: (a.pageY + b.pageY) / 2 - r.origin.y };
          if (!g0) { g0 = { d, m, z: r.zoom }; lastMy = m.y; }
          if (!mode) {
            if (Math.abs(d / g0.d - 1) > 0.08 || (r.zoom.s > 1 && Math.hypot(m.x - g0.m.x, m.y - g0.m.y) > 10)) mode = 'zoom';
            else if (Math.abs(m.y - g0.m.y) > 12) mode = 'scroll';
          }
          if (mode === 'zoom') {
            r.zoom = pinch(g0.z, g0.d, d, g0.m, m, r.box);
            for (const k of ['s', 'left', 'top']) zoomAnim[k].setValue(r.zoom[k]);
          } else if (mode === 'scroll') {
            const dy = m.y - lastMy;
            lastMy = m.y;
            if (Math.abs(dy) > 1) send({ t: 'wheel', dy: -dy * 4 }); // dedos hacia arriba = bajar la página
          }
          return;
        }
        if (handled) return;
        if (!dragging && Math.hypot(g.dx, g.dy) > 10) {
          clearTimeout(longTimer);
          dragging = true;
          send({ t: 'down', b: 0, ...start });
        }
        if (dragging) {
          last = r.pos = toRemote(e.nativeEvent.locationX, e.nativeEvent.locationY);
          send({ t: 'move', ...last });
        }
      },
      onPanResponderRelease: () => {
        clearTimeout(longTimer);
        if (twoFingers || handled) return;
        if (dragging) send({ t: 'up', b: 0, ...last });
        else send({ t: 'click', b: 0, ...start });
      },
      onPanResponderTerminate: () => { clearTimeout(longTimer); if (dragging) send({ t: 'up', b: 0, ...last }); },
    });
  }, []);

  // Touchpad: deslizar mueve el puntero desde donde está, tocar hace clic
  const pad = useMemo(() => {
    let prev, moved;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { prev = { dx: 0, dy: 0 }; moved = false; },
      onPanResponderMove: (e, g) => {
        if (Math.hypot(g.dx, g.dy) > 6) moved = true;
        r.pos = padMove(r.pos, g.dx - prev.dx, g.dy - prev.dy, Math.hypot(g.vx, g.vy), r.video);
        prev = { dx: g.dx, dy: g.dy };
        send({ t: 'move', ...r.pos });
      },
      onPanResponderRelease: () => { if (!moved) send({ t: 'click', b: 0, ...r.pos }); },
    });
  }, []);

  // ---------- Teclado ----------
  // Si se cerró con "atrás", el campo sigue enfocado y focus() solo no vuelve a abrir el teclado
  const openKeyboard = () => {
    const k = keyboardRef.current;
    k?.blur();
    setText('');
    setTimeout(() => k?.focus(), 100);
  };
  const toggleMod = (code) => setMods((m) => (m.includes(code) ? m.filter((x) => x !== code) : [...m, code]));
  const sendKeys = (codes) => { send({ t: 'combo', codes: [...mods, ...codes] }); setMods([]); };
  // El campo conserva lo escrito (si se vaciara en cada letra, el teclado del teléfono parpadea al autocompletar)
  // y a la PC solo va la diferencia: borrados + texto nuevo
  const onType = (v) => {
    const { back, text: add } = typeDiff(text, v);
    setText(v.length > 100 && v.endsWith(' ') ? '' : v);
    for (let i = 0; i < Math.min(back, 50); i++) send({ t: 'combo', codes: ['Backspace'] });
    if (!add) return;
    if (mods.length && add.length === 1 && charCode(add)) sendKeys([charCode(add)]);
    else send({ t: 'text', s: add });
  };
  const cut = () => { send({ t: 'release' }); onExit(); };

  if (phase !== 'live') {
    return (
      <View style={s.panel}>
        <Pressable onPress={onExit} accessibilityRole="button" style={s.back}>
          <Text style={s.backText}>‹  {t('myDevices')}</Text>
        </Pressable>
        <Text style={s.h1} accessibilityRole="header">{name}</Text>
        <VerticalRoute name={name} step={step} />
        <View style={s.explain} accessibilityLiveRegion="polite">
          <Text style={s.why}>{step.why}</Text>
          {!!step.how && <Text style={s.how}>{step.how}</Text>}
        </View>
        {phase === 'failed' && <Button title={t('retry')} onPress={() => setAttempt((a) => a + 1)} style={{ marginTop: 'auto' }} />}
      </View>
    );
  }

  return (
    <View style={s.live}>
      <View
        ref={stageRef}
        style={s.stage}
        onLayout={(e) => {
          r.box = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
          stageRef.current?.measure((x, y, w, h, pageX, pageY) => (r.origin = { x: pageX, y: pageY }));
        }}
      >
        {streamURL && (
          <Animated.View
            style={[StyleSheet.absoluteFill, {
              transformOrigin: 'left top', // pantalla = left + s · punto, igual que pinch/unzoom
              transform: [{ translateX: zoomAnim.left }, { translateY: zoomAnim.top }, { scale: zoomAnim.s }],
            }]}
          >
            <RTCView streamURL={streamURL} objectFit="contain" style={StyleSheet.absoluteFill} />
          </Animated.View>
        )}
        {sec.cur && (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]} />
        )}
        {sec.prev && (
          <Image key="prev" source={{ uri: sec.prev }} resizeMode="contain" fadeDuration={0} pointerEvents="none" style={StyleSheet.absoluteFill} />
        )}
        {sec.cur && (
          <Image key="cur" source={{ uri: sec.cur }} resizeMode="contain" fadeDuration={0} pointerEvents="none" style={StyleSheet.absoluteFill} />
        )}
        <View style={StyleSheet.absoluteFill} {...pan.panHandlers} accessibilityLabel={t('screenOf', { name })} />
      </View>
      <View style={s.rail}>
        <Text style={s.net}>{net || t('connected')}</Text>
        <View style={s.grid}>
          <Key title={t('keyboard')} onPress={openKeyboard} />
          <Key title={arrows ? t('touchpadKey') : t('arrows')} onPress={() => setArrows((a) => !a)} />
        </View>
        <View style={s.grid}>
          <Key title="Ctrl" pressed={mods.includes('ControlLeft')} onPress={() => toggleMod('ControlLeft')} />
          <Key title="Alt" pressed={mods.includes('AltLeft')} onPress={() => toggleMod('AltLeft')} />
          <Key title="Win" onPress={() => sendKeys(['MetaLeft'])} />
          <Key title="Esc" onPress={() => sendKeys(['Escape'])} />
        </View>
        {!!(fileText || mods.length) && (
          <Text style={s.hint} numberOfLines={2} accessibilityLiveRegion="polite">{fileText || t('nextKey')}</Text>
        )}
        {received && <View style={s.grid}><Key title={t('openReceived')} onPress={() => Sharing.shareAsync(received.uri)} /></View>}
        {arrows ? (
          <View style={s.arrows}>
            <View style={s.grid}><View style={{ flex: 1 }} /><Key title="↑" label={t('up')} repeat onPress={() => sendKeys(['ArrowUp'])} /><View style={{ flex: 1 }} /></View>
            <View style={s.grid}>
              <Key title="←" label={t('left')} repeat onPress={() => sendKeys(['ArrowLeft'])} />
              <Key title="↓" label={t('down')} repeat onPress={() => sendKeys(['ArrowDown'])} />
              <Key title="→" label={t('right')} repeat onPress={() => sendKeys(['ArrowRight'])} />
            </View>
          </View>
        ) : (
          <View style={s.pad} {...pad.panHandlers} accessible accessibilityLabel={t('touchpad')} />
        )}
        <View style={s.grid}>
          <Key title={t('leftClick')} onPress={() => send({ t: 'click', b: 0, ...r.pos })} />
          <Key title={t('rightClick')} onPress={() => send({ t: 'click', b: 2, ...r.pos })} />
        </View>
        <Pressable onPress={cut} accessibilityRole="button" style={s.cut}>
          <Text style={s.cutText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{t('cut')}</Text>
        </Pressable>
      </View>
      <TextInput
        ref={keyboardRef}
        value={text}
        onChangeText={onType}
        onKeyPress={(e) => e.nativeEvent.key === 'Backspace' && !text && sendKeys(['Backspace'])}
        onSubmitEditing={() => { sendKeys(['Enter']); setText(''); }}
        submitBehavior="submit"
        autoCorrect={false}
        autoCapitalize="none"
        disableFullscreenUI // en horizontal Android abre su editor a pantalla completa (fondo oscuro, letra negra)
        onFocus={() => setTyping(true)}
        onBlur={() => setTyping(false)}
        accessibilityLabel={t('keyboard')}
        style={typing ? s.typingBar : s.hiddenInput}
      />
    </View>
  );
}

// Si la dirección del servidor es inválida, WebSocket lanza error en lugar de solo fallar
function connectSignalSafe(url, onMessage, onState, onError) {
  try {
    return connectSignal(url, onMessage, onState);
  } catch {
    setTimeout(onError, 0);
    return { send() {}, close() {} };
  }
}

// repeat: mantener presionado repite la tecla, como en un teclado físico
function Key({ title, label, pressed, onPress, repeat }) {
  const timer = useRef(null);
  const stop = () => { clearTimeout(timer.current); clearInterval(timer.current); };
  useEffect(() => stop, []);
  const start = () => { onPress(); timer.current = setTimeout(() => (timer.current = setInterval(onPress, 60)), 400); };
  return (
    <Pressable
      onPress={repeat ? undefined : onPress}
      onPressIn={repeat ? start : undefined}
      onPressOut={repeat ? stop : undefined}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={pressed === undefined ? undefined : { selected: pressed }}
      style={[s.key, pressed && { backgroundColor: C.cable, borderColor: C.cable }]}
    >
      <Text style={[s.keyText, pressed && { color: C.ink, fontFamily: F.bold }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{title}</Text>
    </Pressable>
  );
}

function Node({ icon, title, text, fail, last }) {
  return (
    <View style={{ flexDirection: 'row', gap: 16 }}>
      <View style={{ width: 44, alignItems: 'center' }}>
        <View style={[s.node, fail && { backgroundColor: 'transparent', borderWidth: 3, borderColor: C.fault }]}>
          <Icon kind={icon} color={fail ? C.fault : '#fff'} />
        </View>
        {last}
      </View>
      <View style={{ paddingTop: 2, flex: 1 }}>
        <Text style={[s.nodeTitle, fail && { color: C.fault }]}>{title}</Text>
        {!!text && <Text style={[s.nodeText, fail && { color: C.fault }]}>{text}</Text>}
      </View>
    </View>
  );
}

// Íconos dibujados con bordes: teléfono, servidor, PC
function Icon({ kind, color }) {
  const b = { borderWidth: 2, borderColor: color, borderRadius: 2 };
  if (kind === 'phone') return <View style={[b, { width: 12, height: 20 }]} />;
  if (kind === 'server') return <View style={{ gap: 2 }}><View style={[b, { width: 20, height: 8 }]} /><View style={[b, { width: 20, height: 8 }]} /></View>;
  return <View style={{ alignItems: 'center', gap: 2 }}><View style={[b, { width: 22, height: 14 }]} /><View style={{ width: 10, height: 2, backgroundColor: color }} /></View>;
}

function Segment({ state }) {
  const color = state === 'fail' ? C.fault : state === 'ok' ? C.ink : C.idle;
  return <View style={{ height: 44, borderLeftWidth: 3, borderColor: color, borderStyle: state === 'ok' ? 'solid' : 'dashed' }} />;
}

function VerticalRoute({ name, step }) {
  return (
    <View style={{ marginTop: 32 }} accessible={false}>
      <Node icon="phone" title={t('jrPhone')} text={step.seg1 === 'ok' ? t('connectedToServer') : ''} last={<Segment state={step.seg1} />} />
      <Node icon="server" title={t('server')} fail={step.failNode === 1} text={step.failNode === 1 ? t('noResponse') : ''} last={<Segment state={step.seg2} />} />
      <Node icon="pc" title={t('seniorNode', { name })} fail={step.failNode === 2} text={step.seg2 === 'ok' && !step.failNode ? t('accepted') : ''} />
    </View>
  );
}

const s = StyleSheet.create({
  panel: { flex: 1, backgroundColor: C.paper, paddingTop: 48, paddingHorizontal: 24, paddingBottom: 32 },
  back: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  backText: { fontFamily: F.regular, fontSize: 16, color: C.ink },
  h1: { fontFamily: F.bold, fontSize: 30, color: C.ink, marginTop: 12 },
  node: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  nodeTitle: { fontFamily: F.bold, fontSize: 18, color: C.ink },
  nodeText: { fontFamily: F.regular, fontSize: 15, color: C.muted },
  explain: { marginTop: 32, paddingTop: 20, borderTopWidth: 1, borderColor: C.rule, gap: 8 },
  why: { fontFamily: F.bold, fontSize: 18, lineHeight: 24, color: C.ink },
  how: { fontFamily: F.regular, fontSize: 16, lineHeight: 24, color: C.muted },

  live: { flex: 1, flexDirection: 'row', backgroundColor: C.night },
  stage: { flex: 1, backgroundColor: '#000', overflow: 'hidden' },
  rail: { width: 210, padding: 12, gap: 8, backgroundColor: C.night }, // opaca: tapa la imagen ampliada si se sale del escenario
  net: { fontFamily: F.regular, fontSize: 13, color: C.soft, minHeight: 20 },
  grid: { flexDirection: 'row', gap: 8 },
  key: { minHeight: 44, flex: 1, paddingHorizontal: 4, borderWidth: 1.5, borderColor: C.line, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  keyText: { fontFamily: F.regular, fontSize: 14, color: '#fff' },
  hint: { fontFamily: F.regular, fontSize: 12, lineHeight: 16, color: C.soft },
  arrows: { flex: 1, minHeight: 64, gap: 8, justifyContent: 'center' },
  pad: { flex: 1, minHeight: 64, borderWidth: 1.5, borderColor: C.line, borderRadius: 10, backgroundColor: '#2F3741' },
  cut: { minHeight: 44, paddingHorizontal: 8, borderRadius: 6, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  cutText: { fontFamily: F.bold, fontSize: 14, color: C.ink },
  typingBar: { position: 'absolute', top: 8, left: 8, right: 218, minHeight: 44, paddingHorizontal: 12, borderRadius: 6, backgroundColor: 'rgba(29,39,51,0.92)', color: '#fff', fontFamily: F.regular, fontSize: 16 },
  hiddenInput: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
