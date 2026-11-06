// Mutaciones sobre Firestore. Todas las escrituras definitivas pasan por aquí.

import {
  doc, collection, setDoc, updateDoc, deleteDoc, addDoc, getDoc, runTransaction, writeBatch, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js';
import { getDb } from './db.js';
import { codificar } from './core/firestore-codec.js';
import { newId, normalizarConfig, LigaError, validarNombreJugador, validarInscripcion, prepararPartido, idJugador, idPartido } from './core/model.js';
import { canAddMatch, generarRoundRobin, generarPlayoffs, tieneDependientes, crucesPlayoffsAbiertos, pendientes } from './core/fixtures.js';
import { computeStandings } from './core/standings.js';
import { formatScore } from './core/scoring.js';
import { partidosEntre } from './core/stats.js';

function ahoraIso() {
  return new Date().toISOString();
}

// Firestore no admite listas anidadas (sets, jornadas del calendario): se codifican al escribir
// y db.js las decodifica al leer. Ver core/firestore-codec.js.
const paraFirestore = codificar;

function entradaHistorial(batchOrTx, db, accion, detalle, actor) {
  const ref = doc(collection(db, 'historial'));
  batchOrTx.set(ref, { accion, detalle, actor: actor || '—', fecha: ahoraIso(), creadoEn: serverTimestamp() });
}

function nombre(liga, id) {
  const j = (liga.jugadores || []).find((x) => x.id === id);
  return j ? j.nombre : id;
}

function descripcionPartido(liga, p) {
  return `${nombre(liga, p.jugador1)} vs ${nombre(liga, p.jugador2)} · ${formatScore(p)} · ${p.fecha}`;
}

// ---------- Configuración ----------

export async function guardarConfig(liga, cambios, actor) {
  const db = getDb();
  const nueva = normalizarConfig({ ...liga.config, ...cambios, configurada: true });
  // Si cambia el formato de liga a uno con tope, verificar que no se viole.
  const batch = writeBatch(db);
  const { updatedAt, updatedBy, ...resto } = nueva;
  batch.set(doc(db, 'liga', 'config'), paraFirestore({ ...resto, updatedAt: ahoraIso(), updatedBy: actor || null }));
  entradaHistorial(batch, db, 'config', 'Configuración actualizada', actor);
  await batch.commit();
  return nueva;
}

export async function guardarPin(pin, actor) {
  const db = getDb();
  const limpio = String(pin || '').trim();
  if (limpio.length < 4 || limpio.length > 20) throw new LigaError('El PIN debe tener entre 4 y 20 caracteres.');
  const batch = writeBatch(db);
  batch.set(doc(db, 'privado', 'acceso'), { pin: limpio, actualizadoEn: ahoraIso() }, { merge: true });
  entradaHistorial(batch, db, 'pin', 'PIN de la liga actualizado', actor);
  await batch.commit();
}

// ---------- Jugadores ----------

export async function agregarJugador(liga, nombreNuevo, actor) {
  const db = getDb();
  const v = validarNombreJugador(nombreNuevo, liga.jugadores);
  if (!v.ok) throw new LigaError(v.motivo);
  const id = idJugador(v.nombre);
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'jugadores', id);
    const existente = await tx.get(ref);
    if (existente.exists()) throw new LigaError(`Ya existe un jugador llamado ${existente.data().nombre}.`);
    tx.set(ref, { nombre: v.nombre, activo: true, creadoEn: ahoraIso() });
    entradaHistorial(tx, db, 'jugador', `Jugador agregado: ${v.nombre}`, actor);
  });
  return id;
}

export async function renombrarJugador(liga, id, nombreNuevo, actor) {
  const db = getDb();
  const v = validarNombreJugador(nombreNuevo, liga.jugadores, id);
  if (!v.ok) throw new LigaError(v.motivo);
  const anterior = nombre(liga, id);
  const batch = writeBatch(db);
  batch.update(doc(db, 'jugadores', id), { nombre: v.nombre });
  entradaHistorial(batch, db, 'jugador', `Jugador renombrado: ${anterior} → ${v.nombre}`, actor);
  await batch.commit();
}

