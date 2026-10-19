// Versión de la app y búsqueda de actualizaciones en los Releases de GitHub (igual que desktop/updates.js).
import appJson from '../app.json';

export const REPO = 'MAntonio10/The-Jr-Remote'; // "usuario/repositorio" de GitHub; vacío mientras no exista (también en desktop/updates.js)
export const repoUrl = REPO && `https://github.com/${REPO}`;
export const version = appJson.expo.version;

// '1.10.0' es más nueva que '1.9.2'; ignora la "v" inicial y lo que va tras un guion
function isNewer(latest, current) {
  const parts = (v) => String(v).replace(/^v/, '').split('-')[0].split('.').map((n) => parseInt(n, 10) || 0);
  const a = parts(latest), b = parts(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
}

// -> { state: 'no-repo' | 'no-releases' | 'current' | 'new' | 'error', v, url, why }
export async function checkUpdates() {
  if (!REPO) return { state: 'no-repo' };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: ctrl.signal,
    });
    if (res.status === 404) return { state: 'no-releases' };
    if (!res.ok) return { state: 'error', why: `HTTP ${res.status}` };
    const release = await res.json();
    if (!isNewer(release.tag_name, version)) return { state: 'current', v: version };
    // Solo se abren páginas de este repositorio, nunca una dirección arbitraria de la respuesta
    const url = String(release.html_url).startsWith(`${repoUrl}/`) ? release.html_url : `${repoUrl}/releases`;
    return { state: 'new', v: String(release.tag_name).replace(/^v/, ''), url };
  } catch (e) {
    return { state: 'error', why: e.message };
  } finally {
    clearTimeout(timer);
  }
}
