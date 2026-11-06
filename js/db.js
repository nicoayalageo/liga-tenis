// Inicialización de Firebase y suscripción en tiempo real al estado de la liga.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js';
import {
  getFirestore, collection, doc, onSnapshot, query, orderBy, where,
} from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js';
import { firebaseConfig, FIREBASE_CONFIGURADO } from './firebase-config.js';
import { normalizarConfig } from './core/model.js';

export { FIREBASE_CONFIGURADO };

let app = null;
let db = null;
let auth = null;

export function firebase() {
  if (!FIREBASE_CONFIGURADO) throw new Error('Firebase no está configurado. Completa js/firebase-config.js.');
  if (!app) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    auth.languageCode = 'es';
  }
  return { app, db, auth };
}

export function getDb() {
  return firebase().db;
}

export function getAuthInstance() {
  return firebase().auth;
}

function docsDe(snap) {
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Suscribe a config, jugadores, partidos y playoffs.
 * callback(liga, meta) se llama cuando las cuatro fuentes cargaron y en cada cambio posterior.
 * onError(error) recibe fallos de red o permisos.
 */
export function suscribirLiga(callback, onError = () => {}) {
  const { db } = firebase();
  const estado = { config: null, jugadores: null, partidos: null, playoffs: null };
  const listo = () => Object.values(estado).every((v) => v !== null);
  let ultimaActualizacion = null;
  const emitir = (snapMeta) => {
    if (!listo()) return;
    const liga = {
      config: normalizarConfig(estado.config.datos),
      jugadores: estado.jugadores,
      partidos: estado.partidos,
      playoffs: estado.playoffs.datos,
    };
    callback(liga, { desdeCache: Boolean(snapMeta && snapMeta.fromCache), ultimaActualizacion });
  };
  const subs = [
    onSnapshot(doc(db, 'liga', 'config'), (s) => {
      estado.config = { datos: s.exists() ? s.data() : {} };
      if (s.exists() && s.data().updatedAt) ultimaActualizacion = s.data().updatedAt;
      emitir(s.metadata);
    }, onError),
    onSnapshot(query(collection(db, 'jugadores'), orderBy('nombre')), (s) => {
      estado.jugadores = docsDe(s);
      emitir(s.metadata);
    }, onError),
    onSnapshot(query(collection(db, 'partidos'), orderBy('fecha', 'desc')), (s) => {
      estado.partidos = docsDe(s);
      emitir(s.metadata);
    }, onError),
    onSnapshot(doc(db, 'playoffs', 'actual'), (s) => {
      estado.playoffs = { datos: s.exists() ? s.data() : null };
      emitir(s.metadata);
    }, onError),
  ];
  return () => subs.forEach((u) => u());
}

export function suscribirPropuestasPendientes(callback, onError = () => {}) {
  const { db } = firebase();
  const q = query(collection(db, 'propuestas'), where('estadoPropuesta', '==', 'pendiente'), orderBy('creadoEn', 'desc'));
  return onSnapshot(q, (s) => callback(docsDe(s)), onError);
}

export function suscribirPropuestasResueltas(callback, onError = () => {}) {
  const { db } = firebase();
  const q = query(collection(db, 'propuestas'), where('estadoPropuesta', 'in', ['aprobada', 'rechazada']), orderBy('creadoEn', 'desc'));
  return onSnapshot(q, (s) => callback(docsDe(s)), onError);
}

export function suscribirMisPropuestas(uid, callback, onError = () => {}) {
  const { db } = firebase();
  const q = query(collection(db, 'propuestas'), where('enviadoPorUid', '==', uid), orderBy('creadoEn', 'desc'));
  return onSnapshot(q, (s) => callback(docsDe(s)), onError);
}

export function suscribirHistorial(callback, onError = () => {}) {
  const { db } = firebase();
  const q = query(collection(db, 'historial'), orderBy('fecha', 'desc'));
  return onSnapshot(q, (s) => callback(docsDe(s).slice(0, 200)), onError);
}

export function suscribirAdmins(callback, onError = () => {}) {
  const { db } = firebase();
  return onSnapshot(collection(db, 'admins'), (s) => callback(docsDe(s)), onError);
}

export function suscribirSolicitudes(callback, onError = () => {}) {
  const { db } = firebase();
  return onSnapshot(collection(db, 'solicitudesAdmin'), (s) => callback(docsDe(s)), onError);
}

export function suscribirAcceso(callback, onError = () => {}) {
  const { db } = firebase();
  return onSnapshot(doc(db, 'privado', 'acceso'), (s) => callback(s.exists() ? s.data() : null), onError);
}

/** Traduce errores de Firebase a mensajes en español. */
export function mensajeError(e) {
  const code = (e && e.code) || '';
  const tabla = {
    'permission-denied': 'No tienes permiso para esta acción.',
    'unavailable': 'Sin conexión con la base de datos. Revisa tu internet.',
    'failed-precondition': 'La base de datos necesita un índice o cambió mientras guardabas. Intenta de nuevo.',
    'not-found': 'El dato ya no existe.',
    'aborted': 'Otro cambio se guardó al mismo tiempo. Intenta de nuevo.',
    'auth/invalid-email': 'El correo no es válido.',
    'auth/user-not-found': 'No existe una cuenta con ese correo.',
    'auth/wrong-password': 'Contraseña incorrecta.',
    'auth/invalid-credential': 'Correo o contraseña incorrectos.',
    'auth/invalid-login-credentials': 'Correo o contraseña incorrectos.',
    'auth/email-already-in-use': 'Ya existe una cuenta con ese correo. Inicia sesión.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos.',
    'auth/network-request-failed': 'Sin conexión. Revisa tu internet.',
    'auth/operation-not-allowed': 'Este método de acceso no está habilitado en Firebase.',
    'auth/admin-restricted-operation': 'El acceso anónimo no está habilitado en Firebase.',
    'auth/unauthorized-domain': 'Este dominio no está autorizado en Firebase Authentication.',
  };
  if (tabla[code]) return tabla[code];
  if (e && e.name === 'LigaError') return e.message;
  if (e && e.message && /Firebase no está configurado/.test(e.message)) return e.message;
  return (e && e.message) ? `Error: ${e.message}` : 'Ocurrió un error inesperado.';
}
