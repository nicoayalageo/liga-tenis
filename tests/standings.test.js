import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStandings } from '../js/core/standings.js';
import { computePlayerStats } from '../js/core/stats.js';

function liga(partidos, configExtra = {}, jugadores) {
  return {
    config: { puntosVictoria: 1, puntosDerrota: 0, desempate: ['h2h', 'pctSets', 'pctGames'], h2hModo: 'minitabla', ...configExtra },
    jugadores: jugadores || [
      { id: 'a', nombre: 'Ana', activo: true },
      { id: 'b', nombre: 'Beto', activo: true },
      { id: 'c', nombre: 'Carla', activo: true },
      { id: 'd', nombre: 'Dino', activo: true },
    ],
    partidos,
    playoffs: null,
  };
}
let n = 0;
function m(j1, j2, sets, extra = {}) {
  n += 1;
  const ganador = extra.ganador || (sets.filter((s) => s[0] > s[1]).length > sets.filter((s) => s[0] < s[1]).length ? j1 : j2);
  return { id: `p${n}`, fase: 'liga', jugador1: j1, jugador2: j2, sets, estado: 'completo', formatoPartido: 'bo3', fecha: `2026-01-${String(n).padStart(2, '0')}`, ingresadoEn: `2026-01-${String(n).padStart(2, '0')}T10:00:00Z`, ganador, ...extra };
}

test('orden por puntos', () => {
  const L = liga([m('a', 'b', [[6, 0], [6, 0]]), m('a', 'c', [[6, 0], [6, 0]]), m('b', 'c', [[6, 0], [6, 0]])]);
  const t = computeStandings(L);
  assert.deepEqual(t.map((r) => r.jugador), ['a', 'b', 'c', 'd']);
  // c y d tienen 0 puntos y 0 % en todo: comparten el tercer puesto.
  assert.deepEqual(t.map((r) => r.pos), [1, 2, 3, 3]);
  assert.equal(t[0].puntos, 2);
  assert.equal(t[2].empatado, true);
});

test('empate a dos: enfrentamiento directo', () => {
  // a y b ganan 1 cada uno; b le ganó a a.
  const L = liga([m('b', 'a', [[6, 4], [6, 4]]), m('a', 'c', [[6, 0], [6, 0]])]);
  const t = computeStandings(L);
  assert.deepEqual(t.slice(0, 2).map((r) => r.jugador), ['b', 'a']);
  assert.equal(t[0].desempatadoPor, 'h2h');
  assert.equal(t[0].empatado, false);
});

test('empate a tres con h2h solo2 salta al siguiente criterio', () => {
  // a>b, b>c, c>a (circular) y además cada uno pierde contra d? no: 3 jugadores empatados a 1 punto.
  const L = liga([
    m('a', 'b', [[6, 0], [6, 0]]),
    m('b', 'c', [[6, 4], [6, 4]]),
    m('c', 'a', [[7, 6], [7, 6]]),
  ], { h2hModo: 'solo2' });
  const t = computeStandings(L);
  // Todos 1-1. pctSets: todos 2-2 = 0.5. pctGames: a 12+12=24 ganados, 0+... calculemos: a: vs b 12-0, vs c 12-14 → 24-14; b: 0-12, 12-8 → 12-20; c: 8-12, 14-12 → 22-24.
  assert.deepEqual(t.slice(0, 3).map((r) => r.jugador), ['a', 'c', 'b']);
  assert.equal(t[0].desempatadoPor, 'pctGames');
});

test('empate a tres con minitabla, luego reinicio entre los que siguen empatados', () => {
  // d gana todo. a, b, c empatan a 1 victoria entre ellos (circular) → minitabla no separa → pctSets → pctGames.
  const L = liga([
    m('d', 'a', [[6, 0], [6, 0]]), m('d', 'b', [[6, 0], [6, 0]]), m('d', 'c', [[6, 0], [6, 0]]),
    m('a', 'b', [[6, 0], [6, 0]]),
    m('b', 'c', [[6, 4], [6, 4]]),
    m('c', 'a', [[7, 6], [7, 6]]),
  ]);
  const t = computeStandings(L);
  assert.equal(t[0].jugador, 'd');
  assert.deepEqual(t.slice(1).map((r) => r.jugador), ['a', 'c', 'b']);
});

