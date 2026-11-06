// Autenticación: administradores con correo y contraseña; jugadores con sesión anónima.

import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
  sendPasswordResetEmail, sendEmailVerification, signInAnonymously, updateProfile, reload,
} from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js';
import { getAuthInstance, getDb } from './db.js';

/** Garantiza una sesión (anónima si no hay otra) y devuelve el uid. */
export async function sesionAnonima() {
  const auth = getAuthInstance();
  if (auth.currentUser) return auth.currentUser.uid;
  const cred = await signInAnonymously(auth);
  return cred.user.uid;
}

export function usuarioActual() {
  return getAuthInstance().currentUser;
}

/**
 * Observa el estado de sesión y de administrador.
 * callback({ user, esAdmin, anonimo, verificado }) en cada cambio.
 */
export function observarSesion(callback) {
  const auth = getAuthInstance();
  const db = getDb();
  let unsubAdmin = null;
  return onAuthStateChanged(auth, (user) => {
    if (unsubAdmin) { unsubAdmin(); unsubAdmin = null; }
    if (!user || user.isAnonymous) {
      callback({ user, esAdmin: false, anonimo: Boolean(user && user.isAnonymous), verificado: false });
      return;
    }
    unsubAdmin = onSnapshot(doc(db, 'admins', user.uid), (s) => {
      callback({ user, esAdmin: s.exists(), anonimo: false, verificado: Boolean(user.emailVerified), adminDoc: s.exists() ? s.data() : null });
    }, () => {
      callback({ user, esAdmin: false, anonimo: false, verificado: Boolean(user.emailVerified) });
    });
  });
}

export async function iniciarSesion(email, password) {
  const auth = getAuthInstance();
  if (auth.currentUser && auth.currentUser.isAnonymous) await signOut(auth);
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
}

export async function crearCuenta(email, password, nombre) {
  const auth = getAuthInstance();
  if (auth.currentUser && auth.currentUser.isAnonymous) await signOut(auth);
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  if (nombre) await updateProfile(cred.user, { displayName: nombre.trim() });
  try { await sendEmailVerification(cred.user); } catch { /* se puede reenviar después */ }
  return cred.user;
}

export async function reenviarVerificacion() {
  const u = usuarioActual();
  if (u) await sendEmailVerification(u);
}

export async function recargarUsuario() {
  const u = usuarioActual();
  if (u) await reload(u);
  return usuarioActual();
}

export async function cerrarSesion() {
  await signOut(getAuthInstance());
}

export async function recuperarContrasena(email) {
  await sendPasswordResetEmail(getAuthInstance(), email.trim());
}

/**
 * Intenta dar de alta al propietario como primer administrador.
 * Las reglas solo lo permiten si el correo verificado coincide con el propietario.
 * Devuelve true si quedó como admin.
 */
export async function intentarAltaPropietario(user) {
  if (!user || user.isAnonymous || !user.emailVerified) return false;
  const db = getDb();
  const ref = doc(db, 'admins', user.uid);
  try {
    const existente = await getDoc(ref);
    if (existente.exists()) return true;
  } catch { /* sin permiso de lectura: seguimos intentando crear */ }
  try {
    await setDoc(ref, {
      email: user.email,
      nombre: user.displayName || user.email,
      creadoEn: serverTimestamp(),
      creadoPor: 'propietario',
    });
  } catch {
    return false;
  }
  try {
    const acceso = await getDoc(doc(db, 'privado', 'acceso'));
    if (!acceso.exists()) {
      await setDoc(doc(db, 'privado', 'acceso'), { pin: '', emailPropietario: user.email, creadoEn: serverTimestamp() });
    }
  } catch { /* ya existe o sin permiso */ }
  return true;
}

export async function solicitarAdmin(nombre) {
  const user = usuarioActual();
  if (!user || user.isAnonymous) throw new Error('Debes iniciar sesión con tu correo.');
  if (!user.emailVerified) throw new Error('Primero verifica tu correo desde el enlace que te enviamos.');
  const db = getDb();
  await setDoc(doc(db, 'solicitudesAdmin', user.uid), {
    email: user.email,
    nombre: (nombre || user.displayName || user.email).trim().slice(0, 60),
    creadoEn: serverTimestamp(),
  });
}
