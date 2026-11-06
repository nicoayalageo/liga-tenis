import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validarSetEstandar, validarSuperTiebreak, validarSetLibre, validateMatch, formatScore, resultadoParaJugador,
} from '../js/core/scoring.js';

function p(sets, extra = {}) {
  return { jugador1: 'a', jugador2: 'b', sets, estado: 'completo', formatoPartido: 'bo3', ...extra };
}

test('sets estándar válidos e inválidos', () => {
  for (const s of [[6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [7, 5], [7, 6]]) {
    assert.equal(validarSetEstandar(s), 0, `${s} debería ser válido`);
    assert.equal(validarSetEstandar([s[1], s[0]]), 1);
  }
  for (const s of [[6, 5], [8, 6], [7, 4], [5, 3], [6, 6], [7, 7], [9, 7], [-1, 6], [6.5, 4]]) {
    assert.equal(validarSetEstandar(s), null, `${s} debería ser inválido`);
  }
});

test('super tiebreak a 10', () => {
  assert.equal(validarSuperTiebreak([10, 8]), 0);
  assert.equal(validarSuperTiebreak([8, 10]), 1);
  assert.equal(validarSuperTiebreak([11, 9]), 0);
  assert.equal(validarSuperTiebreak([12, 10]), 0);
  assert.equal(validarSuperTiebreak([10, 9]), null);
  assert.equal(validarSuperTiebreak([12, 9]), null);
  assert.equal(validarSuperTiebreak([10, 0]), 0);
  assert.equal(validarSuperTiebreak([9, 7]), null);
});

test('set libre acepta estándar, super tiebreak y sets largos', () => {
  assert.equal(validarSetLibre([6, 4]), 0);
  assert.equal(validarSetLibre([10, 8]), 0);
  assert.equal(validarSetLibre([8, 6]), 0);
  assert.equal(validarSetLibre([9, 7]), 0);
  assert.equal(validarSetLibre([6, 5]), null);
  assert.equal(validarSetLibre([8, 5]), null);
});

test('bo3: 2-0 y 2-1 válidos', () => {
  assert.equal(validateMatch(p([[6, 4], [6, 3]])).ok, true);
  const v = validateMatch(p([[6, 4], [3, 6], [7, 6]]));
  assert.equal(v.ok, true);
  assert.equal(v.ganadorCalc, 'a');
  assert.deepEqual(v.setsGanados, [2, 1]);
  assert.deepEqual(v.gamesGanados, [16, 16]);
});

test('bo3: set después de decidido es error', () => {
  const v = validateMatch(p([[6, 4], [6, 3], [6, 2]]));
  assert.equal(v.ok, false);
  assert.match(v.errores.join(' '), /decidido/);
});

test('bo3: partido incompleto', () => {
  const v = validateMatch(p([[6, 4]]));
  assert.equal(v.ok, false);
  assert.match(v.errores.join(' '), /incompleto/);
});

test('bo3: ganador declarado contradice el marcador', () => {
  const v = validateMatch(p([[6, 4], [6, 3]], { ganador: 'b' }));
  assert.equal(v.ok, false);
  assert.match(v.errores.join(' '), /no coincide/);
});

test('bo3_super: tercer set debe ser super tiebreak', () => {
  const mal = validateMatch(p([[6, 4], [3, 6], [6, 4]], { formatoPartido: 'bo3_super' }));
  assert.equal(mal.ok, false);
  assert.match(mal.errores.join(' '), /super tiebreak/);
  const bien = validateMatch(p([[6, 4], [3, 6], [10, 8]], { formatoPartido: 'bo3_super' }));
  assert.equal(bien.ok, true);
  assert.deepEqual(bien.gamesGanados, [9, 10]);
  assert.deepEqual(bien.superTiebreaks, [10, 8]);
});

test('set1 y bo5', () => {
  assert.equal(validateMatch(p([[7, 6]], { formatoPartido: 'set1' })).ok, true);
  assert.equal(validateMatch(p([[6, 4], [6, 4]], { formatoPartido: 'set1' })).ok, false);
  assert.equal(validateMatch(p([[6, 4], [6, 4], [6, 4]], { formatoPartido: 'bo5' })).ok, true);
  assert.equal(validateMatch(p([[6, 4], [4, 6], [6, 4], [4, 6], [6, 4]], { formatoPartido: 'bo5' })).ok, true);
  assert.equal(validateMatch(p([[6, 4], [6, 4]], { formatoPartido: 'bo5' })).ok, false);
});

test('libre: necesita más sets ganados que el rival', () => {
  assert.equal(validateMatch(p([[8, 6]], { formatoPartido: 'libre' })).ok, true);
  const empate = validateMatch(p([[6, 4], [4, 6]], { formatoPartido: 'libre' }));
  assert.equal(empate.ok, false);
  assert.equal(validateMatch(p([[6, 4], [4, 6], [10, 7]], { formatoPartido: 'libre' })).ok, true);
});

test('retiro: último set incompleto permitido', () => {
  const v = validateMatch(p([[6, 4], [2, 1]], { estado: 'retiro', ganador: 'a' }));
  assert.equal(v.ok, true);
  assert.deepEqual(v.setsGanados, [1, 0]);
  assert.deepEqual(v.gamesGanados, [8, 5]);
  const sinGanador = validateMatch(p([[6, 4], [2, 1]], { estado: 'retiro' }));
  assert.equal(sinGanador.ok, false);
  const contradice = validateMatch(p([[6, 4], [6, 4]], { estado: 'retiro', ganador: 'b' }));
  assert.equal(contradice.ok, false);
});

test('retiro en super tiebreak incompleto', () => {
  const v = validateMatch(p([[6, 4], [4, 6], [5, 3]], { formatoPartido: 'bo3_super', estado: 'retiro', ganador: 'a' }));
  assert.equal(v.ok, true);
});

test('W.O.: sin sets y con ganador', () => {
  assert.equal(validateMatch(p([], { estado: 'wo', ganador: 'b' })).ok, true);
  assert.equal(validateMatch(p([[6, 4]], { estado: 'wo', ganador: 'b' })).ok, false);
  assert.equal(validateMatch(p([], { estado: 'wo' })).ok, false);
});

test('mismo jugador y formato desconocido', () => {
  assert.equal(validateMatch(p([[6, 4], [6, 4]], { jugador2: 'a' })).ok, false);
  assert.equal(validateMatch(p([[6, 4], [6, 4]], { formatoPartido: 'xx' })).ok, false);
});

test('formatScore', () => {
  assert.equal(formatScore(p([[6, 4], [3, 6], [10, 8]], { formatoPartido: 'bo3_super' })), '6-4 3-6 [10-8]');
  assert.equal(formatScore(p([[6, 4], [3, 6], [10, 8]], { formatoPartido: 'bo3_super' }), 'b'), '4-6 6-3 [8-10]');
  assert.equal(formatScore(p([], { estado: 'wo', ganador: 'a' })), 'W.O.');
  assert.equal(formatScore(p([[6, 4], [2, 1]], { estado: 'retiro', ganador: 'a' })), '6-4 2-1 ret.');
  assert.equal(formatScore(p([[10, 8]], { formatoPartido: 'libre' })), '[10-8]');
});

test('resultadoParaJugador con y sin super tiebreak en games', () => {
  const m = p([[6, 4], [3, 6], [10, 8]], { formatoPartido: 'bo3_super', ganador: 'a' });
  const r = resultadoParaJugador(m, 'b');
  assert.equal(r.gano, false);
  assert.equal(r.setsF, 1);
  assert.equal(r.gamesF, 10);
  assert.equal(r.gamesC, 9);
  const r2 = resultadoParaJugador(m, 'b', { superTiebreakCuentaGames: true });
  assert.equal(r2.gamesF, 18);
  assert.equal(resultadoParaJugador(m, 'zzz'), null);
});
