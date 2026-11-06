import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizarConfig, newId, hoyLocal, esFechaValida, validarNombreJugador, validarInscripcion, prepararPartido, validateLiga,
} from '../js/core/model.js';

test('normalizarConfig rellena y corrige', () => {
  const c = normalizarConfig({ formatoLiga: 'xx', puntosVictoria: '3', desempate: ['h2h', 'inventado'], playoffs: { clasificados: 100 } });
  assert.equal(c.formatoLiga, 'rr1');
  assert.equal(c.puntosVictoria, 3);
  assert.deepEqual(c.desempate, ['h2h']);
  assert.equal(c.playoffs.clasificados, 32);
  assert.equal(c.h2hModo, 'minitabla');
  assert.equal(normalizarConfig(null).configurada, false);
});

test('ids únicos con prefijo', () => {
  const a = newId('p');
  const b = newId('p');
  assert.match(a, /^p_[0-9a-z]{8}$/);
  assert.notEqual(a, b);
});

test('fechas locales y validación', () => {
  assert.equal(hoyLocal(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(esFechaValida('2026-02-29'), false);
  assert.equal(esFechaValida('2024-02-29'), true);
  assert.equal(esFechaValida('2026-13-01'), false);
  assert.equal(esFechaValida('06/11/2026'), false);
});

test('nombre de jugador', () => {
  const js = [{ id: 'a', nombre: 'Ana Pérez' }];
  assert.equal(validarNombreJugador('ana  perez', js).ok, false);
  assert.equal(validarNombreJugador('ana perez', js, 'a').ok, true);
  assert.equal(validarNombreJugador('A', js).ok, false);
  assert.equal(validarNombreJugador('  Beto   Díaz ', js).nombre, 'Beto Díaz');
});

test('prepararPartido normaliza y calcula ganador', () => {
  const cfg = normalizarConfig({ formatoPartido: 'bo3_super' });
  const r = prepararPartido({ jugador1: 'a', jugador2: 'b', fecha: '2026-03-01', estado: 'completo', sets: [['6', '4'], ['3', '6'], ['10', '8']] }, cfg);
  assert.equal(r.ok, true);
  assert.equal(r.partido.ganador, 'a');
  assert.equal(r.partido.formatoPartido, 'bo3_super');
  assert.deepEqual(r.partido.sets, [[6, 4], [3, 6], [10, 8]]);
  const wo = prepararPartido({ jugador1: 'a', jugador2: 'b', estado: 'wo', ganador: 'b', sets: [[6, 4]] }, cfg);
  assert.equal(wo.ok, true);
  assert.deepEqual(wo.partido.sets, []);
  const malaFecha = prepararPartido({ jugador1: 'a', jugador2: 'b', fecha: '2026-02-30', sets: [[6, 4], [6, 4]] }, cfg);
  assert.equal(malaFecha.ok, false);
  const po = prepararPartido({ jugador1: 'a', jugador2: 'b', fase: 'playoffs', sets: [[6, 4], [6, 4]] }, cfg);
  assert.equal(po.ok, false);
});

test('validateLiga detecta inconsistencias', () => {
  const L = {
    config: { formatoLiga: 'rr1', formatoPartido: 'bo3' },
    jugadores: [{ id: 'a', nombre: 'Ana' }, { id: 'b', nombre: 'Beto' }, { id: 'a', nombre: 'Dup' }],
    partidos: [
      { id: 'p1', jugador1: 'a', jugador2: 'b', sets: [[6, 4], [6, 4]], ganador: 'a', estado: 'completo', formatoPartido: 'bo3', fecha: '2026-01-01' },
      { id: 'p2', jugador1: 'a', jugador2: 'b', sets: [[6, 4], [6, 4]], ganador: 'b', estado: 'completo', formatoPartido: 'bo3', fecha: '2026-01-02' },
      { id: 'p3', jugador1: 'a', jugador2: 'z', sets: [[6, 4], [6, 4]], ganador: 'a', estado: 'completo', formatoPartido: 'bo3', fecha: 'ayer' },
    ],
  };
  const e = validateLiga(L);
  assert.ok(e.some((x) => /repetido/.test(x)));
  assert.ok(e.some((x) => /no coincide/.test(x)));
  assert.ok(e.some((x) => /desconocido/.test(x)));
  assert.ok(e.some((x) => /fecha/.test(x)));
  assert.ok(e.some((x) => /permite 1/.test(x)));
  const limpia = validateLiga({ config: {}, jugadores: [{ id: 'a', nombre: 'Ana' }], partidos: [] });
  assert.deepEqual(limpia, []);
});

test('validarInscripcion limpia y rechaza duplicados', () => {
  const jugadores = [{ id: 'j1', nombre: 'Ana Pérez' }];
  const ok = validarInscripcion({ nombre: '  Beto   Díaz ', contacto: ' +56 9 1234 5678 ', mensaje: 'Juego los sábados' }, jugadores);
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.datos, { nombre: 'Beto Díaz', contacto: '+56 9 1234 5678', mensaje: 'Juego los sábados' });
  assert.equal(validarInscripcion({ nombre: 'ana perez' }, jugadores).ok, false);
  assert.equal(validarInscripcion({ nombre: 'B' }).ok, false);
  assert.equal(validarInscripcion({ nombre: 'Carla', mensaje: 'x'.repeat(201) }).ok, false);
  assert.equal(validarInscripcion({ nombre: 'Carla', contacto: 'x'.repeat(81) }).ok, false);
  assert.deepEqual(validarInscripcion({ nombre: 'Carla' }).datos, { nombre: 'Carla', contacto: '', mensaje: '' });
});
