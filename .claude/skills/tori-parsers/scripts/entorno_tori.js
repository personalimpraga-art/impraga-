/**
 * entorno_tori.js (copia de tori-engineering, MEJORADA: elementos con
 * listeners reales y _disparar() para simular eventos de inputs) — Arranca TORI de verdad en Node (sin navegador).
 *
 * Implementa el entorno del §6 del mapa técnico:
 *  - IndexedDB en memoria (keyPath y clave explícita, requests via queueMicrotask)
 *  - DOM permisivo (getElementById con caché que crea elementos)
 *  - localStorage en objeto, location con hostname 'localhost', showSaveFilePicker presente
 *
 * Uso:
 *   const { crearEntorno } = require('./entorno_tori');
 *   const env = crearEntorno();
 *   env.cargarBloque('/tmp/tori_bloques/bloque_0.js');
 *   env.cargarBloque('/tmp/tori_bloques/bloque_3.js');
 *   await env.esperar();              // drena microtasks/timers cortos
 *   env.ctx.TORI ...                  // el objeto global real de TORI
 *
 * PITFALL de realms (§6): vm.runInContext crea un realm separado. Para probar
 * exports con ExcelJS NO uses este entorno completo: extrae la función y evalúala
 * en el realm host. Para backup, renders y flujos, este entorno sirve.
 */
'use strict';
const vm = require('vm');
const fs = require('fs');

/* ── IndexedDB en memoria ───────────────────────────────────────────── */
function crearIndexedDB() {
  const dbs = {}; // {nombre: {stores: {nombre: {keyPath, data: Map}}}}

  function Req() { this.onsuccess = null; this.onerror = null; this.result = undefined; }
  function fire(req, result) {
    req.result = result;
    queueMicrotask(() => { if (req.onsuccess) req.onsuccess({ target: req }); });
    return req;
  }

  function Store(st) {
    this._st = st;
    this.keyPath = st.keyPath || null;
  }
  Store.prototype.put = function (value, key) {
    const k = key !== undefined ? key : (this._st.keyPath ? value[this._st.keyPath] : undefined);
    this._st.data.set(k, value);
    return fire(new Req(), k);
  };
  Store.prototype.get = function (key) { return fire(new Req(), this._st.data.get(key)); };
  Store.prototype.getAll = function () { return fire(new Req(), Array.from(this._st.data.values())); };
  Store.prototype.getAllKeys = function () { return fire(new Req(), Array.from(this._st.data.keys())); };
  Store.prototype.delete = function (key) { this._st.data.delete(key); return fire(new Req(), undefined); };
  Store.prototype.clear = function () { this._st.data.clear(); return fire(new Req(), undefined); };
  Store.prototype.count = function () { return fire(new Req(), this._st.data.size); };

  function DB(rec, nombre) {
    this._rec = rec;
    this.name = nombre;
    // DOMStringList real: iterable, con length, item() y contains()
    Object.defineProperty(this, 'objectStoreNames', {
      get() {
        const nombres = Object.keys(rec.stores);
        nombres.contains = (n) => nombres.indexOf(n) >= 0;
        nombres.item = (i) => nombres[i] || null;
        return nombres;
      },
    });
  }
  DB.prototype.createObjectStore = function (nombre, opts) {
    this._rec.stores[nombre] = this._rec.stores[nombre] ||
      { keyPath: (opts && opts.keyPath) || null, data: new Map() };
    return new Store(this._rec.stores[nombre]);
  };
  DB.prototype.transaction = function (nombres, _modo) {
    const rec = this._rec;
    const tx = {
      oncomplete: null, onerror: null, error: null,
      objectStore(n) {
        if (!rec.stores[n]) rec.stores[n] = { keyPath: null, data: new Map() };
        return new Store(rec.stores[n]);
      },
      abort() {},
    };
    // oncomplete después de que los requests de la tx dispararon
    queueMicrotask(() => queueMicrotask(() => { if (tx.oncomplete) tx.oncomplete(); }));
    return tx;
  };
  DB.prototype.close = function () {};

  return {
    _dbs: dbs, // expuesto para sembrar datos ANTES del boot (p. ej. handle FSA)
    open(nombre, _version) {
      const req = new Req();
      req.onupgradeneeded = null;
      const nuevo = !dbs[nombre];
      if (nuevo) dbs[nombre] = { stores: {} };
      const db = new DB(dbs[nombre], nombre);
      queueMicrotask(() => {
        req.result = db; // la API real expone request.result DURANTE onupgradeneeded
        if (nuevo && req.onupgradeneeded) req.onupgradeneeded({ target: { result: db } });
        if (req.onsuccess) req.onsuccess({ target: { result: db } });
      });
      return req;
    },
    deleteDatabase(nombre) { delete dbs[nombre]; return fire(new Req(), undefined); },
    /** Siembra directa: sembrar('praga_fsa_v1','data','fileHandle', handle) */
    sembrar(dbName, storeName, key, value) {
      dbs[dbName] = dbs[dbName] || { stores: {} };
      dbs[dbName].stores[storeName] = dbs[dbName].stores[storeName] || { keyPath: null, data: new Map() };
      dbs[dbName].stores[storeName].data.set(key, value);
    },
    leer(dbName, storeName, key) {
      try { return dbs[dbName].stores[storeName].data.get(key); } catch (e) { return undefined; }
    },
  };
}

