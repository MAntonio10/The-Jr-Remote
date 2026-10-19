// Textos en español e inglés. t('clave', { variable }) reemplaza {variable}; si falta una traducción, cae al español.
const STRINGS = {
  es: {
    settings: 'Configuración', language: 'Idioma', about: 'Acerca de', version: 'Versión {v}',
    repo: 'Repositorio en GitHub', noRepo: 'Todavía no hay un repositorio configurado.',
    checkUpdates: 'Buscar actualizaciones', checking: 'Buscando…', download: 'Descargar',
    upd_current: 'Tienes la versión más reciente ({v}).', upd_new: 'Hay una versión nueva: {v}.',
    'upd_no-releases': 'El repositorio no tiene versiones publicadas (o no es público).',
    'upd_no-repo': 'Todavía no hay un repositorio configurado.', upd_error: 'No se pudo consultar GitHub ({why}).',

    myDevices: 'Mis equipos', emptyDevices: 'Conéctate con un código y ponle nombre al equipo para guardarlo aquí.',
    holdToRemove: 'Mantén presionado para quitarlo', querying: 'Consultando…', ready: 'Lista para conectar',
    seniorNoReply: 'El Senior no responde desde {when}', serverUp: 'Conectado a {host}', serverDown: 'Sin conexión con {host}', changeServer: 'Cambiar servidor',
    setupServer: 'Configura tu servidor para empezar', otherTitle: 'Ser The Jr de otro equipo',
    removeTitle: '¿Quitar {name} de tus equipos?', removeText: 'Podrás agregarlo de nuevo con su código.',
    cancel: 'Cancelar', remove: 'Quitar', show: 'Mostrar', hide: 'Ocultar',

    errCode: 'El código tiene 9 dígitos.', errPass: 'Escribe la contraseña del otro equipo.',
    seniorCode: 'Código de El Senior', password: 'Contraseña', saveAs: 'Guardar como (opcional)',
    namePlaceholder: 'PC Oficina', connect: 'Conectar', yourServer: 'Tu servidor',
    serverHelp: 'Es el servidor que une tu teléfono con tus equipos. Usa la misma dirección que en The Jr de escritorio.',
    address: 'Dirección', addressPlaceholder: 'wss://remoto.tudominio.com',
    errAddress: 'La dirección empieza con wss:// seguido de tu dominio.', saveServer: 'Guardar servidor',

    connectingYourServer: 'Conectando con tu servidor…', searching: 'Buscando {name}…', waitingImage: 'Esperando la imagen…',
    deviceName: 'Equipo {code}', androidPhone: 'Teléfono Android', fileArrived: 'Llegó {name}',
    netRelay: 'Por tu servidor, {ms} ms', netDirect: 'Directo, {ms} ms', connected: 'Conectado', retry: 'Volver a intentar',
    screenOf: 'Pantalla de {name}', keyboard: 'Teclado', arrows: 'Flechas', touchpadKey: 'Touchpad', up: 'Arriba', down: 'Abajo', left: 'Izquierda', right: 'Derecha', openReceived: 'Abrir lo recibido', cut: 'Cortar conexión',
    touchpad: 'Touchpad: desliza para mover el puntero, toca para hacer clic', leftClick: 'Clic izq.', rightClick: 'Clic der.',
    nextKey: 'Toca la siguiente tecla para la combinación.',
    jrPhone: 'The Jr (tu teléfono)', server: 'Servidor', connectedToServer: 'Conectado al servidor', noResponse: 'Sin respuesta',
    seniorNode: 'El Senior: {name}', accepted: 'Aceptó la conexión', offlineWhy: 'El Senior ({name}) no responde desde {when}.',
    fail_server: 'The Jr rompió producción (reintentando conexión...)', fail_server_how: 'Revisa el internet de tu teléfono y que el servidor esté encendido.',
    fail_unknown: 'No existe un equipo con ese código.', fail_unknown_how: 'Revisa el código en la ventana del otro equipo.',
    fail_offline_how: 'Tu teléfono y el servidor funcionan bien. Revisa que la PC esté encendida, sin suspender y con internet.',
    'fail_bad-password': 'Contraseña incorrecta.', 'fail_bad-password_how': 'Revisa la contraseña en la ventana del otro equipo.',
    fail_locked: 'Demasiados intentos fallidos.', fail_locked_how: 'El otro equipo bloqueó las conexiones por un minuto.',
    'fail_too-many': 'Demasiados intentos desde esta red.', 'fail_too-many_how': 'Espera un minuto y vuelve a intentar.',
    fail_denied: 'En el otro equipo rechazaron la conexión.',
    fail_busy: 'El Senior está atendiendo otra petición de conexión.', fail_busy_how: 'Espera unos segundos e intenta de nuevo.',
    fail_media: 'The Jr rompió producción (reintentando conexión...)', fail_media_how: 'Revisa que el relay TURN del servidor esté activo en el puerto 443.',
    fail_ended: 'El Senior cerró la sesión.',

    fileRunning: 'The Jr va corriendo con los documentos: {name} ({pct}%)', fileDelivered: 'Entregado: {name}',
    fileSaving: 'Guardando {name} al otro lado…', fileFailed: 'The Jr se tropezó con los documentos: {name} no llegó ({why}).',
    connectionCut: 'se cortó la conexión',
    whenLongAgo: 'hace tiempo', whenToday: 'hoy, {time}', whenYesterday: 'ayer, {time}', whenDate: 'el {date}, {time}',
  },
  en: {
    settings: 'Settings', language: 'Language', about: 'About', version: 'Version {v}',
    repo: 'GitHub repository', noRepo: 'No repository configured yet.',
    checkUpdates: 'Check for updates', checking: 'Checking…', download: 'Download',
    upd_current: 'You have the latest version ({v}).', upd_new: 'A new version is available: {v}.',
    'upd_no-releases': 'The repository has no published releases (or it is not public).',
    'upd_no-repo': 'No repository configured yet.', upd_error: 'Couldn’t reach GitHub ({why}).',

    myDevices: 'My computers', emptyDevices: 'Connect with a code and name the computer to save it here.',
    holdToRemove: 'Press and hold to remove it', querying: 'Checking…', ready: 'Ready to connect',
    seniorNoReply: 'The Senior hasn’t responded since {when}', serverUp: 'Connected to {host}', serverDown: 'No connection to {host}', changeServer: 'Change server',
    setupServer: 'Set up your server to get started', otherTitle: 'Be The Jr of another computer',
    removeTitle: 'Remove {name} from your computers?', removeText: 'You can add it again with its code.',
    cancel: 'Cancel', remove: 'Remove', show: 'Show', hide: 'Hide',

    errCode: 'The code has 9 digits.', errPass: 'Enter the other computer’s password.',
    seniorCode: 'The Senior’s code', password: 'Password', saveAs: 'Save as (optional)',
    namePlaceholder: 'Office PC', connect: 'Connect', yourServer: 'Your server',
    serverHelp: 'It’s the server that links your phone with your computers. Use the same address as in The Jr for desktop.',
    address: 'Address', addressPlaceholder: 'wss://remote.yourdomain.com',
    errAddress: 'The address starts with wss:// followed by your domain.', saveServer: 'Save server',

    connectingYourServer: 'Connecting to your server…', searching: 'Looking for {name}…', waitingImage: 'Waiting for the picture…',
    deviceName: 'Computer {code}', androidPhone: 'Android phone', fileArrived: '{name} arrived',
    netRelay: 'Through your server, {ms} ms', netDirect: 'Direct, {ms} ms', connected: 'Connected', retry: 'Try again',
    screenOf: 'Screen of {name}', keyboard: 'Keyboard', arrows: 'Arrows', touchpadKey: 'Touchpad', up: 'Up', down: 'Down', left: 'Left', right: 'Right', openReceived: 'Open received file', cut: 'Disconnect',
    touchpad: 'Touchpad: slide to move the pointer, tap to click', leftClick: 'Left click', rightClick: 'Right click',
    nextKey: 'Tap the next key for the shortcut.',
    jrPhone: 'The Jr (your phone)', server: 'Server', connectedToServer: 'Connected to the server', noResponse: 'No response',
    seniorNode: 'The Senior: {name}', accepted: 'Accepted the connection', offlineWhy: 'The Senior ({name}) hasn’t responded since {when}.',
    fail_server: 'The Jr broke production (retrying connection...)', fail_server_how: 'Check your phone’s internet and that the server is on.',
    fail_unknown: 'There is no computer with that code.', fail_unknown_how: 'Check the code in the other computer’s window.',
    fail_offline_how: 'Your phone and the server are fine. Check that the PC is on, not asleep, and online.',
    'fail_bad-password': 'Wrong password.', 'fail_bad-password_how': 'Check the password in the other computer’s window.',
    fail_locked: 'Too many failed attempts.', fail_locked_how: 'The other computer blocked connections for one minute.',
    'fail_too-many': 'Too many attempts from this network.', 'fail_too-many_how': 'Wait a minute and try again.',
    fail_denied: 'The connection was rejected on the other computer.',
    fail_busy: 'The Senior is handling another connection request.', fail_busy_how: 'Wait a few seconds and try again.',
    fail_media: 'The Jr broke production (retrying connection...)', fail_media_how: 'Check that the server’s TURN relay is running on port 443.',
    fail_ended: 'The Senior ended the session.',

    fileRunning: 'The Jr is running with the documents: {name} ({pct}%)', fileDelivered: 'Delivered: {name}',
    fileSaving: 'Saving {name} on the other side…', fileFailed: 'The Jr tripped over the documents: {name} didn’t arrive ({why}).',
    connectionCut: 'the connection dropped',
    whenLongAgo: 'a while ago', whenToday: 'today, {time}', whenYesterday: 'yesterday, {time}', whenDate: '{date}, {time}',
  },
};

let lang = 'es';
export const LANGS = Object.keys(STRINGS);
export const setLang = (l) => (lang = STRINGS[l] ? l : 'es');
export const getLang = () => lang;
export const t = (key, vars = {}) => (STRINGS[lang][key] ?? STRINGS.es[key] ?? '').replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

// Idioma del teléfono la primera vez; después manda lo que elija la persona
export function phoneLang() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale.startsWith('es') ? 'es' : 'en';
  } catch {
    return 'es';
  }
}