export async function setJugadorActivo(liga, id, activo, actor) {
  const db = getDb();
  const batch = writeBatch(db);
  batch.update(doc(db, 'jugadores', id), { activo: Boolean(activo) });
  entradaHistorial(batch, db, 'jugador', `${nombre(liga, id)} ${activo ? 'reactivado' : 'marcado como retirado'}`, actor);
  await batch.commit();
}

export async function eliminarJugador(liga, id, actor) {
  const db = getDb();
  const tiene = (liga.partidos || []).some((m) => m.jugador1 === id || m.jugador2 === id);
  if (tiene) throw new LigaError('No se puede eliminar un jugador con partidos registrados. Márcalo como retirado.');
  const batch = writeBatch(db);
  batch.delete(doc(db, 'jugadores', id));
  entradaHistorial(batch, db, 'jugador', `Jugador eliminado: ${nombre(liga, id)}`, actor);
  await batch.commit();
}

// ---------- Inscripciones ----------

export async function enviarInscripcion(liga, datos, pin, uid) {
  const db = getDb();
  const v = validarInscripcion(datos, liga ? liga.jugadores : []);
  if (!v.ok) throw new LigaError(v.motivo);
  const limpio = String(pin || '').trim();
  if (!limpio) throw new LigaError('Ingresa el PIN de la liga.');
  const registro = {
    ...v.datos,
    estado: 'pendiente',
    enviadoPorUid: uid,
    pin: limpio,
    creadoEn: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, 'inscripciones'), registro);
  return ref.id;
}

export async function aprobarInscripcion(liga, inscripcion, nombreFinal, actor) {
  const db = getDb();
  const v = validarNombreJugador(nombreFinal, liga.jugadores);
  if (!v.ok) throw new LigaError(v.motivo);
  const idNuevo = idJugador(v.nombre);
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'inscripciones', inscripcion.id);
    const s = await tx.get(ref);
    if (!s.exists()) throw new LigaError('La inscripción ya no existe.');
    if (s.data().estado !== 'pendiente') throw new LigaError('Esta inscripción ya fue resuelta por otra persona.');
    const refJugador = doc(db, 'jugadores', idNuevo);
    const yaExiste = await tx.get(refJugador);
    if (yaExiste.exists()) throw new LigaError(`Ya existe un jugador llamado ${yaExiste.data().nombre}. Usa "Editar nombre y aprobar".`);
    tx.set(refJugador, {
      nombre: v.nombre,
      activo: true,
      creadoEn: ahoraIso(),
      origen: 'inscripcion',
      inscripcionId: inscripcion.id,
      contacto: inscripcion.contacto || '',
    });
    tx.update(ref, { estado: 'aprobada', resueltoPor: actor || null, resueltoEn: ahoraIso(), jugadorId: idNuevo, nombreFinal: v.nombre, pin: '' });
    entradaHistorial(tx, db, 'inscripcion', `Inscripción aprobada: ${v.nombre}${v.nombre !== inscripcion.nombre ? ` (se inscribió como ${inscripcion.nombre})` : ''}`, actor);
  });
  return idNuevo;
}

export async function rechazarInscripcion(inscripcion, motivo, actor) {
  const db = getDb();
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'inscripciones', inscripcion.id);
    const s = await tx.get(ref);
    if (!s.exists()) throw new LigaError('La inscripción ya no existe.');
    if (s.data().estado !== 'pendiente') throw new LigaError('Esta inscripción ya fue resuelta por otra persona.');
    tx.update(ref, { estado: 'rechazada', resueltoPor: actor || null, resueltoEn: ahoraIso(), motivoRechazo: String(motivo || '').slice(0, 200), pin: '' });
    entradaHistorial(tx, db, 'inscripcion', `Inscripción rechazada: ${inscripcion.nombre}${motivo ? ` (${motivo})` : ''}`, actor);
  });
}

// ---------- Partidos ----------

