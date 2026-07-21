/*
 * TORI · Praga — envoltorio de escritorio (Electron)
 * ---------------------------------------------------
 * Objetivo: correr TORI como aplicación .exe, guardando TODOS los datos
 * en el PC (carpeta propia, aislada del navegador). Limpiar Chrome ya no
 * borra nada.
 *
 * PRINCIPIO CLAVE: el HTML de TORI (app/tori.html) NO se modifica. Es una
 * copia byte-idéntica del original. Lo único que hacemos al servirlo es
 * redirigir las 2 librerías del CDN (xlsx y exceljs) a copias locales de
 * la MISMA versión, para que TORI funcione 100% offline. Ninguna función
 * ni pixel de TORI cambia.
 */

const { app, BrowserWindow, protocol, session, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// ─── Una sola instancia (evita abrir TORI dos veces sobre los mismos datos) ───
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {

app.setName('TORI');
// AppUserModelId → agrupa bien en la barra de tareas de Windows y usa el ícono.
app.setAppUserModelId('art.praga.tori');

const APP_ROOT   = __dirname;
const HTML_PATH  = path.join(APP_ROOT, 'app', 'tori.html');
const VENDOR_DIR = path.join(APP_ROOT, 'vendor');
const ICON_PATH  = path.join(APP_ROOT, 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png');

// URLs exactas del CDN que trae TORI (se redirigen a copias locales).
const CDN_XLSX  = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
const CDN_EXCEL = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
const LOCAL_XLSX  = 'tori://localhost/vendor/xlsx.full.min.js';
const LOCAL_EXCEL = 'tori://localhost/vendor/exceljs.min.js';

/*
 * Esquema propio "tori://" con privilegios de origen seguro. Esto logra:
 *  - Contexto seguro → la File System Access API de TORI no falla como en file://
 *  - Origen ESTABLE (tori://localhost) → localStorage e IndexedDB persisten
 *    siempre en la misma bóveda, aunque se actualice la app.
 */
protocol.registerSchemesAsPrivileged([
  { scheme: 'tori', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
]);

let mainWindow = null;

function serveHtml() {
  let html = fs.readFileSync(HTML_PATH, 'utf8');
  // Redirigir las 2 librerías del CDN a las copias locales (misma versión).
  html = html.split(CDN_XLSX).join(LOCAL_XLSX)
             .split(CDN_EXCEL).join(LOCAL_EXCEL);
  return html;
}

function mime(file) {
  if (file.endsWith('.js'))   return 'application/javascript; charset=utf-8';
  if (file.endsWith('.css'))  return 'text/css; charset=utf-8';
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  return 'application/octet-stream';
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: 'TORI · Praga',
    icon: ICON_PATH,
    backgroundColor: '#ffffff',
    autoHideMenuBar: true,        // sin barra de menú Electron; TORI ocupa todo
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
      // Usa la sesión por defecto: ya es persistente en userData (la bóveda del PC).
    }
  });

  mainWindow.loadURL('tori://localhost/index.html');

  // Enlaces externos → navegador del sistema, nunca dentro de TORI.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });

  // Antes de cerrar: respaldo de disco (best-effort).
  mainWindow.on('close', () => { try { makeBackup('cierre'); } catch (e) {} });
}

// ─── Respaldo automático extra (copia visible en Documentos) ─────────────────
// Copia la bóveda de datos (Local Storage + IndexedDB de la partición de TORI)
// a "Documentos/Backups TORI/". Es una red de seguridad ante desastres, además
// del backup .json propio de TORI (que incluye fotos). Rota: deja los últimos 5.
function storageRoot() {
  // La sesión por defecto guarda su almacenamiento directamente en userData.
  return app.getPath('userData');
}

function stamp() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

let _lastBackup = 0;
function makeBackup(motivo) {
  // No respaldar más de una vez por minuto (evita spam en cierres rápidos).
  const now = Date.now();
  if (now - _lastBackup < 60 * 1000) return;
  _lastBackup = now;

  const src = storageRoot();
  if (!fs.existsSync(src)) return;

  const destRoot = path.join(app.getPath('documents'), 'Backups TORI');
  fs.mkdirSync(destRoot, { recursive: true });
  const dest = path.join(destRoot, `TORI-${stamp()}`);

  try {
    for (const sub of ['Local Storage', 'IndexedDB']) {
      const s = path.join(src, sub);
      if (fs.existsSync(s)) fs.cpSync(s, path.join(dest, sub), { recursive: true });
    }
    // Nota de ayuda dentro de cada copia.
    fs.writeFileSync(path.join(dest, 'LEEME.txt'),
      'Copia de seguridad automatica de TORI (' + (motivo || '') + ').\r\n' +
      'Para restaurar en una emergencia: cierra TORI y reemplaza las carpetas\r\n' +
      '"Local Storage" e "IndexedDB" dentro de la boveda de datos de TORI por estas.\r\n' +
      'Lo normal, sin embargo, es restaurar con el backup .json propio de TORI\r\n' +
      '(boton de backup dentro de la app), que incluye las fotos.\r\n');

    // Rotación: dejar las últimas 5.
    const all = fs.readdirSync(destRoot).filter(n => n.startsWith('TORI-')).sort();
    while (all.length > 5) {
      const old = all.shift();
      fs.rmSync(path.join(destRoot, old), { recursive: true, force: true });
    }
  } catch (e) {
    console.warn('[backup] error:', e && e.message);
  }
}

// ─── Arranque ────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // Servidor interno del esquema tori://
  protocol.handle('tori', (request) => {
    const url = new URL(request.url);
    let p = decodeURIComponent(url.pathname);

    if (p === '' || p === '/' || p === '/index.html') {
      return new Response(serveHtml(), { headers: { 'content-type': 'text/html; charset=utf-8' } });
    }
    if (p.startsWith('/vendor/')) {
      const file = path.join(VENDOR_DIR, path.basename(p));
      if (fs.existsSync(file)) {
        return new Response(fs.readFileSync(file), { headers: { 'content-type': mime(file) } });
      }
    }
    return new Response('No encontrado', { status: 404 });
  });

  // Red de seguridad: si algo intenta el CDN directo, redirigir a local.
  // (Normalmente no ocurre porque ya reescribimos el HTML servido.)
  session.defaultSession.webRequest.onBeforeRequest((details, cb) => {
    if (details.url === CDN_XLSX)  return cb({ redirectURL: LOCAL_XLSX });
    if (details.url === CDN_EXCEL) return cb({ redirectURL: LOCAL_EXCEL });
    cb({});
  });

  createWindow();

  // Respaldo periódico cada 30 minutos.
  setInterval(() => { try { makeBackup('automatico'); } catch (e) {} }, 30 * 60 * 1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Segunda instancia → enfocar la existente.
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('before-quit', () => { try { makeBackup('salida'); } catch (e) {} });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

} // fin del lock de instancia única