/* ── DOM permisivo ──────────────────────────────────────────────────── */
function crearElemento(id) {
  const el = {
    id: id || '', tagName: 'DIV', innerHTML: '', textContent: '', value: '',
    checked: false, disabled: false, title: '', src: '', href: '',
    style: new Proxy({}, { get: () => '', set: () => true }),
    dataset: {}, children: [], files: [],
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    _listeners: {},
    addEventListener(ev, fn) { (el._listeners[ev] = el._listeners[ev] || []).push(fn); },
    removeEventListener() {},
    dispatchEvent(evento) {
      (el._listeners[(evento && evento.type) || ''] || []).forEach(fn => fn(evento));
    },
    /** Dispara un evento con target=el (para simular change de inputs de archivo) */
    _disparar(tipo, props) {
      const evento = Object.assign({ type: tipo, target: el, preventDefault() {}, stopPropagation() {} }, props || {});
      (el._listeners[tipo] || []).forEach(fn => fn(evento));
    },
    appendChild(c) { el.children.push(c); return c; },
    removeChild() {}, remove() {}, insertBefore(c) { el.children.push(c); return c; },
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
    closest() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; },
    focus() {}, blur() {}, click() {}, scrollIntoView() {},
    getContext() { return null; },
    getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 }; },
  };
  return el;
}

function crearDocument() {
  const cache = {};
  const listeners = {}; // eventos de document (DOMContentLoaded, click, ...)
  const doc = {
    getElementById(id) { if (!cache[id]) cache[id] = crearElemento(id); return cache[id]; },
    createElement(tag) { const e = crearElemento(''); e.tagName = String(tag).toUpperCase(); return e; },
    createTextNode(t) { return { textContent: t }; },
    querySelector() { return crearElemento(''); },
    querySelectorAll() { return []; },
    addEventListener(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
    removeEventListener() {},
    body: crearElemento('body'),
    head: crearElemento('head'),
    documentElement: crearElemento('html'),
    readyState: 'complete',
    title: 'TORI',
    _cache: cache,
    _disparar(ev) { (listeners[ev] || []).forEach(fn => { try { fn({ type: ev }); } catch (e) { console.error('[DOM ' + ev + ']', e.message); } }); },
  };
  return doc;
}

/* ── Entorno completo ───────────────────────────────────────────────── */
function crearEntorno(opts) {
  opts = opts || {};
  const idb = crearIndexedDB();
  const doc = crearDocument();
  const lsData = {};
  const localStorage = {
    getItem: (k) => (k in lsData ? lsData[k] : null),
    setItem: (k, v) => { lsData[k] = String(v); },
    removeItem: (k) => { delete lsData[k]; },
    clear: () => { for (const k of Object.keys(lsData)) delete lsData[k]; },
    key: (i) => Object.keys(lsData)[i] || null,
    get length() { return Object.keys(lsData).length; },
  };

  const sandbox = {
    console, setTimeout, clearTimeout, setInterval, clearInterval,
    queueMicrotask, Promise, JSON, Math, Date, Array, Object, String, Number,
    Boolean, RegExp, Error, TypeError, Map, Set, WeakMap, parseFloat, parseInt,
    isNaN, isFinite, encodeURIComponent, decodeURIComponent, escape, unescape,
    Uint8Array, ArrayBuffer, Blob, File, FileReader: function () { this.readAsDataURL = () => {}; this.readAsArrayBuffer = () => {}; },
    URL: { createObjectURL: () => 'blob:falso', revokeObjectURL: () => {} },
    fetch: () => Promise.reject(new Error('fetch deshabilitado en pruebas')),
    indexedDB: idb,
    localStorage,
    sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    document: doc,
    location: { hostname: 'localhost', protocol: 'http:', href: 'http://localhost/', reload() {} },
    navigator: {
      storage: { estimate: async () => ({ usage: 1024, quota: 1024 * 1024 * 500 }) },
      userAgent: 'Node-Prueba', clipboard: { writeText: async () => {} },
    },
    alert: () => {}, confirm: () => true, prompt: () => null,
    showSaveFilePicker: async () => { throw new Error('picker no disponible en pruebas'); },
    showOpenFilePicker: async () => { throw new Error('picker no disponible en pruebas'); },
    XLSX: opts.XLSX || undefined, // SheetJS real si la prueba lo necesita
    requestAnimationFrame: (fn) => setTimeout(fn, 0),
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    addEventListener: () => {}, removeEventListener: () => {},
    performance: { now: () => Date.now() },
    crypto: { getRandomValues: (a) => { for (let i = 0; i < a.length; i++) a[i] = (Math.random() * 256) | 0; return a; } },
    Image: function () { return { set src(v) {}, addEventListener() {} }; },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  const ctx = vm.createContext(sandbox);

  return {
    ctx, idb, doc, localStorage, lsData,
    cargarBloque(ruta) {
      const codigo = fs.readFileSync(ruta, 'utf-8');
      vm.runInContext(codigo, ctx, { filename: ruta });
    },
    dispararDOMReady() { doc._disparar('DOMContentLoaded'); },
    /** Drena microtasks y timers cortos (los inits de TORI usan setTimeout 0–1500ms) */
    async esperar(ms) {
      const fin = Date.now() + (ms || 2000);
      while (Date.now() < fin) await new Promise(r => setTimeout(r, 25));
    },
  };
}

module.exports = { crearEntorno, crearIndexedDB, crearDocument };
