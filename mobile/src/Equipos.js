import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, C, F, RouteDot, connectSignal, formatCode, formatWhen } from './ui';
import { Field } from './Formulario';
import { t } from './i18n';

// Pantalla principal, con la misma estructura que en desktop: logo, "Ser The Jr de otro equipo", "Mis equipos" y el estado del servidor
export default function Equipos({ devices, server, onConnect, onSubmit, onServer, onSettings, onRemove }) {
  const [statuses, setStatuses] = useState({});
  const [online, setOnline] = useState(null); // null = todavía no se sabe
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  // Conexión al servidor: muestra si responde y consulta si cada equipo guardado está en línea
  useEffect(() => {
    setOnline(null);
    if (!server) return;
    const ask = () => devices.forEach((d) => sig.send({ t: 'status', id: d.id }));
    let sig;
    try {
      sig = connectSignal(server, (m) => {
        if (m.t === 'hello') ask();
        if (m.t === 'status') setStatuses((s) => ({ ...s, [m.id]: m }));
      }, setOnline);
    } catch {
      setOnline(false); // dirección inválida
      return;
    }
    const timer = setInterval(ask, 30000);
    return () => { clearInterval(timer); sig.close(); };
  }, [server, devices]);

  const submit = () => {
    const id = code.replace(/\D/g, '');
    const e = id.length !== 9 ? t('errCode') : !password ? t('errPass') : '';
    setError(e);
    if (!e) onSubmit({ id, password, name: name.trim() });
  };

  const confirmRemove = (d) =>
    Alert.alert(t('removeTitle', { name: d.name }), t('removeText'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('remove'), style: 'destructive', onPress: () => onRemove(d.id) },
    ]);

  const host = server.replace(/^wss?:\/\//, '');

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <View style={s.head}>
        <Image source={require('../assets/icon.png')} style={s.logo} accessibilityLabel="The Jr" accessibilityIgnoresInvertColors />
        <Button kind="ghost" title={t('settings')} onPress={onSettings} style={s.settings} textStyle={s.settingsText} />
      </View>

      <Text style={s.h1} accessibilityRole="header">{t('otherTitle')}</Text>
      <View style={s.form}>
        <Field
          label={t('seniorCode')}
          value={code}
          onChangeText={(v) => setCode(formatCode(v.replace(/\D/g, '').slice(0, 9)))}
          keyboardType="number-pad"
          placeholder="000 000 000"
          codeStyle
        />
        <Field label={t('password')} value={password} onChangeText={setPassword} secure />
        <Field label={t('saveAs')} value={name} onChangeText={setName} placeholder={t('namePlaceholder')} autoCapitalize="sentences" />
        {!!error && <Text style={s.error} accessibilityLiveRegion="polite">{error}</Text>}
        <Button title={t('connect')} onPress={submit} style={s.connect} />
      </View>

      <Text style={s.label} accessibilityRole="header">{t('myDevices')}</Text>
      <View style={s.list}>
        {!devices.length && <Text style={s.empty}>{t('emptyDevices')}</Text>}
        {devices.map((d) => {
          const st = statuses[d.id];
          const fail = st && !st.online;
          return (
            <Pressable
              key={d.id}
              accessibilityRole="button"
              accessibilityHint={t('holdToRemove')}
              onPress={() => onConnect(d)}
              onLongPress={() => confirmRemove(d)}
              style={({ pressed }) => [s.row, pressed && { backgroundColor: C.rack }]}
            >
              <Text style={s.name}>{d.name}</Text>
              <Text style={s.code}>{formatCode(d.id)}</Text>
              <View style={s.statusLine}>
                <RouteDot fail={fail} />
                <Text style={[s.status, fail && { color: C.fault }]}>
                  {!st ? t('querying') : st.online ? t('ready') : t('seniorNoReply', { when: formatWhen(st.lastSeen) })}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <Pressable onPress={onServer} accessibilityRole="button" accessibilityHint={t('changeServer')} style={s.server}>
        <RouteDot fail={online === false} />
        <View style={{ flex: 1 }}>
          <Text style={[s.serverTitle, online === false && { color: C.fault }]}>
            {!server ? t('setupServer') : online === false ? t('serverDown', { host }) : online ? t('serverUp', { host }) : t('connectingYourServer')}
          </Text>
          <Text style={s.serverText}>{t('changeServer')}</Text>
        </View>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingTop: 48, paddingHorizontal: 24, paddingBottom: 32 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  logo: { width: 64, height: 64, borderRadius: 32 },
  settings: { minHeight: 44, paddingHorizontal: 14 },
  settingsText: { fontFamily: F.regular, fontSize: 15 },
  h1: { fontFamily: F.bold, fontSize: 22, color: C.ink, marginTop: 24 },
  form: { gap: 14, marginTop: 16 },
  connect: { minHeight: 52, marginTop: 4 },
  error: { fontFamily: F.regular, fontSize: 15, color: C.fault },
  label: { fontFamily: F.regular, fontSize: 15, color: C.muted, marginTop: 32 },
  list: { marginTop: 8, borderTopWidth: 1, borderColor: C.rule },
  empty: { fontFamily: F.regular, fontSize: 15, lineHeight: 22, color: C.muted, paddingVertical: 16 },
  row: { paddingVertical: 16, borderBottomWidth: 1, borderColor: C.rule, gap: 4 },
  name: { fontFamily: F.bold, fontSize: 18, color: C.ink },
  code: { fontFamily: F.regular, fontSize: 15, color: C.muted, fontVariant: ['tabular-nums'] },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  status: { fontFamily: F.regular, fontSize: 14, color: C.ink },
  server: { marginTop: 'auto', paddingTop: 24, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  serverTitle: { fontFamily: F.bold, fontSize: 15, color: C.ink },
  serverText: { fontFamily: F.regular, fontSize: 13, color: C.muted, textDecorationLine: 'underline' },
});