function verificarCruce(liga, partido, excluirId = null) {
  if (partido.fase === 'playoffs') {
    const abiertos = crucesPlayoffsAbiertos({ ...liga, partidos: (liga.partidos || []).filter((m) => m.id !== excluirId) });
    const cruce = abiertos.find((c) => c.id === partido.llaveId);
    if (!cruce) throw new LigaError('Ese cruce de playoffs no está disponible.');
    const par = [cruce.jugador1, cruce.jugador2].sort().join('|');
    if ([partido.jugador1, partido.jugador2].sort().join('|') !== par) {
      throw new LigaError('Los jugadores no coinciden con el cruce de playoffs.');
    }
    return;
  }
  const c = canAddMatch(liga, partido.jugador1, partido.jugador2, { excluirId, permitirInactivos: Boolean(excluirId) });
  if (!c.ok) throw new LigaError(c.motivo);
}

export async function crearPartido(liga, datos, actor, extra = {}) {
  const db = getDb();
  const prep = prepararPartido(datos, liga.config);
  if (!prep.ok) throw new LigaError(prep.errores[0]);
  verificarCruce(liga, prep.partido);
  const id = idPartido(liga, prep.partido);
  const registro = {
    ...prep.partido,
    origen: extra.origen || 'admin',
    propuestaId: extra.propuestaId || null,
    ingresadoPor: actor || null,
    ingresadoEn: ahoraIso(),
    editadoPor: null,
    editadoEn: null,
  };
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'partidos', id);
    const existente = await tx.get(ref);
    if (existente.exists()) throw new LigaError(MENSAJE_PARTIDO_DUPLICADO);
    tx.set(ref, paraFirestore(registro));
    entradaHistorial(tx, db, 'partido', `Resultado ingresado: ${descripcionPartido(liga, registro)}`, actor);
  });
  return id;
}

const MENSAJE_PARTIDO_DUPLICADO = 'Ese partido ya está registrado (mismos jugadores y, en liga libre, misma fecha y marcador). Revisa Resultados.';

export async function editarPartido(liga, id, datos, actor) {
  const db = getDb();
  const existente = (liga.partidos || []).find((m) => m.id === id);
  if (!existente) throw new LigaError('Este partido ya no existe.');
  const prep = prepararPartido({ ...datos, fase: existente.fase, llaveId: existente.llaveId }, liga.config);
  if (!prep.ok) throw new LigaError(prep.errores[0]);
  if (existente.fase === 'playoffs') {
    const mismoPar = [existente.jugador1, existente.jugador2].sort().join('|') === [prep.partido.jugador1, prep.partido.jugador2].sort().join('|');
    if (!mismoPar) throw new LigaError('En playoffs no se pueden cambiar los jugadores del cruce.');
    if (prep.partido.ganador !== existente.ganador && tieneDependientes(liga, existente.llaveId)) {
      throw new LigaError('No se puede cambiar el ganador: ya se jugó la ronda siguiente.');
    }
  } else {
    verificarCruce(liga, prep.partido, id);
  }
  const batch = writeBatch(db);
  batch.update(doc(db, 'partidos', id), paraFirestore({ ...prep.partido, editadoPor: actor || null, editadoEn: ahoraIso() }));
  entradaHistorial(batch, db, 'partido', `Resultado editado: ${descripcionPartido(liga, existente)} → ${formatScore(prep.partido)}`, actor);
  await batch.commit();
}

export async function eliminarPartido(liga, id, actor) {
  const db = getDb();
  const existente = (liga.partidos || []).find((m) => m.id === id);
  if (!existente) throw new LigaError('Este partido ya no existe.');
  if (existente.fase === 'playoffs' && tieneDependientes(liga, existente.llaveId)) {
    throw new LigaError('Primero elimina el partido de la ronda siguiente.');
  }
  const batch = writeBatch(db);
  batch.delete(doc(db, 'partidos', id));
  entradaHistorial(batch, db, 'partido', `Resultado eliminado: ${descripcionPartido(liga, existente)}`, actor);
  await batch.commit();
}

