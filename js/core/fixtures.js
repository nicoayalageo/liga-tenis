// Calendario round robin (método del círculo), cruces pendientes y llave de playoffs.
// Módulo puro: sin DOM ni Firebase.

import { FORMATOS_LIGA } from './formats.js';
import { partidosEntre } from './stats.js';

/**
 * Genera jornadas por el método del círculo.
 * ids: lista de ids de jugadores. vueltas: 1 o 2.
 * Devuelve { jugadores: ids, jornadas: [ [ [a,b], ... ], ... ] }. Con N impar se usa null como "libre".
 */
export function generarRoundRobin(ids, vueltas = 1) {
  const arr = [...ids];
  if (arr.length < 2) return { jugadores: [...ids], jornadas: [] };
  if (arr.length % 2 === 1) arr.push(null);
  const n = arr.length;
  const rondas = [];
  const rot = arr.slice();
  for (let r = 0; r < n - 1; r++) {
    const ronda = [];
    for (let i = 0; i < n / 2; i++) {
      const x = rot[i];
      const y = rot[n - 1 - i];
      // Alternar lados para que el jugador fijo no salga siempre primero.
      const par = (r + i) % 2 === 0 ? [x, y] : [y, x];
      ronda.push(par);
    }
    rondas.push(ronda);
    // Rotar todos menos el primero.
    const fijo = rot[0];
    const resto = rot.slice(1);
    resto.unshift(resto.pop());
    rot.splice(0, n, fijo, ...resto);
  }
  const jornadas = rondas.map((ronda) => ronda.filter((p) => p[0] !== null && p[1] !== null));
  const libres = rondas.map((ronda) => {
    const l = ronda.find((p) => p[0] === null || p[1] === null);
    return l ? (l[0] === null ? l[1] : l[0]) : null;
  });
  if (vueltas >= 2) {
    const segunda = jornadas.map((j) => j.map(([a, b]) => [b, a]));
    jornadas.push(...segunda);
    libres.push(...libres.slice());
  }
  return { jugadores: [...ids], jornadas, libres };
}

export function reunionesRequeridas(formatoLiga) {
  const f = FORMATOS_LIGA[formatoLiga];
  return f ? f.vueltas : Infinity;
}

export function esFormatoConCalendario(formatoLiga) {
  return Number.isFinite(reunionesRequeridas(formatoLiga));
}

/**
 * ¿Se puede agregar un partido de liga entre a y b?
 * opciones.excluirId: id de partido que se está editando (no cuenta).
 */
export function canAddMatch(liga, a, b, opciones = {}) {
  const config = liga.config || {};
  if (!a || !b) return { ok: false, motivo: 'Faltan los jugadores.' };
  if (a === b) return { ok: false, motivo: 'Un jugador no puede enfrentarse a sí mismo.' };
  const ja = (liga.jugadores || []).find((j) => j.id === a);
  const jb = (liga.jugadores || []).find((j) => j.id === b);
  if (!ja || !jb) return { ok: false, motivo: 'Jugador desconocido.' };
  if (!opciones.permitirInactivos) {
    if (ja.activo === false) return { ok: false, motivo: `${ja.nombre} está inactivo.` };
    if (jb.activo === false) return { ok: false, motivo: `${jb.nombre} está inactivo.` };
  }
  const limite = reunionesRequeridas(config.formatoLiga);
  if (Number.isFinite(limite)) {
    const previos = partidosEntre(liga, a, b, 'liga').filter((m) => m.id !== opciones.excluirId);
    if (previos.length >= limite) {
      return {
        ok: false,
        motivo: limite === 1
          ? `${ja.nombre} y ${jb.nombre} ya jugaron su partido.`
          : `${ja.nombre} y ${jb.nombre} ya jugaron sus ${limite} partidos.`,
      };
    }
  }
  return { ok: true, motivo: '' };
}

/**
 * Cruces pendientes del calendario: por cada par, el k-ésimo cruce del calendario se considera
 * cubierto por el k-ésimo partido jugado entre ellos.
 * Devuelve [{ jornada (1-based), jugador1, jugador2 }].
 */
