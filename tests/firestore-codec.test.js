import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codificar, decodificar } from '../js/core/firestore-codec.js';

test('sets anidados van y vuelven sin cambios', () => {
  const partido = { jugador1: 'a', sets: [[6, 4], [3, 6], [10, 8]], estado: 'completo' };
  const cod = codificar(partido);
  assert.deepEqual(cod.sets, [{ _l: [6, 4] }, { _l: [3, 6] }, { _l: [10, 8] }]);
  assert.ok(cod.sets.every((s) => !Array.isArray(s)));
  assert.deepEqual(decodificar(cod), partido);
});

test('calendario con tres niveles de lista', () => {
  const calendario = { jornadas: [[['a', 'b'], ['c', 'd']], [['a', 'c']]], libres: [null, 'd'], jugadores: ['a', 'b', 'c', 'd'] };
  const cod = codificar(calendario);
  const sinListasAnidadas = (v) => (Array.isArray(v) ? v.every((el) => !Array.isArray(el) && sinListasAnidadas(el)) : (v && typeof v === 'object' ? Object.values(v).every(sinListasAnidadas) : true));
  assert.ok(sinListasAnidadas(cod));
  assert.deepEqual(decodificar(cod), calendario);
});

test('no toca fechas ni instancias de clases', () => {
  class Marca { constructor() { this.x = [[1]]; } }
  const d = new Date(0);
  const m = new Marca();
  const cod = codificar({ d, m, lista: [] });
  assert.equal(cod.d, d);
  assert.equal(cod.m, m);
  assert.deepEqual(cod.lista, []);
  assert.equal(decodificar(cod).d, d);
});

test('un mapa real con clave _l y otras claves no se confunde', () => {
  const v = { _l: [1], otra: 2 };
  assert.deepEqual(decodificar(codificar(v)), v);
});
