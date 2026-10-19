import { useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, C, F } from './ui';
import { t } from './i18n';
import { checkUpdates, repoUrl, version } from './acerca';

const LANG_NAMES = { es: 'Español', en: 'English' }; // cada idioma con su propio nombre

export default function Ajustes({ lang, onLang, onBack }) {
  const [upd, setUpd] = useState(null); // resultado de la última búsqueda
  const [busy, setBusy] = useState(false);

  const check = async () => {
    setBusy(true);
    setUpd(null);
    setUpd(await checkUpdates());
    setBusy(false);
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 32 }}>
      <Pressable onPress={onBack} accessibilityRole="button" style={s.back}>
        <Text style={s.backText}>‹  {t('myDevices')}</Text>
      </Pressable>
      <Text style={s.h1} accessibilityRole="header">{t('settings')}</Text>

      <Text style={s.label}>{t('language')}</Text>
      <View style={s.langs} accessibilityRole="radiogroup" accessibilityLabel={t('language')}>
        {Object.entries(LANG_NAMES).map(([code, title]) => {
          const on = lang === code;
          return (
            <Pressable
              key={code}
              onPress={() => { onLang(code); setUpd(null); }}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLanguage={code}
              style={[s.lang, on && s.langOn]}
            >
              <Text style={[s.langText, on && { fontFamily: F.bold }]}>{title}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={s.about}>
        <Text style={s.label} accessibilityRole="header">{t('about')}</Text>
        <View style={s.id}>
          <Image source={require('../assets/icon.png')} style={s.logo} accessibilityIgnoresInvertColors />
          <View>
            <Text style={s.name}>The Jr</Text>
            <Text style={s.muted}>{t('version', { v: version })}</Text>
          </View>
        </View>
        {repoUrl ? (
          <Pressable onPress={() => Linking.openURL(repoUrl)} accessibilityRole="link" style={s.link}>
            <Text style={s.linkText}>{t('repo')}</Text>
          </Pressable>
        ) : (
          <Text style={s.muted}>{t('noRepo')}</Text>
        )}
        <Button
          kind="ghost"
          title={busy ? t('checking') : t('checkUpdates')}
          onPress={check}
          disabled={!repoUrl || busy}
          accessibilityState={{ disabled: !repoUrl || busy }}
          style={[{ alignSelf: 'flex-start' }, (!repoUrl || busy) && { opacity: 0.55 }]}
        />
        {upd && <Text style={s.result} accessibilityLiveRegion="polite">{t(`upd_${upd.state}`, upd)}</Text>}
        {upd?.state === 'new' && <Button title={t('download')} onPress={() => Linking.openURL(upd.url)} style={{ alignSelf: 'flex-start' }} />}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, paddingTop: 48, paddingHorizontal: 24 },
  back: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  backText: { fontFamily: F.regular, fontSize: 16, color: C.ink },
  h1: { fontFamily: F.bold, fontSize: 30, color: C.ink, marginTop: 12, marginBottom: 24 },
  label: { fontFamily: F.regular, fontSize: 15, color: C.muted, marginBottom: 8 },
  langs: { flexDirection: 'row', gap: 8 },
  lang: { flex: 1, minHeight: 48, borderWidth: 1.5, borderColor: C.ink, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  langOn: { backgroundColor: C.cable, borderColor: C.cable },
  langText: { fontFamily: F.regular, fontSize: 16, color: C.ink },
  about: { marginTop: 28, paddingTop: 20, borderTopWidth: 1, borderColor: C.rule, gap: 12 },
  id: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  logo: { width: 64, height: 64, borderRadius: 32 },
  name: { fontFamily: F.bold, fontSize: 20, color: C.ink },
  muted: { fontFamily: F.regular, fontSize: 15, lineHeight: 22, color: C.muted },
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  linkText: { fontFamily: F.regular, fontSize: 16, color: C.ink, textDecorationLine: 'underline' },
  result: { fontFamily: F.regular, fontSize: 15, lineHeight: 22, color: C.ink },
});
