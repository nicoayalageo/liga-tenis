// Historial de cambios.

import { h, fmtFechaHora } from '../util.js';

const ETIQUETAS = { config: 'Configuración', partido: 'Partido', propuesta: 'Propuesta', jugador: 'Jugador', calendario: 'Calendario', playoffs: 'Playoffs', admin: 'Administradores', pin: 'PIN' };

export function renderHistorial(contenedor, ctx) {
  const { historial } = ctx;
  if (!historial.length) {
    contenedor.innerHTML = String(h`<div class="vacio"><h3>Sin cambios registrados</h3></div>`);
    return;
  }
  contenedor.innerHTML = String(h`
    <ul class="historial">
      ${historial.map((e) => h`
        <li>
          <small>${fmtFechaHora(e.fecha)}<br>${e.actor}</small>
          <span><span class="chip">${ETIQUETAS[e.accion] || e.accion}</span> ${e.detalle}</span>
        </li>`)}
    </ul>
  `);
}
