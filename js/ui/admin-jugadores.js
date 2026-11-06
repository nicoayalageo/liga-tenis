// Gestión de jugadores.

import { h, $, $$, iniciales } from '../util.js';
import { confirmar, pedirTexto, toast } from './components.js';
import { agregarJugador, renombrarJugador, setJugadorActivo, eliminarJugador } from '../store.js';
import { mensajeError } from '../db.js';
import { pendientes } from '../core/fixtures.js';

export function renderJugadoresAdmin(contenedor, ctx) {
  const { liga, actor } = ctx;
  const jugadores = [...(liga.jugadores || [])].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const partidosDe = (id) => (liga.partidos || []).filter((m) => m.jugador1 === id || m.jugador2 === id).length;
  const pend = pendientes(liga);
  contenedor.innerHTML = String(h`
    <form class="inline-form tarjeta" data-nuevo style="margin-bottom:16px">
      <label for="nj" class="visually-hidden">Nombre del jugador</label>
      <input id="nj" class="entrada" type="text" maxlength="40" placeholder="Nombre y apellido" required>
      <button type="submit" class="btn">Agregar jugador</button>
    </form>
    ${liga.config.calendario ? h`<p class="aviso aviso--aviso" style="margin-bottom:12px">Ya hay un calendario generado. Si agregas o retiras jugadores, vuelve a generarlo en Configuración (los partidos jugados se conservan).</p>` : ''}
    <ul class="lista-simple">
      ${jugadores.length === 0 ? h`<li class="texto-suave">Todavía no hay jugadores.</li>` : jugadores.map((j, i) => h`
        <li data-id="${j.id}" class="${j.activo === false ? 'retirado' : ''}">
          <span class="avatar ${i % 2 ? 'avatar--verde' : ''}">${iniciales(j.nombre)}</span>
          <span class="texto"><strong>${j.nombre}</strong>${j.activo === false ? h` <span class="chip chip--error">Retirado</span>` : ''}<small>${partidosDe(j.id)} ${partidosDe(j.id) === 1 ? 'partido registrado' : 'partidos registrados'}${j.activo !== false && pend.some((p) => p.jugador1 === j.id || p.jugador2 === j.id) ? h` · ${pend.filter((p) => p.jugador1 === j.id || p.jugador2 === j.id).length} pendientes` : ''}</small></span>
          <span class="acciones">
            <button type="button" class="btn btn--fantasma btn--sm" data-renombrar>Renombrar</button>
            <button type="button" class="btn btn--fantasma btn--sm" data-activo>${j.activo === false ? 'Reactivar' : 'Retirar'}</button>
            ${partidosDe(j.id) === 0 ? h`<button type="button" class="btn btn--fantasma btn--sm" style="color:var(--error)" data-eliminar>Eliminar</button>` : ''}
          </span>
        </li>`)}
    </ul>
  `);
  $('[data-nuevo]', contenedor).addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('#nj', contenedor);
    try {
      await agregarJugador(liga, input.value, actor);
      toast(`${input.value.trim()} agregado.`, 'ok');
      input.value = '';
    } catch (ex) {
      toast(mensajeError(ex), 'error');
    }
  });
  $$('li[data-id]', contenedor).forEach((li) => {
    const j = jugadores.find((x) => x.id === li.dataset.id);
    $('[data-renombrar]', li).addEventListener('click', async () => {
      const nuevo = await pedirTexto({ titulo: 'Renombrar jugador', etiqueta: 'Nuevo nombre', valor: j.nombre });
      if (nuevo === null || nuevo.trim() === j.nombre) return;
      try { await renombrarJugador(liga, j.id, nuevo, actor); toast('Nombre actualizado.', 'ok'); } catch (ex) { toast(mensajeError(ex), 'error'); }
    });
    $('[data-activo]', li).addEventListener('click', async () => {
      const retirar = j.activo !== false;
      if (retirar) {
        const ok = await confirmar({ titulo: 'Retirar jugador', mensaje: `${j.nombre} dejará de aparecer en los cruces pendientes y no podrá cargar nuevos partidos. Sus resultados se conservan. ¿Continuar?`, textoOk: 'Retirar' });
        if (!ok) return;
      }
      try { await setJugadorActivo(liga, j.id, !retirar, actor); toast(retirar ? 'Jugador retirado.' : 'Jugador reactivado.', 'ok'); } catch (ex) { toast(mensajeError(ex), 'error'); }
    });
    const el = $('[data-eliminar]', li);
    if (el) el.addEventListener('click', async () => {
      const ok = await confirmar({ titulo: 'Eliminar jugador', mensaje: `¿Eliminar a ${j.nombre}? No tiene partidos registrados.`, textoOk: 'Eliminar', peligro: true });
      if (!ok) return;
      try { await eliminarJugador(liga, j.id, actor); toast('Jugador eliminado.'); } catch (ex) { toast(mensajeError(ex), 'error'); }
    });
  });
}
