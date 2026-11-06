// Calendario por jornadas con cruces jugados y pendientes.

import { h, nombreJugador } from '../util.js';
import { calendarioConResultados, pendientes } from '../core/fixtures.js';
import { formatScore } from '../core/scoring.js';

export function renderCalendario(contenedor, liga) {
  const cal = calendarioConResultados(liga);
  if (cal.length === 0) {
    contenedor.innerHTML = String(h`<div class="vacio"><h3>Calendario por definir</h3><p>El administrador generará las jornadas cuando estén todos los jugadores.</p></div>`);
    return;
  }
  const faltan = pendientes(liga).length;
  const total = cal.reduce((n, j) => n + j.cruces.length, 0);
  const inactivos = new Set((liga.jugadores || []).filter((j) => j.activo === false).map((j) => j.id));
  // La primera jornada con pendientes se muestra abierta.
  const primeraAbierta = cal.findIndex((j) => j.cruces.some((c) => !c.partido && !inactivos.has(c.jugador1) && !inactivos.has(c.jugador2)));
  contenedor.innerHTML = String(h`
    <p class="seccion__sub" style="margin-bottom:12px">${faltan === 0 ? 'Fase regular completa.' : h`Faltan <strong>${faltan}</strong> de ${total} partidos.`}</p>
    <div class="jornadas">
      ${cal.map((j, idx) => {
        const jugados = j.cruces.filter((c) => c.partido).length;
        return h`
        <details class="jornada" ${idx === primeraAbierta ? 'open' : ''}>
          <summary><span>Jornada ${j.numero}</span><span class="jornada__progreso">${jugados}/${j.cruces.length}</span></summary>
          <div class="jornada__cuerpo">
            ${j.cruces.map((c) => {
              const n1 = nombreJugador(liga, c.jugador1);
              const n2 = nombreJugador(liga, c.jugador2);
              const retirado = inactivos.has(c.jugador1) || inactivos.has(c.jugador2);
              if (c.partido) {
                const p = c.partido;
                const g1 = p.ganador === c.jugador1;
                return h`<div class="cruce"><span class="izq ${g1 ? 'gano' : ''}">${n1}</span><span class="centro">${formatScore(p, c.jugador1)}</span><span class="der ${g1 ? '' : 'gano'}">${n2}</span></div>`;
              }
              return h`<div class="cruce cruce--pendiente"><span class="izq">${n1}</span><span class="centro">${retirado ? 'Sin efecto' : 'Pendiente'}</span><span class="der">${n2}</span></div>`;
            })}
            ${j.libre ? h`<div class="jornada__libre">Libre: ${nombreJugador(liga, j.libre)}</div>` : ''}
          </div>
        </details>`;
      })}
    </div>
  `);
}
