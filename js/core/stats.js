// Estadísticas por jugador a partir de los partidos aprobados.
// Módulo puro: sin DOM ni Firebase.

import { resultadoParaJugador } from './scoring.js';

export function ordenarPartidos(partidos) {
  return [...partidos].sort((a, b) => {
    const fa = a.fecha || '';
    const fb = b.fecha || '';
    if (fa !== fb) return fa < fb ? -1 : 1;
    const ia = a.ingresadoEn || '';
    const ib = b.ingresadoEn || '';
    if (ia !== ib) return ia < ib ? -1 : 1;
    return (a.id || '') < (b.id || '') ? -1 : 1;
  });
}

export function statsVacias(jugadorId) {
  return {
    jugador: jugadorId,
    pj: 0, pg: 0, pp: 0, wo: 0, woRecibidos: 0,
    puntos: 0,
    setsG: 0, setsP: 0, gamesG: 0, gamesP: 0,
    pctSets: 0, pctGames: 0, difSets: 0, difGames: 0,
    forma: [],
  };
}

function pct(g, p) {
  const t = g + p;
  return t === 0 ? 0 : g / t;
}

/**
 * Calcula estadísticas por jugador.
 * opciones: { fase: 'liga'|'playoffs', partidos: lista alternativa (para mini tablas), jugadores: ids a incluir }
 */
export function computePlayerStats(liga, opciones = {}) {
  const config = liga.config || {};
  const fase = opciones.fase || 'liga';
  const fuente = opciones.partidos || liga.partidos || [];
  const partidos = ordenarPartidos(fuente.filter((m) => (m.fase || 'liga') === fase));
  const ids = opciones.jugadores || (liga.jugadores || []).map((j) => j.id);
  const incluir = new Set(ids);
  const mapa = new Map();
  for (const id of ids) mapa.set(id, statsVacias(id));

  const puntosVictoria = Number.isFinite(config.puntosVictoria) ? config.puntosVictoria : 1;
  const puntosDerrota = Number.isFinite(config.puntosDerrota) ? config.puntosDerrota : 0;
  const puntosDerrotaWO = Number.isFinite(config.puntosDerrotaWO) ? config.puntosDerrotaWO : puntosDerrota;
  const excluirWO = config.excluirWOdeSetsGames !== false;

  for (const m of partidos) {
    for (const jid of [m.jugador1, m.jugador2]) {
      if (!incluir.has(jid)) continue;
      if (opciones.jugadores && !incluir.has(m.jugador1 === jid ? m.jugador2 : m.jugador1)) continue;
      const r = resultadoParaJugador(m, jid, config);
      if (!r) continue;
      const s = mapa.get(jid);
      s.pj += 1;
      if (r.gano) {
        s.pg += 1;
        s.puntos += puntosVictoria;
        if (r.esWO) s.woRecibidos += 1;
      } else {
        s.pp += 1;
        if (r.esWO) {
          s.wo += 1;
          s.puntos += puntosDerrotaWO;
        } else {
          s.puntos += puntosDerrota;
        }
      }
      if (!(r.esWO && excluirWO)) {
        s.setsG += r.setsF;
        s.setsP += r.setsC;
        s.gamesG += r.gamesF;
        s.gamesP += r.gamesC;
      }
      s.forma.push(r.gano ? 'G' : 'P');
    }
  }

  for (const s of mapa.values()) {
    s.pctSets = pct(s.setsG, s.setsP);
    s.pctGames = pct(s.gamesG, s.gamesP);
    s.difSets = s.setsG - s.setsP;
    s.difGames = s.gamesG - s.gamesP;
    s.forma = s.forma.slice(-5);
  }
  return mapa;
}

/** Partidos entre dos jugadores en una fase, ordenados. */
export function partidosEntre(liga, a, b, fase = 'liga') {
  return ordenarPartidos((liga.partidos || []).filter((m) =>
    (m.fase || 'liga') === fase &&
    ((m.jugador1 === a && m.jugador2 === b) || (m.jugador1 === b && m.jugador2 === a))));
}
