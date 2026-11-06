import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generarRoundRobin, canAddMatch, pendientes, ordenSiembra, tamanoLlave, generarPlayoffs, resolverLlave,
  tieneDependientes, crucesPlayoffsAbiertos, calendarioConResultados,
} from '../js/core/fixtures.js';

function verificarRR(ids, vueltas) {
  const { jornadas } = generarRoundRobin(ids, vueltas);
  const n = ids.length;
  const esperadas = (n % 2 === 0 ? n - 1 : n) * vueltas;
  assert.equal(jornadas.length, esperadas, `jornadas para n=${n}`);
  const conteo = new Map();
  for (const j of jornadas) {
    const enJornada = new Set();
    for (const [a, b] of j) {
      assert.notEqual(a, b);
      assert.ok(!enJornada.has(a) && !enJornada.has(b), 'jugador repetido en jornada');
      enJornada.add(a); enJornada.add(b);
      const k = [a, b].sort().join('|');
      conteo.set(k, (conteo.get(k) || 0) + 1);
    }
  }
  assert.equal(conteo.size, (n * (n - 1)) / 2);
  for (const v of conteo.values()) assert.equal(v, vueltas);
  return jornadas;
}

test('round robin n=4,5,6,7 una vuelta', () => {
  for (const n of [2, 3, 4, 5, 6, 7, 8]) verificarRR(Array.from({ length: n }, (_, i) => `j${i}`), 1);
});

test('round robin dos vueltas invierte lados', () => {
  const ids = ['a', 'b', 'c', 'd'];
  const jornadas = verificarRR(ids, 2);
  assert.deepEqual(jornadas[3], jornadas[0].map(([x, y]) => [y, x]));
});

test('round robin impar registra libres', () => {
  const r = generarRoundRobin(['a', 'b', 'c'], 1);
  assert.equal(r.jornadas.length, 3);
  assert.deepEqual(new Set(r.libres), new Set(['a', 'b', 'c']));
});

function ligaBase(formatoLiga = 'rr1') {
  const jugadores = [
    { id: 'a', nombre: 'Ana', activo: true }, { id: 'b', nombre: 'Beto', activo: true },
    { id: 'c', nombre: 'Carla', activo: true }, { id: 'd', nombre: 'Dino', activo: false },
  ];
  const cal = generarRoundRobin(['a', 'b', 'c'], formatoLiga === 'rr2' ? 2 : 1);
  return { config: { formatoLiga, calendario: cal }, jugadores, partidos: [], playoffs: null };
}
const partido = (id, j1, j2, extra = {}) => ({ id, fase: 'liga', jugador1: j1, jugador2: j2, sets: [[6, 0], [6, 0]], ganador: j1, estado: 'completo', formatoPartido: 'bo3', fecha: '2026-01-01', ...extra });

test('canAddMatch respeta tope de enfrentamientos', () => {
  const L = ligaBase('rr1');
  assert.equal(canAddMatch(L, 'a', 'b').ok, true);
  L.partidos.push(partido('p1', 'a', 'b'));
  assert.equal(canAddMatch(L, 'a', 'b').ok, false);
  assert.equal(canAddMatch(L, 'b', 'a').ok, false);
  assert.equal(canAddMatch(L, 'a', 'b', { excluirId: 'p1' }).ok, true);
  assert.equal(canAddMatch(L, 'a', 'a').ok, false);
  assert.equal(canAddMatch(L, 'a', 'd').ok, false);
  assert.equal(canAddMatch(L, 'a', 'zz').ok, false);
  const L2 = ligaBase('rr2');
  L2.partidos.push(partido('p1', 'a', 'b'));
  assert.equal(canAddMatch(L2, 'a', 'b').ok, true);
  L2.partidos.push(partido('p2', 'b', 'a'));
  assert.equal(canAddMatch(L2, 'a', 'b').ok, false);
  const L3 = ligaBase('libre');
  L3.partidos.push(partido('p1', 'a', 'b'), partido('p2', 'a', 'b'), partido('p3', 'a', 'b'));
  assert.equal(canAddMatch(L3, 'a', 'b').ok, true);
});

test('pendientes descuenta partidos jugados y omite inactivos', () => {
  const L = ligaBase('rr1');
  assert.equal(pendientes(L).length, 3);
  L.partidos.push(partido('p1', 'b', 'a'));
  const p = pendientes(L);
  assert.equal(p.length, 2);
  assert.ok(!p.some((x) => [x.jugador1, x.jugador2].sort().join() === 'a,b'));
  L.jugadores[2].activo = false;
  assert.equal(pendientes(L).length, 0);
  const cal = calendarioConResultados(L);
  assert.equal(cal.length, 3);
  assert.equal(cal.flatMap((j) => j.cruces).filter((c) => c.partido).length, 1);
});

