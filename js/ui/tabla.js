// Tabla de posiciones.

import { h, raw, fmtPct, iniciales } from '../util.js';
import { computeStandings } from '../core/standings.js';
import { CRITERIOS_DESEMPATE } from '../core/formats.js';

export function renderTabla(contenedor, liga) {
  const filas = computeStandings(liga);
  const config = liga.config;
  const hayPartidos = (liga.partidos || []).some((m) => (m.fase || 'liga') === 'liga');
  if (filas.length === 0) {
    contenedor.innerHTML = String(h`<div class="vacio"><h3>Todavía no hay jugadores</h3><p>El administrador agregará a los participantes.</p></div>`);
    return;
  }
  const topN = config.formatoLiga.endsWith('_playoffs') ? config.playoffs.clasificados : 0;
  const criterios = (config.desempate || []).map((c) => CRITERIOS_DESEMPATE[c]?.label).filter(Boolean);
  contenedor.innerHTML = String(h`
    <div class="tabla-envoltura">
      <table class="tabla">
        <thead>
          <tr>
            <th class="col-pos">#</th>
            <th class="col-jugador">Jugador</th>
            <th class="col-pts" title="Puntos">Pts</th>
            <th title="Partidos jugados">PJ</th>
            <th title="Partidos ganados">PG</th>
            <th title="Partidos perdidos">PP</th>
            <th class="col-sec" title="Sets ganados - perdidos">Sets</th>
            <th class="col-sec" title="Porcentaje de sets ganados">% S</th>
            <th class="col-sec" title="Games ganados - perdidos">Games</th>
            <th class="col-sec" title="Porcentaje de games ganados">% G</th>
            <th title="Últimos cinco partidos">Forma</th>
          </tr>
        </thead>
        <tbody>
          ${filas.map((f, i) => h`
            <tr class="${f.activo ? '' : 'retirado'} ${topN && f.pos <= topN ? 'top' : ''} ${i === 0 && hayPartidos ? 'lider' : ''}">
              <td class="col-pos">${f.pos}${f.empatado ? h`<span class="empate" title="Posición compartida">=</span>` : ''}</td>
              <td class="col-jugador">
                <div class="jugador-celda">
                  <span class="avatar ${i % 2 ? 'avatar--verde' : ''}">${iniciales(f.nombre)}</span>
                  <span class="nombre-celda">
                    <strong>${f.nombre}</strong>
                    ${!f.activo ? h`<small>Retirado</small>` : (f.desempatadoPor && f.desempatadoPor !== 'alfabetico' ? h`<small>Desempate: ${CRITERIOS_DESEMPATE[f.desempatadoPor]?.label || f.desempatadoPor}</small>` : '')}
                  </span>
                </div>
              </td>
              <td class="col-pts">${f.puntos}</td>
              <td>${f.pj}</td>
              <td>${f.pg}</td>
              <td>${f.pp}</td>
              <td class="col-sec">${f.setsG}-${f.setsP}</td>
              <td class="col-sec">${f.pj ? fmtPct(f.pctSets) : '–'}</td>
              <td class="col-sec">${f.gamesG}-${f.gamesP}</td>
              <td class="col-sec">${f.pj ? fmtPct(f.pctGames) : '–'}</td>
              <td><span class="forma">${f.forma.map((x) => h`<span class="${x === 'G' ? 'g' : 'p'}" title="${x === 'G' ? 'Ganó' : 'Perdió'}">${x}</span>`)}</span></td>
            </tr>`)}
        </tbody>
      </table>
    </div>
    <p class="seccion__sub" style="margin-top:10px">
      ${config.puntosVictoria} ${config.puntosVictoria === 1 ? 'punto' : 'puntos'} por victoria${config.puntosDerrota ? h`, ${config.puntosDerrota} por derrota` : ''}.
      ${criterios.length ? h`Desempate: ${criterios.join(' → ')}.` : 'Sin criterios de desempate: los empates comparten posición.'}
      ${topN ? h` Los primeros ${topN} clasifican a playoffs.` : ''}
    </p>
  `);
}
