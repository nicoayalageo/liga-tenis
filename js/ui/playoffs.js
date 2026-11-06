// Llave de playoffs.

import { h, nombreJugador } from '../util.js';
import { resolverLlave } from '../core/fixtures.js';
import { formatScore } from '../core/scoring.js';

function filaLlave(liga, id, cruce, esGanador) {
  if (!id) return h`<div class="cruce-llave__fila vacio"><span>${cruce.bye ? 'Pasa directo' : 'Por definir'}</span></div>`;
  const marcador = cruce.partido && cruce.partido.ganador ? formatScore(cruce.partido, id) : '';
  return h`<div class="cruce-llave__fila ${esGanador ? 'gano' : ''}"><span>${nombreJugador(liga, id)}</span><span class="cruce-llave__marcador">${esGanador ? marcador : ''}</span></div>`;
}

export function renderPlayoffs(contenedor, seccion, liga) {
  const res = resolverLlave(liga);
  if (!res) { seccion.hidden = true; return; }
  seccion.hidden = false;
  contenedor.innerHTML = String(h`
    ${res.campeon ? h`<div class="campeon" style="margin-bottom:16px"><div class="campeon__titulo">Campeón</div><div class="campeon__nombre">${nombreJugador(liga, res.campeon)}</div></div>` : ''}
    <div class="llave">
      ${res.rondas.map((r) => h`
        <div class="ronda">
          <div class="ronda__titulo">${r.nombre}</div>
          ${r.cruces.map((c) => h`
            <div class="cruce-llave">
              ${filaLlave(liga, c.jugador1, c, c.ganador && c.ganador === c.jugador1)}
              ${filaLlave(liga, c.jugador2, c, c.ganador && c.ganador === c.jugador2)}
            </div>`)}
        </div>`)}
      ${res.tercerPuesto ? h`
        <div class="ronda">
          <div class="ronda__titulo">Tercer puesto</div>
          <div class="cruce-llave">
            ${filaLlave(liga, res.tercerPuesto.jugador1, res.tercerPuesto, res.tercerPuesto.ganador === res.tercerPuesto.jugador1)}
            ${filaLlave(liga, res.tercerPuesto.jugador2, res.tercerPuesto, res.tercerPuesto.ganador === res.tercerPuesto.jugador2)}
          </div>
        </div>` : ''}
    </div>
  `);
}