// ---------- Propuestas (jugadores) ----------

export async function enviarPropuesta(liga, datos, pin, uid, enviadoComo) {
  const db = getDb();
  const prep = prepararPartido(datos, liga.config);
  if (!prep.ok) throw new LigaError(prep.errores[0]);
  verificarCruce(liga, prep.partido);
  const limpio = String(pin || '').trim();
  if (!limpio) throw new LigaError('Ingresa el PIN de la liga.');
  const registro = {
    ...prep.partido,
    estadoPropuesta: 'pendiente',
    enviadoPorUid: uid,
    enviadoComo: enviadoComo || prep.partido.jugador1,
    pin: limpio,
    creadoEn: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, 'propuestas'), paraFirestore(registro));
  return ref.id;
}

export async function aprobarPropuesta(liga, propuesta, datosFinales, actor) {
  const db = getDb();
  const prep = prepararPartido(datosFinales, liga.config);
  if (!prep.ok) throw new LigaError(prep.errores[0]);
  verificarCruce(liga, prep.partido);
  const idNuevo = idPartido(liga, prep.partido);
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'propuestas', propuesta.id);
    const s = await tx.get(ref);
    if (!s.exists()) throw new LigaError('La propuesta ya no existe.');
    if (s.data().estadoPropuesta !== 'pendiente') throw new LigaError('Esta propuesta ya fue resuelta por otra persona.');
    const refPartido = doc(db, 'partidos', idNuevo);
    const yaExiste = await tx.get(refPartido);
    if (yaExiste.exists()) throw new LigaError(MENSAJE_PARTIDO_DUPLICADO);
    tx.set(refPartido, paraFirestore({
      ...prep.partido,
      origen: 'propuesta',
      propuestaId: propuesta.id,
      ingresadoPor: actor || null,
      ingresadoEn: ahoraIso(),
      editadoPor: null,
      editadoEn: null,
      enviadoComo: propuesta.enviadoComo || null,
    }));
    tx.update(ref, { estadoPropuesta: 'aprobada', resueltoPor: actor || null, resueltoEn: ahoraIso(), partidoId: idNuevo, pin: '' });
    entradaHistorial(tx, db, 'propuesta', `Propuesta aprobada: ${descripcionPartido(liga, prep.partido)}`, actor);
  });
  return idNuevo;
}

export async function rechazarPropuesta(liga, propuesta, motivo, actor) {
  const db = getDb();
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'propuestas', propuesta.id);
    const s = await tx.get(ref);
    if (!s.exists()) throw new LigaError('La propuesta ya no existe.');
    if (s.data().estadoPropuesta !== 'pendiente') throw new LigaError('Esta propuesta ya fue resuelta por otra persona.');
    tx.update(ref, { estadoPropuesta: 'rechazada', resueltoPor: actor || null, resueltoEn: ahoraIso(), motivoRechazo: String(motivo || '').slice(0, 200), pin: '' });
    entradaHistorial(tx, db, 'propuesta', `Propuesta rechazada: ${descripcionPartido(liga, propuesta)}${motivo ? ` (${motivo})` : ''}`, actor);
  });
}

export async function eliminarPropuesta(propuesta) {
  const db = getDb();
  await deleteDoc(doc(db, 'propuestas', propuesta.id));
}

// ---------- Calendario y playoffs ----------

export async function generarCalendario(liga, actor) {
  const db = getDb();
  const activos = (liga.jugadores || []).filter((j) => j.activo !== false);
  if (activos.length < 2) throw new LigaError('Se necesitan al menos 2 jugadores activos.');
  const vueltas = liga.config.formatoLiga.startsWith('rr2') ? 2 : 1;
  const ids = activos.map((j) => j.id);
  // Mezcla aleatoria para que el orden de jornadas no dependa del alfabeto.
  for (let i = ids.length - 1; i > 0; i--) {
    const k = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[k]] = [ids[k], ids[i]];
  }
  const cal = generarRoundRobin(ids, vueltas);
  const calendario = { generadoEn: ahoraIso(), jugadores: cal.jugadores, jornadas: cal.jornadas, libres: cal.libres };
  const batch = writeBatch(db);
  batch.set(doc(db, 'liga', 'config'), paraFirestore({ calendario, updatedAt: ahoraIso(), updatedBy: actor || null }), { merge: true });
  entradaHistorial(batch, db, 'calendario', `Calendario generado: ${cal.jornadas.length} jornadas, ${ids.length} jugadores`, actor);
  await batch.commit();
  return calendario;
}

