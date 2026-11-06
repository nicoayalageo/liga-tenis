// Modelo de la liga: valores por defecto, ids, normalización y validación integral.
// Módulo puro: sin DOM ni Firebase.

import { FORMATOS_LIGA, FORMATOS_PARTIDO, CRITERIOS_DESEMPATE, PRESETS_DESEMPATE } from './formats.js';
import { validateMatch } from './scoring.js';
import { reunionesRequeridas } from './fixtures.js';
import { partidosEntre } from './stats.js';

export const SCHEMA_VERSION = 1;

export class LigaError extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'LigaError';
  }
}

export function configPorDefecto() {
  return {
    schemaVersion: SCHEMA_VERSION,
    configurada: false,
    nombre: 'Liga de Tenis',
    temporada: String(new Date().getFullYear()),
    lema: 'Polvo de ladrillo, puntos y honor.',
    formatoLiga: 'rr1',
    formatoPartido: 'bo3_super',
    puntosVictoria: 1,
    puntosDerrota: 0,
    puntosDerrotaWO: 0,
    excluirWOdeSetsGames: true,
    superTiebreakCuentaGames: false,
    desempate: [...PRESETS_DESEMPATE.usta.criterios],
    h2hModo: PRESETS_DESEMPATE.usta.h2hModo,
    playoffs: { clasificados: 4, tercerPuesto: false },
    calendario: null,
    fechaInicio: null,
    updatedAt: null,
    updatedBy: null,
  };
}

/** Completa una configuración parcial con los valores por defecto. */
export function normalizarConfig(cfg) {
  const base = configPorDefecto();
  const c = { ...base, ...(cfg || {}) };
  if (!FORMATOS_LIGA[c.formatoLiga]) c.formatoLiga = base.formatoLiga;
  if (!FORMATOS_PARTIDO[c.formatoPartido]) c.formatoPartido = base.formatoPartido;
  for (const k of ['puntosVictoria', 'puntosDerrota', 'puntosDerrotaWO']) {
    c[k] = Number.isFinite(Number(c[k])) ? Number(c[k]) : base[k];
  }
  c.excluirWOdeSetsGames = c.excluirWOdeSetsGames !== false;
  c.superTiebreakCuentaGames = Boolean(c.superTiebreakCuentaGames);
  c.desempate = Array.isArray(c.desempate) ? c.desempate.filter((x) => CRITERIOS_DESEMPATE[x]) : base.desempate;
  c.h2hModo = c.h2hModo === 'solo2' ? 'solo2' : 'minitabla';
  c.playoffs = { ...base.playoffs, ...(c.playoffs || {}) };
  c.playoffs.clasificados = Math.max(2, Math.min(32, Number(c.playoffs.clasificados) || 4));
  c.playoffs.tercerPuesto = Boolean(c.playoffs.tercerPuesto);
  if (c.calendario && !Array.isArray(c.calendario.jornadas)) c.calendario = null;
  c.nombre = String(c.nombre || base.nombre).trim().slice(0, 80);
  c.temporada = String(c.temporada || '').trim().slice(0, 40);
  c.lema = String(c.lema || '').trim().slice(0, 120);
  return c;
}

const ALFABETO = '0123456789abcdefghijklmnopqrstuvwxyz';

export function newId(prefijo = 'x') {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += ALFABETO[b % ALFABETO.length];
  return `${prefijo}_${s}`;
}

