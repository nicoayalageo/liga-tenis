// Datos de ejemplo para previsualizar la página sin conexión a Firebase (index.html?demo=1).

import { normalizarConfig } from './core/model.js';
import { generarRoundRobin } from './core/fixtures.js';

const nombres = ['Ana Pérez', 'Beto Díaz', 'Carla Rojas', 'Dino Soto', 'Elena Vidal', 'Fabián Mora', 'Gabriela Núñez'];
const jugadores = nombres.map((n, i) => ({ id: `j_demo${i}`, nombre: n, activo: i !== 6, creadoEn: '2026-03-01T00:00:00Z' }));
const ids = jugadores.map((j) => j.id);
const cal = generarRoundRobin(ids.slice(0, 6), 1);

const marcadores = [
  [[6, 4], [3, 6], [10, 8]], [[6, 2], [6, 3]], [[7, 6], [6, 4]], [[4, 6], [6, 3], [10, 5]], [[6, 0], [6, 1]],
  [[3, 6], [2, 6]], [[6, 4], [6, 4]], [[7, 5], [4, 6], [8, 10]], [[6, 3], [6, 2]], [[2, 6], [6, 4], [10, 7]],
];
const partidos = [];
let k = 0;
for (const jornada of cal.jornadas.slice(0, 4)) {
  for (const [a, b] of jornada) {
    if (k >= marcadores.length) break;
    const sets = marcadores[k];
    const ganaA = sets.filter((s) => s[0] > s[1]).length > sets.filter((s) => s[0] < s[1]).length;
    const dia = 3 + k * 2;
    partidos.push({
      id: `p_demo${k}`, fase: 'liga', llaveId: null, jugador1: a, jugador2: b,
      fecha: `2026-03-${String(dia).padStart(2, '0')}`, formatoPartido: 'bo3_super', sets,
      ganador: ganaA ? a : b, estado: 'completo', nota: k === 2 ? 'Cancha 3' : '', origen: 'admin',
      ingresadoPor: 'Nicolás', ingresadoEn: `2026-03-${String(dia).padStart(2, '0')}T20:00:00Z`,
    });
    k += 1;
  }
}
partidos.push({
  id: 'p_demo_wo', fase: 'liga', llaveId: null, jugador1: ids[6], jugador2: ids[0], fecha: '2026-03-25', formatoPartido: 'bo3_super',
  sets: [], ganador: ids[0], estado: 'wo', nota: '', origen: 'admin', ingresadoPor: 'Nicolás', ingresadoEn: '2026-03-25T20:00:00Z',
});

export const ligaDemo = {
  config: normalizarConfig({
    configurada: true,
    nombre: 'Liga Polvo de Ladrillo',
    temporada: '2026',
    lema: 'Donde cada punto se gana con las zapatillas naranjas.',
    formatoLiga: 'rr1_playoffs',
    formatoPartido: 'bo3_super',
    calendario: { generadoEn: '2026-03-01T00:00:00Z', jugadores: cal.jugadores, jornadas: cal.jornadas, libres: cal.libres },
    updatedAt: new Date(Date.now() - 7 * 60000).toISOString(),
    updatedBy: 'Nicolás',
  }),
  jugadores,
  partidos,
  playoffs: null,
};

export const inscripcionesDemo = [
  { id: 'insc1', nombre: 'Hernán Lagos', contacto: '+56 9 8765 4321', mensaje: 'Puedo jugar sábados por la mañana', estado: 'pendiente', enviadoPorUid: 'anon3', creadoEn: new Date(Date.now() - 1800000) },
  { id: 'insc2', nombre: 'Ana Perez', contacto: '', mensaje: '', estado: 'pendiente', enviadoPorUid: 'anon4', creadoEn: new Date(Date.now() - 5400000) },
];

export const propuestasDemo = [
  { id: 'prop1', fase: 'liga', llaveId: null, jugador1: ids[3], jugador2: ids[1], fecha: '2026-03-27', formatoPartido: 'bo3_super', sets: [[6, 3], [4, 6], [10, 6]], ganador: ids[3], estado: 'completo', nota: '', estadoPropuesta: 'pendiente', enviadoPorUid: 'anon1', enviadoComo: ids[3], creadoEn: new Date(Date.now() - 3600000) },
  { id: 'prop2', fase: 'liga', llaveId: null, jugador1: ids[0], jugador2: ids[5], fecha: '2026-03-28', formatoPartido: 'bo3_super', sets: [[6, 2], [6, 1]], ganador: ids[0], estado: 'completo', nota: '', estadoPropuesta: 'pendiente', enviadoPorUid: 'anon2', enviadoComo: ids[0], creadoEn: new Date(Date.now() - 7200000) },
];
export const historialDemo = [
  { id: 'h1', accion: 'partido', detalle: 'Resultado ingresado: Ana Pérez vs Fabián Mora · 6-4 3-6 [10-8] · 2026-03-03', actor: 'Nicolás', fecha: '2026-03-03T20:00:00Z' },
  { id: 'h2', accion: 'calendario', detalle: 'Calendario generado: 5 jornadas, 6 jugadores', actor: 'Nicolás', fecha: '2026-03-01T10:00:00Z' },
];