test('sin calendario no hay pendientes', () => {
  assert.deepEqual(pendientes({ config: {}, jugadores: [], partidos: [] }), []);
});

test('siembra y tamaño de llave', () => {
  assert.deepEqual(ordenSiembra(8), [1, 8, 4, 5, 2, 7, 3, 6]);
  assert.deepEqual(ordenSiembra(4), [1, 4, 2, 3]);
  assert.equal(tamanoLlave(5), 8);
  assert.equal(tamanoLlave(4), 4);
  assert.equal(tamanoLlave(2), 2);
});

test('playoffs con byes y propagación', () => {
  const filas = ['a', 'b', 'c', 'd', 'e', 'f'].map((j) => ({ jugador: j }));
  const po = generarPlayoffs(filas, { clasificados: 6, ahora: 'x' });
  assert.equal(po.tamano, 8);
  assert.equal(po.llaves.length, 4);
  assert.deepEqual(po.llaves[0], { id: 'll_r1_0', ronda: 1, pos: 0, jugador1: 'a', jugador2: null });
  const L = { config: {}, jugadores: filas.map((f) => ({ id: f.jugador, nombre: f.jugador })), partidos: [], playoffs: po };
  let res = resolverLlave(L);
  assert.equal(res.rondas.length, 3);
  assert.equal(res.rondas[0].cruces[0].bye, true);
  assert.equal(res.rondas[0].cruces[0].ganador, 'a');
  assert.equal(res.rondas[1].cruces[0].jugador1, 'a');
  assert.equal(res.rondas[1].cruces[0].jugador2, null);
  assert.equal(res.campeon, null);
  let abiertos = crucesPlayoffsAbiertos(L);
  // Siembra 8: (1,8) (4,5) (2,7) (3,6) → a-bye, d-e, b-bye, c-f
  assert.deepEqual(abiertos.map((c) => c.id), ['ll_r1_1', 'll_r1_3']);
  L.partidos.push(partido('q1', 'd', 'e', { fase: 'playoffs', llaveId: 'll_r1_1' }));
  L.partidos.push(partido('q2', 'f', 'c', { fase: 'playoffs', llaveId: 'll_r1_3' }));
  res = resolverLlave(L);
  assert.equal(res.rondas[1].cruces[0].jugador2, 'd');
  assert.equal(res.rondas[1].cruces[1].jugador1, 'b');
  assert.equal(res.rondas[1].cruces[1].jugador2, 'f');
  assert.equal(res.rondas[1].cruces[0].bye, false);
  assert.equal(tieneDependientes(L, 'll_r1_1'), false);
  L.partidos.push(partido('q3', 'a', 'd', { fase: 'playoffs', llaveId: 'll_r2_0' }));
  assert.equal(tieneDependientes(L, 'll_r1_1'), true);
  assert.equal(tieneDependientes(L, 'll_r1_3'), false);
  L.partidos.push(partido('q4', 'b', 'f', { fase: 'playoffs', llaveId: 'll_r2_1' }));
  L.partidos.push(partido('q5', 'b', 'a', { fase: 'playoffs', llaveId: 'll_r3_0' }));
  res = resolverLlave(L);
  assert.equal(res.campeon, 'b');
  assert.equal(res.rondas[2].nombre, 'Final');
  assert.equal(res.rondas[1].nombre, 'Semifinales');
  assert.equal(res.rondas[0].nombre, 'Cuartos de final');
});

test('tercer puesto', () => {
  const filas = ['a', 'b', 'c', 'd'].map((j) => ({ jugador: j }));
  const po = generarPlayoffs(filas, { clasificados: 4, tercerPuesto: true, ahora: 'x' });
  const L = { config: {}, jugadores: filas.map((f) => ({ id: f.jugador, nombre: f.jugador })), partidos: [], playoffs: po };
  L.partidos.push(partido('q1', 'a', 'd', { fase: 'playoffs', llaveId: 'll_r1_0' }));
  L.partidos.push(partido('q2', 'b', 'c', { fase: 'playoffs', llaveId: 'll_r1_1' }));
  const res = resolverLlave(L);
  assert.deepEqual([res.tercerPuesto.jugador1, res.tercerPuesto.jugador2], ['d', 'c']);
  assert.ok(crucesPlayoffsAbiertos(L).some((c) => c.id === 'll_3p'));
  assert.equal(tieneDependientes(L, 'll_r1_0'), false);
  L.partidos.push(partido('q3', 'd', 'c', { fase: 'playoffs', llaveId: 'll_3p' }));
  assert.equal(tieneDependientes(L, 'll_r1_0'), true);
});

test('generarPlayoffs exige al menos dos', () => {
  assert.throws(() => generarPlayoffs([{ jugador: 'a' }], { clasificados: 4 }));
});
