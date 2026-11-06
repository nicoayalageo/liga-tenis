// Lista de resultados agrupados por fecha, con filtro por jugador.

import { h, raw, $$, fmtFecha, fmtMes, nombreJugador, iniciales } from '../util.js';
import { ordenarPartidos } from '../core/stats.js';
import { marcadorHtml } from './components.js';

export function tarjetaPartido(liga, m, opciones = {}) {
  const n1 = nombreJugador(liga, m.jugador1);
  const n2 = nombreJugador(liga, m.jugador2);
  const g1 = m.ganador === m.jugador1;
  const g2 = m.ganador === m.jugador2;
  return h`
    <article class="partido ${opciones.clase || ''}" data-id="${m.id}">
      <div class="partido__jugador ${g1 ? 'gano' : ''}"><span class="avatar">${iniciales(n1)}</span><span class="nombre">${n1}</span></div>
      ${marcadorHtml(m)}
      <div class="partido__jugador ${g2 ? 'gano' : ''}"><span class="avatar avatar--verde">${iniciales(n2)}</span><span class="nombre">${n2}</span></div>
      <div></div>
      <div class="partido__pie">
        <span>${m.fase === 'playoffs' ? h`<span class="chip chip--ocre">Playoffs</span> ` : ''}${fmtFecha(m.fecha)}${m.nota ? h` · ${m.nota}` : ''}</span>
        ${opciones.acciones ? raw(opciones.acciones) : ''}
      </div>
    </article>`;
}

export function renderResultados(contenedor, liga, estado = {}) {
  const partidos = ordenarPartidos(liga.partidos || []).reverse();
  if (partidos.length === 0) {
    contenedor.innerHTML = String(h`<div class="vacio"><h3>Todavía no hay resultados</h3><p>Cuando se aprueben los primeros partidos aparecerán aquí.</p></div>`);
    return;
  }
  const filtro = estado.filtro || '';
  const jugadoresConPartidos = (liga.jugadores || []).filter((j) => partidos.some((m) => m.jugador1 === j.id || m.jugador2 === j.id));
  const visibles = filtro ? partidos.filter((m) => m.jugador1 === filtro || m.jugador2 === filtro) : partidos;
  const grupos = new Map();
  for (const m of visibles) {
    const mes = (m.fecha || '').slice(0, 7);
    if (!grupos.has(mes)) grupos.set(mes, []);
    grupos.get(mes).push(m);
  }
  contenedor.innerHTML = String(h`
    <div class="filtros" role="group" aria-label="Filtrar por jugador">
      <button type="button" class="chip chip--boton ${filtro ? '' : 'activo'}" data-filtro="">Todos</button>
      ${jugadoresConPartidos.map((j) => h`<button type="button" class="chip chip--boton ${filtro === j.id ? 'activo' : ''}" data-filtro="${j.id}">${j.nombre}</button>`)}
    </div>
    ${[...grupos.entries()].map(([fecha, lista]) => h`
      <div class="fecha-grupo">
        <h3 class="fecha-grupo__titulo">${fmtMes(fecha)}</h3>
        <div class="partidos">${lista.map((m) => tarjetaPartido(liga, m))}</div>
      </div>`)}
  `);
  $$('[data-filtro]', contenedor).forEach((b) => b.addEventListener('click', () => {
    estado.filtro = b.dataset.filtro;
    renderResultados(contenedor, liga, estado);
  }));
}
