// Ingreso, edición y eliminación de resultados por el administrador.

import { h, $, $$, nombreJugador, fmtFecha } from '../util.js';
import { abrirDialogo, confirmar, toast } from './components.js';
import { formularioPartido } from './partido-form.js';
import { tarjetaPartido } from './resultados.js';
import { crearPartido, editarPartido, eliminarPartido } from '../store.js';
import { mensajeError } from '../db.js';
import { ordenarPartidos } from '../core/stats.js';
import { formatScore } from '../core/scoring.js';

export function abrirFormularioPartido(ctx, datos = null) {
  const { liga, actor } = ctx;
  let form = null;
  const dlg = abrirDialogo({
    titulo: datos ? 'Editar resultado' : 'Nuevo resultado',
    ancho: 'min(640px, calc(100vw - 32px))',
    cuerpo: '<div data-form></div><div class="aviso aviso--error" data-error hidden></div>',
    botones: [
      { texto: 'Cancelar', clase: 'btn--sec' },
      {
        texto: datos ? 'Guardar cambios' : 'Publicar resultado',
        clase: '',
        accion: async (d) => {
          const err = $('[data-error]', d);
          err.hidden = true;
          const v = form.validar();
          if (!v.ok) { err.textContent = v.errores[0]; err.hidden = false; return false; }
          try {
            if (datos) await editarPartido(liga, datos.id, form.leer(), actor);
            else await crearPartido(liga, form.leer(), actor);
            toast(datos ? 'Resultado actualizado.' : 'Resultado publicado.', 'ok');
            return true;
          } catch (ex) {
            err.textContent = mensajeError(ex); err.hidden = false; return false;
          }
        },
      },
    ],
  });
  form = formularioPartido($('[data-form]', dlg), { liga, modo: 'admin', datos, excluirId: datos ? datos.id : null });
  form.enfocar();
}

export function renderResultadosAdmin(contenedor, ctx, estado = {}) {
  const { liga } = ctx;
  const partidos = ordenarPartidos(liga.partidos || []).reverse();
  const filtro = estado.filtro || '';
  const visibles = filtro ? partidos.filter((m) => m.jugador1 === filtro || m.jugador2 === filtro) : partidos;
  contenedor.innerHTML = String(h`
    <div class="acciones" style="margin-bottom:14px">
      <button type="button" class="btn" data-nuevo>+ Nuevo resultado</button>
      <select class="entrada" style="width:auto" data-filtro aria-label="Filtrar por jugador">
        <option value="">Todos los jugadores</option>
        ${(liga.jugadores || []).map((j) => h`<option value="${j.id}" ${filtro === j.id ? 'selected' : ''}>${j.nombre}</option>`)}
      </select>
      <span class="texto-suave">${visibles.length} ${visibles.length === 1 ? 'partido' : 'partidos'}</span>
    </div>
    ${visibles.length === 0 ? h`<div class="vacio"><h3>Sin resultados</h3><p>Ingresa el primero con el botón de arriba.</p></div>` : h`
      <div class="partidos">
        ${visibles.map((m) => tarjetaPartido(liga, m, {
          acciones: String(h`<span class="acciones"><button type="button" class="btn btn--fantasma btn--sm" data-editar="${m.id}">Editar</button><button type="button" class="btn btn--fantasma btn--sm" data-eliminar="${m.id}" style="color:var(--error)">Eliminar</button></span>`),
        }))}
      </div>`}
  `);
  $('[data-nuevo]', contenedor).addEventListener('click', () => abrirFormularioPartido(ctx));
  $('[data-filtro]', contenedor).addEventListener('change', (e) => { estado.filtro = e.target.value; renderResultadosAdmin(contenedor, ctx, estado); });
  $$('[data-editar]', contenedor).forEach((b) => b.addEventListener('click', () => {
    const m = partidos.find((x) => x.id === b.dataset.editar);
    if (m) abrirFormularioPartido(ctx, m);
  }));
  $$('[data-eliminar]', contenedor).forEach((b) => b.addEventListener('click', async () => {
    const m = partidos.find((x) => x.id === b.dataset.eliminar);
    if (!m) return;
    const ok = await confirmar({
      titulo: 'Eliminar resultado',
      mensaje: `¿Eliminar ${nombreJugador(liga, m.jugador1)} vs ${nombreJugador(liga, m.jugador2)} (${formatScore(m)}, ${fmtFecha(m.fecha)})? Quedará registrado en el historial.`,
      textoOk: 'Eliminar', peligro: true,
    });
    if (!ok) return;
    try {
      await eliminarPartido(liga, m.id, ctx.actor);
      toast('Resultado eliminado.');
    } catch (ex) {
      toast(mensajeError(ex), 'error');
    }
  }));
}