export async function borrarCalendario(actor) {
  const db = getDb();
  const batch = writeBatch(db);
  batch.update(doc(db, 'liga', 'config'), { calendario: null, updatedAt: ahoraIso(), updatedBy: actor || null });
  entradaHistorial(batch, db, 'calendario', 'Calendario eliminado', actor);
  await batch.commit();
}

export async function generarLlavePlayoffs(liga, actor) {
  const db = getDb();
  if (!liga.config.formatoLiga.endsWith('_playoffs')) throw new LigaError('El formato de liga no incluye playoffs.');
  if ((liga.partidos || []).some((m) => m.fase === 'playoffs')) throw new LigaError('Ya hay partidos de playoffs registrados. Elimínalos antes de regenerar la llave.');
  const tabla = computeStandings(liga).filter((f) => f.activo);
  const po = generarPlayoffs(tabla, { clasificados: liga.config.playoffs.clasificados, tercerPuesto: liga.config.playoffs.tercerPuesto, ahora: ahoraIso() });
  const batch = writeBatch(db);
  batch.set(doc(db, 'playoffs', 'actual'), paraFirestore(po));
  entradaHistorial(batch, db, 'playoffs', `Llave de playoffs generada con ${po.clasificados} clasificados`, actor);
  await batch.commit();
  return po;
}

export async function borrarLlavePlayoffs(liga, actor) {
  const db = getDb();
  if ((liga.partidos || []).some((m) => m.fase === 'playoffs')) throw new LigaError('Hay partidos de playoffs registrados. Elimínalos primero.');
  const batch = writeBatch(db);
  batch.delete(doc(db, 'playoffs', 'actual'));
  entradaHistorial(batch, db, 'playoffs', 'Llave de playoffs eliminada', actor);
  await batch.commit();
}

// ---------- Administradores ----------

export async function aprobarSolicitudAdmin(solicitud, actor) {
  const db = getDb();
  const batch = writeBatch(db);
  batch.set(doc(db, 'admins', solicitud.id), { email: solicitud.email, nombre: solicitud.nombre, creadoEn: serverTimestamp(), creadoPor: actor || null });
  batch.delete(doc(db, 'solicitudesAdmin', solicitud.id));
  entradaHistorial(batch, db, 'admin', `Administrador agregado: ${solicitud.nombre} (${solicitud.email})`, actor);
  await batch.commit();
}

export async function rechazarSolicitudAdmin(solicitud, actor) {
  const db = getDb();
  const batch = writeBatch(db);
  batch.delete(doc(db, 'solicitudesAdmin', solicitud.id));
  entradaHistorial(batch, db, 'admin', `Solicitud de administrador rechazada: ${solicitud.email}`, actor);
  await batch.commit();
}

export async function quitarAdmin(admin, actor, uidActual) {
  const db = getDb();
  if (admin.id === uidActual) throw new LigaError('No puedes quitarte a ti mismo.');
  const batch = writeBatch(db);
  batch.delete(doc(db, 'admins', admin.id));
  entradaHistorial(batch, db, 'admin', `Administrador quitado: ${admin.nombre || admin.email}`, actor);
  await batch.commit();
}

// ---------- Respaldo ----------

export function exportarLiga(liga, extras = {}) {
  return JSON.stringify({ exportadoEn: ahoraIso(), ...liga, ...extras }, null, 2);
}

export { pendientes, partidosEntre, getDoc, updateDoc, setDoc };