export function pendientes(liga) {
  const cal = liga.config && liga.config.calendario;
  if (!cal || !Array.isArray(cal.jornadas)) return [];
  const activos = new Set((liga.jugadores || []).filter((j) => j.activo !== false).map((j) => j.id));
  const vistos = new Map();
  const salida = [];
  cal.jornadas.forEach((jornada, idx) => {
    for (const [a, b] of jornada) {
      const clave = [a, b].sort().join('|');
      const k = vistos.get(clave) || 0;
      vistos.set(clave, k + 1);
      const jugados = partidosEntre(liga, a, b, 'liga');
      if (jugados.length > k) continue;
      if (!activos.has(a) || !activos.has(b)) continue;
      salida.push({ jornada: idx + 1, jugador1: a, jugador2: b });
    }
  });
  return salida;
}

/**
 * Estado del calendario con cada cruce resuelto o pendiente.
 * Devuelve [{ numero, libre, cruces:[{ jugador1, jugador2, partido|null }] }].
 */
export function calendarioConResultados(liga) {
  const cal = liga.config && liga.config.calendario;
  if (!cal || !Array.isArray(cal.jornadas)) return [];
  const vistos = new Map();
  return cal.jornadas.map((jornada, idx) => ({
    numero: idx + 1,
    libre: Array.isArray(cal.libres) ? cal.libres[idx] || null : null,
    cruces: jornada.map(([a, b]) => {
      const clave = [a, b].sort().join('|');
      const k = vistos.get(clave) || 0;
      vistos.set(clave, k + 1);
      const jugados = partidosEntre(liga, a, b, 'liga');
      return { jugador1: a, jugador2: b, partido: jugados[k] || null };
    }),
  }));
}

/** Tamaño de llave: siguiente potencia de 2. */
export function tamanoLlave(n) {
  let t = 1;
  while (t < n) t *= 2;
  return Math.max(t, 2);
}

/** Orden de siembra para una llave de tamaño k: [1,8,4,5,2,7,3,6] para 8. */
export function ordenSiembra(k) {
  let orden = [1];
  while (orden.length < k) {
    const total = orden.length * 2;
    const nuevo = [];
    for (const s of orden) nuevo.push(s, total + 1 - s);
    orden = nuevo;
  }
  return orden;
}

/**
 * Genera la llave a partir de la tabla (filas ordenadas).
 * Devuelve { generadoEn, tamano, clasificados, siembra:[ids], llaves:[{id, ronda:1, pos, jugador1, jugador2}] , tercerPuesto }
 */
export function generarPlayoffs(filasTabla, opciones = {}) {
  const clasificados = Math.max(2, Number(opciones.clasificados) || 4);
  const siembra = filasTabla.slice(0, clasificados).map((f) => f.jugador);
  if (siembra.length < 2) throw new Error('Se necesitan al menos 2 jugadores para la llave.');
  const tamano = tamanoLlave(siembra.length);
  const orden = ordenSiembra(tamano);
  const llaves = [];
  for (let i = 0; i < tamano; i += 2) {
    const s1 = orden[i];
    const s2 = orden[i + 1];
    llaves.push({
      id: `ll_r1_${i / 2}`,
      ronda: 1,
      pos: i / 2,
      jugador1: siembra[s1 - 1] || null,
      jugador2: siembra[s2 - 1] || null,
    });
  }
  return {
    generadoEn: opciones.ahora || new Date().toISOString(),
    tamano,
    clasificados: siembra.length,
    siembra,
    llaves,
    tercerPuesto: Boolean(opciones.tercerPuesto),
  };
}

function nombreRonda(ronda, totalRondas) {
  const faltan = totalRondas - ronda;
  if (faltan === 0) return 'Final';
  if (faltan === 1) return 'Semifinales';
  if (faltan === 2) return 'Cuartos de final';
  return `Ronda ${ronda}`;
}

