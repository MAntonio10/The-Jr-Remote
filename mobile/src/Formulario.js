import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, C, F } from './ui';
import { t } from './i18n';

function Back({ onPress }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={s.back}>
      <Text style={s.backText}>‹  {t('myDevices')}</Text>
    </Pressable>
  );
}

// secure: campo de contraseña con botón Mostrar/Ocultar para revisar lo que se escribe
export function Field({ label, codeStyle, secure, ...props }) {
  const [shown, setShown] = useState(false);
  const input = (
    <TextInput
      accessibilityLabel={label}
      placeholderTextColor={C.idle}
      style={[s.input, codeStyle && s.codeInput, secure && { flex: 1 }]}
      autoCorrect={false}
      autoCapitalize="none"
      secureTextEntry={secure && !shown}
      {...props}
    />
  );
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      {secure ? (
        <View style={s.secureRow}>
          {input}
          <Button kind="ghost" title={t(shown ? 'hide' : 'show')} onPress={() => setShown(!shown)} accessibilityState={{ selected: shown }} style={s.showBtn} textStyle={s.showText} />
        </View>
      ) : input}
    </View>
  );
}

export function Servidor({ value, onBack, onSave }) {
  const [url, setUrl] = useState(value || 'wss://');
  const [error, setError] = useState('');
  const save = () => {
    const ok = /^wss?:\/\/[^\s/]+/.test(url.trim());
    setError(ok ? '' : t('errAddress'));
    if (ok) onSave(url.trim().replace(/\/$/, ''));
  };
  return (
    <KeyboardAvoidingView behavior="padding" style={s.screen}>
      <Back onPress={onBack} />
      <Text style={s.h1} accessibilityRole="header">{t('yourServer')}</Text>
      <Text style={s.help}>{t('serverHelp')}</Text>
      <View style={{ gap: 18, marginTop: 24 }}>
        <Field label={t('address')} value={url} onChangeText={setUrl} placeholder={t('addressPlaceholder')} keyboardType="url" />
        {!!error && <Text style={s.error} accessibilityLiveRegion="polite">{error}</Text>}
      </View>
      <Button title={t('saveServer')} onPress={save} style={{ marginTop: 24 }} />
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, paddingTop: 48, paddingHorizontal: 24, paddingBottom: 32 },
  back: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  backText: { fontFamily: F.regular, fontSize: 16, color: C.ink },
  h1: { fontFamily: F.bold, fontSize: 30, color: C.ink, marginTop: 12 },
  help: { fontFamily: F.regular, fontSize: 16, lineHeight: 24, color: C.muted, marginTop: 8 },
  label: { fontFamily: F.regular, fontSize: 15, color: C.muted },
  input: { minHeight: 52, borderWidth: 1.5, borderColor: C.ink, borderRadius: 8, backgroundColor: '#fff', paddingHorizontal: 14, fontFamily: F.regular, fontSize: 18, color: C.ink },
  codeInput: { fontFamily: F.bold, fontSize: 26, fontVariant: ['tabular-nums'] },
  secureRow: { flexDirection: 'row', gap: 8 },
  showBtn: { minHeight: 52, paddingHorizontal: 14 },
  showText: { fontFamily: F.regular, fontSize: 15 },
  error: { fontFamily: F.regular, fontSize: 15, color: C.fault },
});