test('criterios agotados: posición compartida y orden alfabético', () => {
  const L = liga([m('a', 'b', [[6, 4], [4, 6], [6, 4]]), m('b', 'a', [[6, 4], [4, 6], [6, 4]])], { desempate: [] });
  const t = computeStandings(L);
  assert.equal(t[0].pos, 1);
  assert.equal(t[1].pos, 1);
  assert.equal(t[0].empatado, true);
  assert.deepEqual(t.slice(0, 2).map((r) => r.jugador), ['a', 'b']);
  assert.equal(t[2].pos, 3);
});

test('preset universitario: difSets separa', () => {
  const L = liga([
    m('a', 'c', [[6, 0], [6, 0]]), m('b', 'c', [[6, 0], [4, 6], [6, 0]]),
  ], { desempate: ['h2h', 'difSets', 'setsFavor', 'difGames', 'gamesFavor'], h2hModo: 'solo2' });
  const t = computeStandings(L);
  assert.deepEqual(t.slice(0, 2).map((r) => r.jugador), ['a', 'b']);
  assert.equal(t[0].desempatadoPor, 'difSets');
});

test('W.O. excluido de sets y games, pero cuenta como victoria', () => {
  const L = liga([m('a', 'b', [], { estado: 'wo', ganador: 'a' })]);
  const s = computePlayerStats(L);
  assert.equal(s.get('a').pg, 1);
  assert.equal(s.get('a').setsG, 0);
  assert.equal(s.get('b').wo, 1);
  const L2 = liga([m('a', 'b', [], { estado: 'wo', ganador: 'a' })], { excluirWOdeSetsGames: false });
  const s2 = computePlayerStats(L2);
  assert.equal(s2.get('a').setsG, 0); // W.O. no tiene sets
});

test('puntos por derrota y por W.O.', () => {
  const L = liga([
    m('a', 'b', [[6, 0], [6, 0]]),
    m('a', 'c', [], { estado: 'wo', ganador: 'a' }),
  ], { puntosVictoria: 2, puntosDerrota: 1, puntosDerrotaWO: 0 });
  const s = computePlayerStats(L);
  assert.equal(s.get('a').puntos, 4);
  assert.equal(s.get('b').puntos, 1);
  assert.equal(s.get('c').puntos, 0);
});

test('menosPJ y masPJ', () => {
  const L = liga([
    m('a', 'c', [[6, 0], [6, 0]]),
    m('b', 'c', [[6, 0], [6, 0]]), m('b', 'd', [[0, 6], [0, 6]]),
  ], { desempate: ['menosPJ'] });
  const t = computeStandings(L);
  // a, b y d tienen 1 punto; a y d jugaron 1 partido, b jugó 2.
  assert.deepEqual(t.map((r) => r.jugador), ['a', 'd', 'b', 'c']);
  assert.deepEqual(t.map((r) => r.pos), [1, 1, 3, 4]);
  const L2 = liga(L.partidos, { desempate: ['masPJ'] });
  const t2 = computeStandings(L2);
  // d y b tienen 1 punto... d: 1 partido 1 victoria; a: 1 victoria 1 partido; b: 1 victoria 2 partidos → b primero con masPJ
  assert.equal(t2[0].jugador, 'b');
});

test('forma: últimos cinco en orden cronológico', () => {
  const partidos = [];
  for (let i = 0; i < 7; i++) partidos.push(m('a', 'b', i % 2 === 0 ? [[6, 0], [6, 0]] : [[0, 6], [0, 6]]));
  const L = liga(partidos, { formatoLiga: 'libre' });
  const s = computePlayerStats(L);
  assert.deepEqual(s.get('a').forma, ['G', 'P', 'G', 'P', 'G']);
});

test('jugador inactivo con partidos sigue en la tabla; sin partidos se omite', () => {
  const L = liga([m('a', 'b', [[6, 0], [6, 0]])], {}, [
    { id: 'a', nombre: 'Ana', activo: true },
    { id: 'b', nombre: 'Beto', activo: false },
    { id: 'c', nombre: 'Carla', activo: false },
  ]);
  const t = computeStandings(L);
  assert.deepEqual(t.map((r) => r.jugador), ['a', 'b']);
  assert.equal(t[1].activo, false);
});

test('fase playoffs no cuenta para la tabla de liga', () => {
  const L = liga([m('a', 'b', [[6, 0], [6, 0]], { fase: 'playoffs' })]);
  const t = computeStandings(L);
  assert.equal(t[0].pj, 0);
});
