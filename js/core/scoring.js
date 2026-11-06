// Validación de marcadores de tenis según el formato del partido.
// Módulo puro: sin DOM ni Firebase.

import { FORMATOS_PARTIDO } from './formats.js';

function esEntero(n) {
  return Number.isInteger(n) && n >= 0 && n <= 99;
}

function setValido(set) {
  return Array.isArray(set) && set.length === 2 && esEntero(set[0]) && esEntero(set[1]);
}

/** Set estándar: 6-0…6-4, 7-5 o 7-6. Devuelve 0 o 1 (índice del ganador) o null si no es válido. */
export function validarSetEstandar(set) {
  if (!setValido(set)) return null;
  const [a, b] = set;
  const w = Math.max(a, b);
  const l = Math.min(a, b);
  const ok = (w === 6 && l <= 4) || (w === 7 && (l === 5 || l === 6));
  if (!ok || a === b) return null;
  return a > b ? 0 : 1;
}

/** Super tiebreak (match tiebreak) a 10: gana quien llega a 10 con diferencia de 2, o sigue hasta sacar 2 de diferencia. */
export function validarSuperTiebreak(set) {
  if (!setValido(set)) return null;
  const [a, b] = set;
  const w = Math.max(a, b);
  const l = Math.min(a, b);
  const ok = w >= 10 && w - l >= 2 && (w === 10 || w - l === 2);
  if (!ok) return null;
  return a > b ? 0 : 1;
}

/** Set libre: estándar, super tiebreak o set largo sin tiebreak (8-6, 9-7…). */
export function validarSetLibre(set) {
  const e = validarSetEstandar(set);
  if (e !== null) return e;
  const t = validarSuperTiebreak(set);
  if (t !== null) return t;
  if (!setValido(set)) return null;
  const [a, b] = set;
  const w = Math.max(a, b);
  const l = Math.min(a, b);
  if (w >= 6 && w - l === 2) return a > b ? 0 : 1;
  return null;
}

/** Un set cuenta como super tiebreak si alguno de los dos pasó de 7 puntos. */
export function esSuperTiebreak(set) {
  return setValido(set) && Math.max(set[0], set[1]) >= 10;
}

function ganadorParcial(set) {
  if (!setValido(set)) return null;
  if (set[0] === set[1]) return null;
  return set[0] > set[1] ? 0 : 1;
}

/**
 * Valida un partido completo.
 * partido: { jugador1, jugador2, sets:[[a,b],...], ganador, estado:'completo'|'retiro'|'wo', formatoPartido }
 * Devuelve { ok, errores:[], ganadorCalc, setsGanados:[a,b], gamesGanados:[a,b], superTiebreaks:[a,b] }
 */
