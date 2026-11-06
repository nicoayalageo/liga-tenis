// Tarjetas de jugadores.

import { h, fmtPct, iniciales, nombreJugador } from '../util.js';
import { computeStandings } from '../core/standings.js';
import { pendientes } from '../core/fixtures.js';

export function renderJugadores(contenedor, liga) {
  const filas = computeStandings(liga);
  if (filas.length === 0) { contenedor.innerHTML = ''; return; }
  const pend = pendientes(liga);
  const proximo = (id) => {
    const p = pend.find((x) => x.jugador1 === id || x.jugador2 === id);
    return p ? nombreJugador(liga, p.jugador1 === id ? p.jugador2 : p.jugador1) : null;
  };
  contenedor.innerHTML = String(h`
    <div class="jugadores">
      ${filas.map((f, i) => h`
        <article class="tarjeta jugador-card ${f.activo ? '' : 'retirado'}">
          <div class="jugador-card__cab">
            <span class="avatar avatar--grande ${i % 2 ? 'avatar--verde' : ''}">${iniciales(f.nombre)}</span>
            <div class="nombre-celda"><strong>${f.nombre}</strong><small>${f.activo ? h`${f.pg}–${f.pp} en partidos` : 'Retirado'}</small></div>
            <span class="jugador-card__pos" title="Posición">${f.pos}º</span>
          </div>
          <div class="jugador-card__stats">
            <div><b>${f.puntos}</b><small>Puntos</small></div>
            <div><b>${f.pj ? fmtPct(f.pctSets) : '–'}</b><small>Sets</small></div>
            <div><b>${f.pj ? fmtPct(f.pctGames) : '–'}</b><small>Games</small></div>
          </div>
          <div class="jugador-card__pie">
            <span class="forma">${f.forma.length ? f.forma.map((x) => h`<span class="${x === 'G' ? 'g' : 'p'}">${x}</span>`) : h`<span class="texto-suave">Sin partidos</span>`}</span>
            ${proximo(f.jugador) ? h`<span>Próximo: ${proximo(f.jugador)}</span>` : ''}
          </div>
        </article>`)}
    </div>
  `);
}