export function hoyLocal(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function esFechaValida(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function validarNombreJugador(nombre, jugadores = [], excluirId = null) {
  const n = String(nombre || '').trim().replace(/\s+/g, ' ');
  if (n.length < 2) return { ok: false, motivo: 'El nombre debe tener al menos 2 caracteres.', nombre: n };
  if (n.length > 40) return { ok: false, motivo: 'El nombre no puede superar 40 caracteres.', nombre: n };
  const existe = jugadores.find((j) => j.id !== excluirId && j.nombre.localeCompare(n, 'es', { sensitivity: 'base' }) === 0);
  if (existe) return { ok: false, motivo: `Ya existe un jugador llamado ${existe.nombre}.`, nombre: n };
  return { ok: true, motivo: '', nombre: n };
}

/**
 * Normaliza y valida los datos de un formulario de partido.
 * datos: { jugador1, jugador2, fecha, estado, sets, ganador, nota, fase, llaveId, formatoPartido }
 * Devuelve { ok, errores, partido } donde partido está listo para guardarse (sin id ni auditoría).
 */
export function prepararPartido(datos, config) {
  const errores = [];
  const estado = ['completo', 'retiro', 'wo'].includes(datos.estado) ? datos.estado : 'completo';
  const sets = estado === 'wo' ? [] : (Array.isArray(datos.sets) ? datos.sets : [])
    .map((s) => [Number(s[0]), Number(s[1])])
    .filter((s) => !(Number.isNaN(s[0]) && Number.isNaN(s[1])));
  const partido = {
    fase: datos.fase === 'playoffs' ? 'playoffs' : 'liga',
    llaveId: datos.fase === 'playoffs' ? datos.llaveId || null : null,
    jugador1: datos.jugador1 || null,
    jugador2: datos.jugador2 || null,
    fecha: datos.fecha || hoyLocal(),
    formatoPartido: FORMATOS_PARTIDO[datos.formatoPartido] ? datos.formatoPartido : config.formatoPartido,
    sets,
    ganador: datos.ganador || null,
    estado,
    nota: String(datos.nota || '').trim().slice(0, 200),
  };
  if (!esFechaValida(partido.fecha)) errores.push('La fecha no es válida.');
  const v = validateMatch(partido);
  errores.push(...v.errores);
  if (v.ok) partido.ganador = v.ganadorCalc;
  if (partido.fase === 'playoffs' && !partido.llaveId) errores.push('Falta el cruce de playoffs.');
  return { ok: errores.length === 0, errores, partido, validacion: v };
}

/** Validación integral de toda la liga (para detectar datos inconsistentes). */
export function validateLiga(liga) {
  const errores = [];
  const config = normalizarConfig(liga.config);
  const jugadores = liga.jugadores || [];
  const partidos = liga.partidos || [];
  const ids = new Set();
  for (const j of jugadores) {
    if (!j.id) errores.push('Jugador sin id.');
    else if (ids.has(j.id)) errores.push(`Id de jugador repetido: ${j.id}.`);
    ids.add(j.id);
    if (!j.nombre || !String(j.nombre).trim()) errores.push(`Jugador ${j.id} sin nombre.`);
  }
  const pids = new Set();
  for (const m of partidos) {
    const etiqueta = m.id || '(sin id)';
    if (!m.id) errores.push('Partido sin id.');
    else if (pids.has(m.id)) errores.push(`Id de partido repetido: ${m.id}.`);
    pids.add(m.id);
    if (!ids.has(m.jugador1)) errores.push(`Partido ${etiqueta}: jugador1 desconocido.`);
    if (!ids.has(m.jugador2)) errores.push(`Partido ${etiqueta}: jugador2 desconocido.`);
    if (!esFechaValida(m.fecha)) errores.push(`Partido ${etiqueta}: fecha inválida.`);
    const v = validateMatch(m, config.formatoPartido);
    for (const e of v.errores) errores.push(`Partido ${etiqueta}: ${e}`);
    if (v.ok && m.ganador !== v.ganadorCalc) errores.push(`Partido ${etiqueta}: el ganador guardado no coincide.`);
    if (m.fase === 'playoffs' && !m.llaveId) errores.push(`Partido ${etiqueta}: playoffs sin cruce.`);
  }
  const limite = reunionesRequeridas(config.formatoLiga);
  if (Number.isFinite(limite)) {
    const vistos = new Set();
    for (const m of partidos) {
      if ((m.fase || 'liga') !== 'liga') continue;
      const k = [m.jugador1, m.jugador2].sort().join('|');
      if (vistos.has(k)) continue;
      vistos.add(k);
      const n = partidosEntre(liga, m.jugador1, m.jugador2, 'liga').length;
      if (n > limite) {
        const n1 = (jugadores.find((j) => j.id === m.jugador1) || {}).nombre || m.jugador1;
        const n2 = (jugadores.find((j) => j.id === m.jugador2) || {}).nombre || m.jugador2;
        errores.push(`${n1} y ${n2} tienen ${n} partidos; el formato permite ${limite}.`);
      }
    }
  }
  if (liga.playoffs) {
    const siembra = liga.playoffs.siembra || [];
    for (const s of siembra) if (!ids.has(s)) errores.push(`Playoffs: jugador sembrado desconocido ${s}.`);
  }
  return errores;
}
