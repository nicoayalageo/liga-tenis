// Tabla de posiciones con criterios de desempate configurables.
// Módulo puro: sin DOM ni Firebase.

import { computePlayerStats } from './stats.js';

const COLADOR = new Intl.Collator('es', { sensitivity: 'base' });

function nombreDe(liga, id) {
  const j = (liga.jugadores || []).find((x) => x.id === id);
  return j ? j.nombre : id;
}

/** Valor del criterio para un jugador. Mayor es mejor. */
function clave(criterio, s, ctx) {
  switch (criterio) {
    case 'victorias': return s.pg;
    case 'masPJ': return s.pj;
    case 'menosPJ': return -s.pj;
    case 'pctSets': return s.pctSets;
    case 'pctGames': return s.pctGames;
    case 'difSets': return s.difSets;
    case 'setsFavor': return s.setsG;
    case 'difGames': return s.difGames;
    case 'gamesFavor': return s.gamesG;
    case 'alfabetico': return null;
    case 'h2h': return null;
    default: return null;
  }
}

function agruparPorClave(grupo, claves) {
  const ordenado = [...grupo].sort((a, b) => claves.get(b) - claves.get(a));
  const subgrupos = [];
  for (const id of ordenado) {
    const ultimo = subgrupos[subgrupos.length - 1];
    if (ultimo && claves.get(ultimo[0]) === claves.get(id)) ultimo.push(id);
    else subgrupos.push([id]);
  }
  return subgrupos;
}

/**
 * Resuelve un grupo de jugadores empatados en puntos.
 * Devuelve lista de { ids:[...], criterio } en orden; cada entrada es un subgrupo que no pudo separarse más.
 */
function resolverEmpate(grupo, criterios, ctx, criterioPrevio = null) {
  if (grupo.length <= 1) return [{ ids: grupo, criterio: criterioPrevio, empatado: false }];
  if (criterios.length === 0) {
    const ordenado = [...grupo].sort((a, b) => COLADOR.compare(nombreDe(ctx.liga, a), nombreDe(ctx.liga, b)));
    return [{ ids: ordenado, criterio: criterioPrevio, empatado: true }];
  }
  const [c, ...resto] = criterios;

  if (c === 'alfabetico') {
    const ordenado = [...grupo].sort((a, b) => COLADOR.compare(nombreDe(ctx.liga, a), nombreDe(ctx.liga, b)));
    return ordenado.map((id) => ({ ids: [id], criterio: 'alfabetico', empatado: false }));
  }

  let claves;
  if (c === 'h2h') {
    if (grupo.length > 2 && ctx.h2hModo !== 'minitabla') {
      return resolverEmpate(grupo, resto, ctx, criterioPrevio);
    }
    const mini = computePlayerStats(ctx.liga, { fase: ctx.fase, jugadores: grupo });
    claves = new Map(grupo.map((id) => [id, mini.get(id).puntos]));
  } else {
    claves = new Map(grupo.map((id) => [id, clave(c, ctx.stats.get(id), ctx)]));
  }

  const subgrupos = agruparPorClave(grupo, claves);
  if (subgrupos.length === 1) {
    // El criterio no separó a nadie: seguir con el siguiente.
    return resolverEmpate(grupo, resto, ctx, criterioPrevio);
  }
  const salida = [];
  for (const sub of subgrupos) {
    if (sub.length === 1) {
      salida.push({ ids: sub, criterio: c, empatado: false });
    } else {
      // Subgrupo que sigue empatado: se reinicia desde el primer criterio (USTA / ATP).
      salida.push(...resolverEmpate(sub, ctx.criteriosCompletos, ctx, c));
    }
  }
  return salida;
}

/**
 * Tabla de posiciones.
 * Devuelve filas: { pos, jugador, nombre, activo, empatado, desempatadoPor, ...stats }
 */
export function computeStandings(liga, opciones = {}) {
  const fase = opciones.fase || 'liga';
  const config = liga.config || {};
  const jugadores = liga.jugadores || [];
  const partidos = (liga.partidos || []).filter((m) => (m.fase || 'liga') === fase);
  const conPartidos = new Set();
  for (const m of partidos) {
    conPartidos.add(m.jugador1);
    conPartidos.add(m.jugador2);
  }
  const incluidos = jugadores.filter((j) => j.activo !== false || conPartidos.has(j.id));
  const stats = computePlayerStats(liga, { fase, jugadores: incluidos.map((j) => j.id) });
  const criterios = Array.isArray(config.desempate) ? config.desempate : [];
  const ctx = {
    liga, fase, stats,
    criteriosCompletos: criterios,
    h2hModo: config.h2hModo || 'minitabla',
  };

  const porPuntos = new Map();
  for (const j of incluidos) {
    const p = stats.get(j.id).puntos;
    if (!porPuntos.has(p)) porPuntos.set(p, []);
    porPuntos.get(p).push(j.id);
  }
  const niveles = [...porPuntos.keys()].sort((a, b) => b - a);

  const filas = [];
  let pos = 1;
  for (const nivel of niveles) {
    const grupo = porPuntos.get(nivel);
    const resuelto = resolverEmpate(grupo, criterios, ctx);
    for (const bloque of resuelto) {
      const posBloque = pos;
      for (const id of bloque.ids) {
        const j = jugadores.find((x) => x.id === id);
        filas.push({
          pos: posBloque,
          jugador: id,
          nombre: j ? j.nombre : id,
          activo: j ? j.activo !== false : true,
          empatado: bloque.empatado && bloque.ids.length > 1,
          desempatadoPor: bloque.criterio,
          ...stats.get(id),
        });
      }
      pos += bloque.ids.length;
    }
  }
  return filas;
}
