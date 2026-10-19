import { useEffect, useState } from 'react';
import { BackHandler, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useFonts, AtkinsonHyperlegibleNext_400Regular, AtkinsonHyperlegibleNext_700Bold } from '@expo-google-fonts/atkinson-hyperlegible-next';
import { AtkinsonHyperlegibleMono_400Regular } from '@expo-google-fonts/atkinson-hyperlegible-mono';
import { C } from './src/ui';
import Equipos from './src/Equipos';
import { Servidor } from './src/Formulario';
import Sesion from './src/Sesion';
import Ajustes from './src/Ajustes';
import { phoneLang, setLang } from './src/i18n';

export default function App() {
  const [fonts] = useFonts({ AtkinsonHyperlegibleNext_400Regular, AtkinsonHyperlegibleNext_700Bold, AtkinsonHyperlegibleMono_400Regular });
  const [devices, setDevices] = useState(null); // [{ id, name, password }] en almacenamiento cifrado
  const [server, setServer] = useState('');
  const [online, setOnline] = useState(null); // estado del servidor: lo mide Equipos y lo muestra Configuración
  const [screen, setScreen] = useState({ name: 'equipos' });
  const [lang, setLangState] = useState(null);

  useEffect(() => {
    (async () => {
      const l = (await SecureStore.getItemAsync('lang')) || phoneLang();
      setLang(l);
      setLangState(l);
      setDevices(JSON.parse((await SecureStore.getItemAsync('devices')) || '[]'));
      setServer((await SecureStore.getItemAsync('server')) || '');
    })();
  }, []);

  useEffect(() => {
    if (screen.name !== 'sesion') ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen.name === 'equipos') return false;
      setScreen({ name: 'equipos' });
      return true;
    });
    return () => sub.remove();
  }, [screen.name]);

  const saveDevices = (list) => {
    setDevices(list);
    SecureStore.setItemAsync('devices', JSON.stringify(list));
  };
  const home = () => setScreen({ name: 'equipos' });
  const changeLang = (l) => {
    setLang(l);
    setLangState(l); // vuelve a dibujar todo con el idioma nuevo
    SecureStore.setItemAsync('lang', l);
  };

  if (!fonts || !devices) return <View style={{ flex: 1, backgroundColor: C.paper }} />;

  let content;
  if (screen.name === 'sesion') {
    content = <Sesion target={screen.target} server={server} onExit={home} />;
  } else if (screen.name === 'ajustes') {
    content = <Ajustes lang={lang} onLang={changeLang} onBack={home} server={server} online={online} onServer={() => setScreen({ name: 'servidor' })} />;
  } else if (screen.name === 'servidor') {
    content = (
      <Servidor
        value={server}
        onBack={home}
        onSave={(url) => { setServer(url); SecureStore.setItemAsync('server', url); home(); }}
      />
    );
  } else {
    content = (
      <Equipos
        devices={devices}
        server={server}
        onOnline={setOnline}
        onConnect={(target) => setScreen(server ? { name: 'sesion', target } : { name: 'servidor' })}
        onSubmit={(target) => {
          if (target.name) saveDevices([...devices.filter((d) => d.id !== target.id), target]);
          setScreen(server ? { name: 'sesion', target } : { name: 'servidor' });
        }}
        onSettings={() => setScreen({ name: 'ajustes' })}
        onRemove={(id) => saveDevices(devices.filter((d) => d.id !== id))}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: screen.name === 'sesion' ? C.night : C.paper }}>
      <StatusBar style={screen.name === 'sesion' ? 'light' : 'dark'} hidden={screen.name === 'sesion'} />
      {content}
    </View>
  );
}