/**
 * Resuelve la llave completa a partir de los partidos de fase playoffs.
 * Devuelve { rondas:[{ numero, nombre, cruces:[{ id, jugador1, jugador2, partido, ganador, bye }] }], campeon, tercerPuesto }
 */
export function resolverLlave(liga) {
  const po = liga.playoffs;
  if (!po || !Array.isArray(po.llaves)) return null;
  const partidos = (liga.partidos || []).filter((m) => (m.fase || 'liga') === 'playoffs');
  const porLlave = new Map(partidos.filter((m) => m.llaveId).map((m) => [m.llaveId, m]));
  const totalRondas = Math.log2(po.tamano);
  const rondas = [];
  let actual = po.llaves.map((l) => ({ ...l }));
  for (let r = 1; r <= totalRondas; r++) {
    const cruces = actual.map((c) => {
      // Solo en la primera ronda un rival vacío es bye; después significa cruce pendiente.
      const bye = r === 1 && ((c.jugador1 && !c.jugador2) || (!c.jugador1 && c.jugador2));
      const partido = porLlave.get(c.id) || null;
      let ganador = null;
      if (bye) ganador = c.jugador1 || c.jugador2;
      else if (partido) ganador = partido.ganador;
      return { ...c, partido, ganador, bye: Boolean(bye) };
    });
    rondas.push({ numero: r, nombre: nombreRonda(r, totalRondas), cruces });
    if (r === totalRondas) break;
    const siguiente = [];
    for (let i = 0; i < cruces.length; i += 2) {
      siguiente.push({
        id: `ll_r${r + 1}_${i / 2}`,
        ronda: r + 1,
        pos: i / 2,
        jugador1: cruces[i].ganador || null,
        jugador2: cruces[i + 1] ? cruces[i + 1].ganador || null : null,
        origen: [cruces[i].id, cruces[i + 1] ? cruces[i + 1].id : null],
      });
    }
    actual = siguiente;
  }
  const final = rondas[rondas.length - 1].cruces[0];
  let tercerPuesto = null;
  if (po.tercerPuesto && totalRondas >= 2) {
    const semis = rondas[rondas.length - 2].cruces;
    const perdedor = (c) => (c.ganador && c.partido ? (c.partido.jugador1 === c.ganador ? c.partido.jugador2 : c.partido.jugador1) : null);
    const id = 'll_3p';
    const partido = porLlave.get(id) || null;
    tercerPuesto = {
      id, ronda: totalRondas, pos: 99,
      jugador1: perdedor(semis[0]), jugador2: perdedor(semis[1]),
      partido, ganador: partido ? partido.ganador : null, bye: false,
    };
  }
  return { rondas, campeon: final.ganador || null, tercerPuesto };
}

/** ¿Hay un partido posterior en la llave que dependa de este? */
export function tieneDependientes(liga, llaveId) {
  const res = resolverLlave(liga);
  if (!res) return false;
  for (const ronda of res.rondas) {
    for (const c of ronda.cruces) {
      if (c.origen && c.origen.includes(llaveId) && c.partido) return true;
    }
  }
  if (res.tercerPuesto && res.tercerPuesto.partido && llaveId.startsWith('ll_r')) {
    const semiRonda = res.rondas.length - 2;
    if (semiRonda >= 0 && res.rondas[semiRonda].cruces.some((c) => c.id === llaveId)) return true;
  }
  return false;
}

/** Cruces de playoffs listos para jugarse (ambos jugadores definidos y sin partido). */
export function crucesPlayoffsAbiertos(liga) {
  const res = resolverLlave(liga);
  if (!res) return [];
  const abiertos = [];
  for (const ronda of res.rondas) {
    for (const c of ronda.cruces) {
      if (c.jugador1 && c.jugador2 && !c.partido) abiertos.push({ ...c, nombreRonda: ronda.nombre });
    }
  }
  if (res.tercerPuesto && res.tercerPuesto.jugador1 && res.tercerPuesto.jugador2 && !res.tercerPuesto.partido) {
    abiertos.push({ ...res.tercerPuesto, nombreRonda: 'Tercer puesto' });
  }
  return abiertos;
}
