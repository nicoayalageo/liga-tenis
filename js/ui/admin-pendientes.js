// Propuestas de resultados enviadas por jugadores, pendientes de aprobación.

import { h, $, $$, fmtFecha, fmtFechaHora, nombreJugador } from '../util.js';
import { abrirDialogo, confirmar, pedirTexto, toast } from './components.js';
import { formularioPartido } from './partido-form.js';
import { aprobarPropuesta, rechazarPropuesta } from '../store.js';
import { mensajeError } from '../db.js';
import { prepararPartido } from '../core/model.js';
import { canAddMatch, crucesPlayoffsAbiertos } from '../core/fixtures.js';
import { formatScore } from '../core/scoring.js';

function evaluar(liga, p) {
  const prep = prepararPartido(p, liga.config);
  if (!prep.ok) return { ok: false, motivo: prep.errores[0] };
  if (p.fase === 'playoffs') {
    const ok = crucesPlayoffsAbiertos(liga).some((c) => c.id === p.llaveId);
    return ok ? { ok: true } : { ok: false, motivo: 'El cruce de playoffs ya no está disponible.' };
  }
  const c = canAddMatch(liga, p.jugador1, p.jugador2);
  return c.ok ? { ok: true } : { ok: false, motivo: c.motivo };
}

export function renderPendientes(contenedor, ctx) {
  const { liga, propuestas, actor } = ctx;
  if (!propuestas.length) {
    contenedor.innerHTML = String(h`<div class="vacio"><h3>Sin propuestas pendientes</h3><p>Cuando un jugador cargue un resultado aparecerá aquí para que lo apruebes.</p></div>`);
    return;
  }
  contenedor.innerHTML = String(h`
    <div class="pila">
      ${propuestas.map((p) => {
        const ev = evaluar(liga, p);
        return h`
        <article class="tarjeta propuesta ${ev.ok ? '' : 'propuesta--invalida'}" data-id="${p.id}">
          <div class="propuesta__cab">
            <strong>${nombreJugador(liga, p.jugador1)} vs ${nombreJugador(liga, p.jugador2)}</strong>
            <span class="texto-suave">${fmtFecha(p.fecha)} · enviado por ${nombreJugador(liga, p.enviadoComo)} ${p.creadoEn ? h`(${fmtFechaHora(p.creadoEn)})` : ''}</span>
          </div>
          <div class="propuesta__marcador mono">${formatScore(p)} ${p.ganador ? h`<span class="chip chip--arcilla">Gana ${nombreJugador(liga, p.ganador)}</span>` : ''}</div>
          ${p.fase === 'playoffs' ? h`<span class="chip chip--ocre">Playoffs</span>` : ''}
          ${ev.ok ? '' : h`<div class="aviso aviso--error" style="margin:8px 0">${ev.motivo}</div>`}
          <div class="acciones" style="margin-top:10px">
            <button type="button" class="btn btn--verde btn--sm" data-aprobar ${ev.ok ? '' : 'disabled'}>Aprobar</button>
            <button type="button" class="btn btn--sec btn--sm" data-editar>Editar y aprobar</button>
            <button type="button" class="btn btn--peligro btn--sm" data-rechazar>Rechazar</button>
          </div>
        </article>`;
      })}
    </div>
  `);

  $$('[data-id]', contenedor).forEach((card) => {
    const p = propuestas.find((x) => x.id === card.dataset.id);
    $('[data-aprobar]', card).addEventListener('click', async (e) => {
      e.currentTarget.disabled = true;
      try {
        await aprobarPropuesta(liga, p, p, actor);
        toast('Resultado aprobado y publicado.', 'ok');
      } catch (ex) {
        toast(mensajeError(ex), 'error');
        e.currentTarget.disabled = false;
      }
    });
    $('[data-rechazar]', card).addEventListener('click', async () => {
      const motivo = await pedirTexto({ titulo: 'Rechazar propuesta', etiqueta: 'Motivo (opcional, lo verá quien la envió)', textoOk: 'Rechazar', placeholder: 'Ej.: el marcador no coincide' });
      if (motivo === null) return;
      try {
        await rechazarPropuesta(liga, p, motivo, actor);
        toast('Propuesta rechazada.');
      } catch (ex) {
        toast(mensajeError(ex), 'error');
      }
    });
    $('[data-editar]', card).addEventListener('click', () => {
      let form = null;
      const dlg = abrirDialogo({
        titulo: 'Editar y aprobar',
        ancho: 'min(640px, calc(100vw - 32px))',
        cuerpo: '<div data-form></div><div class="aviso aviso--error" data-error hidden></div>',
        botones: [
          { texto: 'Cancelar', clase: 'btn--sec' },
          {
            texto: 'Aprobar con estos datos', clase: 'btn--verde',
            accion: async (d) => {
              const err = $('[data-error]', d);
              const v = form.validar();
              if (!v.ok) { err.textContent = v.errores[0]; err.hidden = false; return false; }
              try {
                await aprobarPropuesta(liga, p, form.leer(), actor);
                toast('Resultado aprobado y publicado.', 'ok');
                return true;
              } catch (ex) {
                err.textContent = mensajeError(ex); err.hidden = false; return false;
              }
            },
          },
        ],
      });
      form = formularioPartido($('[data-form]', dlg), { liga, modo: 'admin', datos: { ...p, id: null }, fase: p.fase });
    });
  });
}