export function validateMatch(partido, formatoId) {
  const errores = [];
  const idFormato = partido.formatoPartido || formatoId;
  const fmt = FORMATOS_PARTIDO[idFormato];
  const res = {
    ok: false,
    errores,
    ganadorCalc: null,
    setsGanados: [0, 0],
    gamesGanados: [0, 0],
    superTiebreaks: [0, 0],
    formato: idFormato,
  };

  if (!fmt) {
    errores.push('Formato de partido desconocido.');
    return res;
  }
  if (!partido.jugador1 || !partido.jugador2) {
    errores.push('Faltan los jugadores.');
  } else if (partido.jugador1 === partido.jugador2) {
    errores.push('Un jugador no puede enfrentarse a sí mismo.');
  }
  const estado = partido.estado || 'completo';
  if (!['completo', 'retiro', 'wo'].includes(estado)) {
    errores.push('Estado de partido desconocido.');
    return res;
  }
  const sets = Array.isArray(partido.sets) ? partido.sets : [];
  const jugadores = [partido.jugador1, partido.jugador2];
  const idxGanador = partido.ganador ? jugadores.indexOf(partido.ganador) : -1;

  if (estado === 'wo') {
    if (sets.length > 0) errores.push('Un W.O. no lleva marcador.');
    if (idxGanador < 0) errores.push('Indica quién gana el W.O.');
    res.ganadorCalc = idxGanador >= 0 ? partido.ganador : null;
    res.ok = errores.length === 0;
    return res;
  }

  if (sets.length === 0) {
    errores.push('Ingresa al menos un set.');
    return res;
  }
  if (sets.length > fmt.maxSets) {
    errores.push(`Este formato admite como máximo ${fmt.maxSets} sets.`);
  }

  const setsGanados = [0, 0];
  const games = [0, 0];
  const stb = [0, 0];
  let decidido = false;

  for (let i = 0; i < sets.length; i++) {
    const set = sets[i];
    const esUltimo = i === sets.length - 1;
    if (!setValido(set)) {
      errores.push(`El set ${i + 1} tiene valores inválidos.`);
      continue;
    }
    if (decidido) {
      errores.push(`Hay sets después de que el partido ya estaba decidido (set ${i + 1}).`);
      break;
    }
    let ganador;
    let tipoStb = false;
    const toleraIncompleto = estado === 'retiro' && esUltimo;
    if (fmt.superTb === null) {
      ganador = validarSetLibre(set);
      tipoStb = esSuperTiebreak(set);
      if (ganador === null && !toleraIncompleto) {
        errores.push(`El set ${i + 1} no es un marcador válido.`);
      }
    } else if (fmt.superTb && i === fmt.maxSets - 1) {
      ganador = validarSuperTiebreak(set);
      tipoStb = true;
      if (ganador === null && !toleraIncompleto) {
        errores.push(`El set ${i + 1} debe ser un super tiebreak a 10 puntos (por ejemplo 10-8).`);
      }
    } else {
      ganador = validarSetEstandar(set);
      if (ganador === null && !toleraIncompleto) {
        errores.push(`El set ${i + 1} no es un set válido (6-0 a 6-4, 7-5 o 7-6).`);
      }
    }
    if (ganador !== null) {
      setsGanados[ganador] += 1;
    }
    if (tipoStb) {
      stb[0] += set[0];
      stb[1] += set[1];
    } else {
      games[0] += set[0];
      games[1] += set[1];
    }
    const meta = fmt.setsParaGanar;
    if (meta !== null && (setsGanados[0] >= meta || setsGanados[1] >= meta)) {
      decidido = true;
    }
  }

  res.setsGanados = setsGanados;
  res.gamesGanados = games;
  res.superTiebreaks = stb;

  let ganadorCalcIdx = -1;
  if (fmt.setsParaGanar !== null) {
    if (setsGanados[0] >= fmt.setsParaGanar) ganadorCalcIdx = 0;
    else if (setsGanados[1] >= fmt.setsParaGanar) ganadorCalcIdx = 1;
  } else if (setsGanados[0] !== setsGanados[1]) {
    ganadorCalcIdx = setsGanados[0] > setsGanados[1] ? 0 : 1;
  }

  if (estado === 'completo') {
    if (ganadorCalcIdx < 0) {
      errores.push('El partido está incompleto: nadie alcanzó los sets necesarios.');
    } else if (idxGanador >= 0 && idxGanador !== ganadorCalcIdx) {
      errores.push('El ganador indicado no coincide con el marcador.');
    }
    res.ganadorCalc = ganadorCalcIdx >= 0 ? jugadores[ganadorCalcIdx] : null;
  } else {
    // retiro
    if (idxGanador < 0) {
      errores.push('Indica quién gana por retiro.');
    } else if (ganadorCalcIdx >= 0 && ganadorCalcIdx !== idxGanador) {
      errores.push('El marcador ya estaba decidido a favor del otro jugador.');
    }
    res.ganadorCalc = idxGanador >= 0 ? partido.ganador : null;
  }

  res.ok = errores.length === 0;
  return res;
}

/** Marcador legible: "6-4 3-6 [10-8]", "W.O.", "6-4 2-1 ret." Desde la perspectiva de jugador1 salvo que se pase otro id. */
export function formatScore(partido, desdeJugadorId) {
  if ((partido.estado || 'completo') === 'wo') return 'W.O.';
  const invertir = desdeJugadorId && desdeJugadorId === partido.jugador2;
  const fmt = FORMATOS_PARTIDO[partido.formatoPartido] || null;
  const partes = (partido.sets || []).map((set, i) => {
    const [a, b] = invertir ? [set[1], set[0]] : set;
    const esStb = fmt && fmt.superTb === true
      ? i === fmt.maxSets - 1
      : esSuperTiebreak(set);
    return esStb ? `[${a}-${b}]` : `${a}-${b}`;
  });
  let texto = partes.join(' ');
  if (partido.estado === 'retiro') texto += ' ret.';
  return texto;
}

/** Resultado de un partido visto desde un jugador. */
export function resultadoParaJugador(partido, jugadorId, config = {}) {
  const idx = partido.jugador1 === jugadorId ? 0 : partido.jugador2 === jugadorId ? 1 : -1;
  if (idx < 0) return null;
  const rival = idx === 0 ? 1 : 0;
  const v = validateMatch(partido);
  const esWO = (partido.estado || 'completo') === 'wo';
  const gano = partido.ganador === jugadorId;
  const cuentaStb = Boolean(config.superTiebreakCuentaGames);
  const gamesF = v.gamesGanados[idx] + (cuentaStb ? v.superTiebreaks[idx] : 0);
  const gamesC = v.gamesGanados[rival] + (cuentaStb ? v.superTiebreaks[rival] : 0);
  return {
    gano,
    esWO,
    esRetiro: partido.estado === 'retiro',
    setsF: v.setsGanados[idx],
    setsC: v.setsGanados[rival],
    gamesF,
    gamesC,
    rival: idx === 0 ? partido.jugador2 : partido.jugador1,
  };
}
