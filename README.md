# The Jr

Escritorio remoto propio con nombres de oficina: la PC que se deja controlar es **El Senior** y quien la controla (otra PC o el teléfono) es **The Jr**. Controla una PC con Windows desde otra PC o desde un teléfono Android,
aunque la PC esté dentro de una intranet. Los dos equipos se conectan **hacia afuera** a tu servidor
por el puerto 443 (como cualquier página HTTPS) y el video viaja por WebRTC, directo o por el relay TURN.

| Carpeta | Qué es |
|---|---|
| `server/` | Señalización en Node.js (registra equipos, valida contraseñas, reenvía mensajes WebRTC) |
| `desktop/` | Programa de Windows en Electron: recibe conexiones y se conecta a otras PC |
| `mobile/` | App Android en Expo (React Native) para controlar las PC |
| `deploy/` | Configuración de nginx, coturn y systemd para el VPS |
| `logo/` | Logo en SVG (origen de `desktop/icon.ico`, `desktop/the-jr.svg` y los íconos de `mobile/assets/`) |

## Probar en tu red local

```bash
cd server && npm install && npm start          # escucha en :8080
cd desktop && npm install && npm start         # abre el programa
```

La primera vez el programa pide la dirección del servidor (también se cambia en **Configuración → Servidor**).
En la misma PC escribe `ws://localhost:8080`; en otra PC de la misma red, `ws://IP-DE-LA-PC-SERVIDOR:8080`.

Pruebas: `npm test` dentro de `server/` y de `desktop/`.

Para probar con el teléfono en la misma Wi-Fi, en la app pon `ws://IP-DE-LA-PC-SERVIDOR:8080` en "Tu servidor".
La primera vez que arranques el servidor, Windows preguntará si permite a Node.js en la red: acepta para **redes privadas**.

## Instalador de Windows

```bash
cd desktop
npm run build:helper  # compila el servicio TheJrHelper (desde cmd o PowerShell)
npm run dist          # genera dist\The Jr Setup 1.0.0.exe
```

El instalador no está firmado: Windows mostrará "Windows protegió tu PC" → "Más información" → "Ejecutar de todas formas".

## Poner el servidor en internet (VPS Ubuntu, ~5 USD/mes)

Necesitas un dominio con dos registros DNS tipo A hacia la IP del VPS: `remoto.TU_DOMINIO` y `turn.TU_DOMINIO`.

```bash
sudo apt install -y nginx libnginx-mod-stream coturn certbot nodejs
sudo mkdir -p /etc/coturn
sudo systemctl stop nginx   # certbot necesita el puerto 80 libre
sudo certbot certonly --standalone -d remoto.TU_DOMINIO -d turn.TU_DOMINIO \
  --deploy-hook "install -o turnserver -m 600 \$RENEWED_LINEAGE/fullchain.pem \$RENEWED_LINEAGE/privkey.pem /etc/coturn/ && systemctl reload nginx && systemctl restart coturn"
sudo mkdir -p /opt/sistema-remoto && sudo cp -r server /opt/sistema-remoto/ && (cd /opt/sistema-remoto/server && sudo npm install --omit=dev)
```

1. Copia `deploy/turnserver.conf` a `/etc/turnserver.conf` y `deploy/sistema-remoto.service` a `/etc/systemd/system/`.
2. Agrega `deploy/nginx.conf` a `/etc/nginx/nginx.conf` (las instrucciones están en el archivo).
3. Reemplaza `TU_DOMINIO`, `TU_IP_PUBLICA` y el secreto (el mismo en coturn y en el servicio; genéralo con `openssl rand -hex 32`).
4. Abre puertos: `sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw allow 3478 && sudo ufw allow 49160:49200/udp`
5. `sudo systemctl enable --now sistema-remoto coturn && sudo systemctl reload nginx`

En cada PC escribe `wss://remoto.TU_DOMINIO` en **Configuración → Servidor**. En el teléfono, la misma dirección en "Tu servidor".

### Con Docker (alternativa)

En `deploy/docker/` están el `Dockerfile` y un `docker-compose.yml` que levantan señalización, nginx y coturn con red del host. Certbot sigue en el VPS (los certificados se montan de solo lectura). Con Docker instalado: copia `.env.example` a `.env`, edítalo y ejecuta `docker compose -f deploy/docker/docker-compose.yml up -d --build`. Antes detén los servicios del método anterior (`systemctl disable --now sistema-remoto coturn nginx`) porque usan los mismos puertos.

## Compilar la app Android (sin Android Studio)

```bash
cd mobile && npm install
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile preview      # APK para instalar directo
```

EAS compila en la nube y te da un enlace al APK. Para desarrollar con recarga en caliente usa
`--profile development` una vez, instala ese APK y luego `npx expo start`. La app **no** funciona
en Expo Go porque usa WebRTC.

La app solo acepta conexiones cifradas (`wss://`); para probar con `ws://` en la red local hay que volver a activar `usesCleartextTraffic` con el plugin `expo-build-properties`.

## Archivos

Durante una sesión los archivos van en ambos sentidos por el mismo canal cifrado de WebRTC:

- **The Jr en PC**: botón "Enviar archivo" o soltar el archivo sobre la pantalla remota.
- **The Jr en Android**: recibe lo que manda El Senior y lo abre con "Abrir lo recibido" (guardar, compartir…).
- **El Senior**: botón "Enviar archivo a The Jr" en la franja amarilla. Como The Jr está controlando la pantalla, así se trae un archivo de la PC al teléfono.

En Windows lo recibido queda en `Descargas\The Jr`.

## Configuración, idioma y actualizaciones

El botón **Configuración** (arriba a la derecha en Windows, junto a "Mis equipos" en Android) permite:

- **Idioma:** español o inglés. La primera vez se usa el idioma del sistema.
- **Acerca de:** nombre, logo, versión y enlace al repositorio.
- **Buscar actualizaciones:** consulta el último Release del repositorio en GitHub. Si hay una versión nueva, muestra "Descargar", que abre la página del Release. No instala nada por su cuenta.

El repositorio que se consulta es `REPO` en `desktop/updates.js` y en `mobile/src/acerca.js`
(`MAntonio10/The-Jr-Remote`). Si haces tu propia versión, pon ahí el tuyo; debe ser público.

Para publicar una versión:
1. Sube el número en `desktop/package.json` y `mobile/app.json`.
2. Crea en GitHub un Release con la etiqueta `v1.0.1`, o el número que corresponda.

## Límites de esta versión

- Un solo monitor (el principal).

Varios The Jr pueden ver y controlar a la vez el mismo Senior (cada uno suma una codificación de video en El Senior), y desde una PC puedes controlar varios Senior, una ventana por cada uno. Las distribuciones de teclado pueden ser distintas: lo que escribe The Jr viaja como texto y El Senior lo teclea con la suya.

Los avisos de UAC y la pantalla de bloqueo sí se controlan: el instalador agrega el servicio `TheJrHelper` (SYSTEM), que captura e inyecta en el escritorio protegido. En el teléfono, pellizca para hacer zoom.

## Licencia

[AGPL-3.0](LICENSE). Puedes usar, modificar y compartir The Jr libremente. Si ofreces una versión modificada
como servicio (por ejemplo, tu propio servidor para otras personas), debes publicar el código de esos cambios
con la misma licencia.
