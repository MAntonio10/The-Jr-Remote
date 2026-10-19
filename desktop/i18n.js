// Textos en español e inglés. Lo usan el proceso principal (require) y las ventanas (<script>).
// t('clave', { variable }) reemplaza {variable}; si falta una traducción, cae al español.
const STRINGS = {
  es: {
    settings: 'Configuración', close: 'Cerrar', language: 'Idioma', about: 'Acerca de',
    version: 'Versión {v}', repo: 'Repositorio en GitHub', noRepo: 'Todavía no hay un repositorio configurado.',
    checkUpdates: 'Buscar actualizaciones', checking: 'Buscando…', download: 'Descargar',
    upd_current: 'Tienes la versión más reciente ({v}).', upd_new: 'Hay una versión nueva: {v}.',
    'upd_no-releases': 'El repositorio no tiene versiones publicadas (o no es público).',
    'upd_no-repo': 'Todavía no hay un repositorio configurado.', upd_error: 'No se pudo consultar GitHub ({why}).',

    bandTitle: 'The Jr está al mando de esta PC', bandTitleMany: '{n} The Jr están al mando de esta PC', bandInfo: '{device}, conectado a las {time}',
    sendFileToJr: 'Enviar archivo a The Jr', cut: 'Cortar conexión', showFile: 'Ver en carpeta',
    seniorTitle: 'Este equipo es El Senior', code: 'Código', copyBoth: 'Copiar código y contraseña', copied: 'Copiado', password: 'Contraseña',
    show: 'Mostrar', hide: 'Ocultar', change: 'Cambiar', thisPc: 'Esta PC', server: 'Servidor',
    connectingServer: 'Conectando con el servidor…', askBefore: 'Preguntar antes de aceptar una conexión',
    otherTitle: 'Ser The Jr de otro equipo', seniorCode: 'Código de El Senior', saveAs: 'Guardar como (opcional)',
    namePlaceholder: 'PC Oficina', connect: 'Conectar', myDevices: 'Mis equipos', remove: 'Quitar',
    emptySaved: 'Ponle nombre a un equipo al conectarte y aparecerá aquí.',
    querying: 'Consultando…', ready: 'Lista para conectar', noReplySince: 'No responde desde {when}',
    errCode: 'El código tiene 9 dígitos.', errPass: 'Escribe la contraseña del otro equipo.',
    unnamedDevice: 'Dispositivo sin nombre', inCharge: 'The Jr está al mando',
    st_ok: 'Lista para recibir a The Jr', st_ok_text: 'Conectada a {host}.',
    st_down: 'The Jr rompió producción (reintentando conexión...)', st_down_text: 'No hay conexión con el servidor. Revisa el internet de esta PC.',
    'st_id-taken': 'El servidor rechazó este código', 'st_id-taken_text': 'Otro equipo ya lo usa. Borra config.json para generar uno nuevo.',
    st_replaced: 'Este código se abrió en otra ventana', st_replaced_text: 'Cierra la otra copia del programa.',
    st_setup: 'Falta tu servidor', st_setup_text: 'Escribe su dirección en Configuración para empezar.',

    fileArrived: 'Llegó a Descargas\\The Jr: {name}',
    fileRunning: 'The Jr va corriendo con los documentos: {name} ({pct}%)', fileDelivered: 'Entregado: {name}',
    fileSaving: 'Guardando {name} al otro lado…', fileFailed: 'The Jr se tropezó con los documentos: {name} no llegó ({why}).',
    connectionCut: 'se cortó la conexión',

    whenLongAgo: 'hace tiempo', whenToday: 'hoy, {time}', whenYesterday: 'ayer, {time}', whenDate: 'el {date}, {time}',

    connected: 'Conectado', fit: 'Ajustar a la ventana', real: 'Tamaño real', full: 'Pantalla completa',
    sendFile: 'Enviar archivo', sendFileTip: 'También puedes soltar archivos sobre la pantalla',
    winKey: 'Tecla Windows', winKeyTip: 'Abre el menú Inicio de la otra PC', retry: 'Volver a intentar',
    connectingYourServer: 'Conectando con tu servidor…', searching: 'Buscando {name}…', waitingImage: 'Esperando la imagen…',
    deviceName: 'Equipo {code}', netRelay: 'Conectado por tu servidor, {ms} ms', netDirect: 'Conectado directo, {ms} ms',
    offlineWhy: 'El Senior ({name}) no responde desde {when}.',
    fail_server: 'The Jr rompió producción (reintentando conexión...)', fail_server_how: 'Revisa el internet de este equipo y que el servidor esté encendido.',
    fail_unknown: 'No existe un equipo con ese código.', fail_unknown_how: 'Revisa el código en la ventana del otro equipo.',
    fail_offline_how: 'Tu equipo y el servidor funcionan bien. Revisa que la otra PC esté encendida, sin suspender y con internet.',
    'fail_bad-password': 'Contraseña incorrecta.', 'fail_bad-password_how': 'Revisa la contraseña en la ventana del otro equipo.',
    fail_locked: 'Demasiados intentos fallidos.', fail_locked_how: 'El otro equipo bloqueó las conexiones por un minuto.',
    'fail_too-many': 'Demasiados intentos desde esta red.', 'fail_too-many_how': 'Espera un minuto y vuelve a intentar.',
    fail_denied: 'En el otro equipo rechazaron la conexión.',
    fail_busy: 'El Senior está atendiendo otra petición de conexión.', fail_busy_how: 'Espera unos segundos e intenta de nuevo.',
    fail_media: 'The Jr rompió producción (reintentando conexión...)', fail_media_how: 'Revisa que el relay TURN del servidor esté activo en el puerto 443.',
    fail_ended: 'El Senior cerró la sesión.',

    trayOpen: 'Abrir', trayQuit: 'Salir', trayActive: 'The Jr: al mando de esta PC',
    serverHint: 'Es el servidor que une tus equipos. Usa la misma dirección en todos, por ejemplo wss://remoto.tudominio.com.', saveServer: 'Guardar servidor', serverSaved: 'Listo: conectando con {host}.', errAddress: 'La dirección empieza con wss:// (o ws:// en tu red local).', needServer: 'Primero escribe la dirección de tu servidor en Configuración.',
    customPass: 'Contraseña para entrar a este equipo', customHint: 'Mínimo 8 caracteres. Reemplaza la contraseña generada.', savePass: 'Guardar contraseña', passSaved: 'Listo: ahora The Jr entra con esta contraseña.', passTooShort: 'La contraseña debe tener entre 8 y 64 caracteres.',
    allow: 'Permitir', reject: 'Rechazar', askMessage: 'The Jr pide permiso para poseer tu equipo',
    askDetail: '{device} quiere ver y controlar esta PC.', askUnnamed: 'Un dispositivo sin nombre',
  },
  en: {
    settings: 'Settings', close: 'Close', language: 'Language', about: 'About',
    version: 'Version {v}', repo: 'GitHub repository', noRepo: 'No repository configured yet.',
    checkUpdates: 'Check for updates', checking: 'Checking…', download: 'Download',
    upd_current: 'You have the latest version ({v}).', upd_new: 'A new version is available: {v}.',
    'upd_no-releases': 'The repository has no published releases (or it is not public).',
    'upd_no-repo': 'No repository configured yet.', upd_error: 'Couldn’t reach GitHub ({why}).',

    bandTitle: 'The Jr is in charge of this PC', bandTitleMany: '{n} The Jrs are in charge of this PC', bandInfo: '{device}, connected at {time}',
    sendFileToJr: 'Send file to The Jr', cut: 'Disconnect', showFile: 'Show in folder',
    seniorTitle: 'This computer is The Senior', code: 'Code', copyBoth: 'Copy code and password', copied: 'Copied', password: 'Password',
    show: 'Show', hide: 'Hide', change: 'Change', thisPc: 'This PC', server: 'Server',
    connectingServer: 'Connecting to the server…', askBefore: 'Ask before accepting a connection',
    otherTitle: 'Be The Jr of another computer', seniorCode: 'The Senior’s code', saveAs: 'Save as (optional)',
    namePlaceholder: 'Office PC', connect: 'Connect', myDevices: 'My computers', remove: 'Remove',
    emptySaved: 'Name a computer when you connect and it will show up here.',
    querying: 'Checking…', ready: 'Ready to connect', noReplySince: 'Not responding since {when}',
    errCode: 'The code has 9 digits.', errPass: 'Enter the other computer’s password.',
    unnamedDevice: 'Unnamed device', inCharge: 'The Jr is in charge',
    st_ok: 'Ready for The Jr', st_ok_text: 'Connected to {host}.',
    st_down: 'The Jr broke production (retrying connection...)', st_down_text: 'No connection to the server. Check this PC’s internet.',
    'st_id-taken': 'The server rejected this code', 'st_id-taken_text': 'Another computer already uses it. Delete config.json to get a new one.',
    st_replaced: 'This code was opened in another window', st_replaced_text: 'Close the other copy of the program.',
    st_setup: 'Your server is missing', st_setup_text: 'Enter its address in Settings to get started.',

    fileArrived: 'Saved to Downloads\\The Jr: {name}',
    fileRunning: 'The Jr is running with the documents: {name} ({pct}%)', fileDelivered: 'Delivered: {name}',
    fileSaving: 'Saving {name} on the other side…', fileFailed: 'The Jr tripped over the documents: {name} didn’t arrive ({why}).',
    connectionCut: 'the connection dropped',

    whenLongAgo: 'a while ago', whenToday: 'today, {time}', whenYesterday: 'yesterday, {time}', whenDate: '{date}, {time}',

    connected: 'Connected', fit: 'Fit to window', real: 'Actual size', full: 'Full screen',
    sendFile: 'Send file', sendFileTip: 'You can also drop files on the screen',
    winKey: 'Windows key', winKeyTip: 'Opens the other PC’s Start menu', retry: 'Try again',
    connectingYourServer: 'Connecting to your server…', searching: 'Looking for {name}…', waitingImage: 'Waiting for the picture…',
    deviceName: 'Computer {code}', netRelay: 'Connected through your server, {ms} ms', netDirect: 'Connected directly, {ms} ms',
    offlineWhy: 'The Senior ({name}) hasn’t responded since {when}.',
    fail_server: 'The Jr broke production (retrying connection...)', fail_server_how: 'Check this computer’s internet and that the server is on.',
    fail_unknown: 'There is no computer with that code.', fail_unknown_how: 'Check the code in the other computer’s window.',
    fail_offline_how: 'Your computer and the server are fine. Check that the other PC is on, not asleep, and online.',
    'fail_bad-password': 'Wrong password.', 'fail_bad-password_how': 'Check the password in the other computer’s window.',
    fail_locked: 'Too many failed attempts.', fail_locked_how: 'The other computer blocked connections for one minute.',
    'fail_too-many': 'Too many attempts from this network.', 'fail_too-many_how': 'Wait a minute and try again.',
    fail_denied: 'The connection was rejected on the other computer.',
    fail_busy: 'The Senior is handling another connection request.', fail_busy_how: 'Wait a few seconds and try again.',
    fail_media: 'The Jr broke production (retrying connection...)', fail_media_how: 'Check that the server’s TURN relay is running on port 443.',
    fail_ended: 'The Senior ended the session.',

    trayOpen: 'Open', trayQuit: 'Quit', trayActive: 'The Jr: in charge of this PC',
    serverHint: 'It’s the server that links your computers. Use the same address on all of them, for example wss://remote.yourdomain.com.', saveServer: 'Save server', serverSaved: 'Done: connecting to {host}.', errAddress: 'The address starts with wss:// (or ws:// on your local network).', needServer: 'First enter your server’s address in Settings.',
    customPass: 'Password to access this computer', customHint: 'At least 8 characters. Replaces the generated password.', savePass: 'Save password', passSaved: 'Done: The Jr now gets in with this password.', passTooShort: 'The password must be 8 to 64 characters long.',
    allow: 'Allow', reject: 'Reject', askMessage: 'The Jr asks permission to possess your computer',
    askDetail: '{device} wants to see and control this PC.', askUnnamed: 'An unnamed device',
  },
};

let lang = 'es';
const setLang = (l) => (lang = STRINGS[l] ? l : 'es');
const getLang = () => lang;
const t = (key, vars = {}) => (STRINGS[lang][key] ?? STRINGS.es[key] ?? '').replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

// Ventanas: data-i18n pone el texto; data-i18n-title y data-i18n-placeholder, esos atributos
function applyI18n() {
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
  for (const el of document.querySelectorAll('[data-i18n-placeholder]')) el.placeholder = t(el.dataset.i18nPlaceholder);
}

if (typeof module !== 'undefined') module.exports = { STRINGS, setLang, getLang, t };
