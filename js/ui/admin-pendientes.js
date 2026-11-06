// Inscripciones y propuestas de resultados enviadas por jugadores, pendientes de aprobación.

import { h, $, $$, fmtFecha, fmtFechaHora, nombreJugador } from '../util.js';
import { abrirDialogo, confirmar, pedirTexto, toast } from './components.js';
import { formularioPartido } from './partido-form.js';
import { aprobarPropuesta, rechazarPropuesta, aprobarInscripcion, rechazarInscripcion } from '../store.js';
import { mensajeError } from '../db.js';
import { prepararPartido, validarNombreJugador } from '../core/model.js';
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

function renderInscripciones(contenedor, ctx) {
  const { liga, inscripciones, actor } = ctx;
  if (!inscripciones.length) { contenedor.innerHTML = ''; return; }
  contenedor.innerHTML = String(h`
    <div class="seccion__cabecera"><h2>Inscripciones</h2><span class="seccion__sub">${inscripciones.length === 1 ? '1 jugador espera confirmación' : `${inscripciones.length} jugadores esperan confirmación`}</span></div>
    <div class="pila" style="margin-bottom:28px">
      ${inscripciones.map((i) => {
        const v = validarNombreJugador(i.nombre, liga.jugadores);
        return h`
        <article class="tarjeta propuesta ${v.ok ? '' : 'propuesta--invalida'}" data-insc="${i.id}">
          <div class="propuesta__cab">
            <strong>${i.nombre}</strong>
            <span class="texto-suave">${i.creadoEn ? h`enviada ${fmtFechaHora(i.creadoEn)}` : ''}</span>
          </div>
          ${i.contacto ? h`<div>Contacto: <span class="mono">${i.contacto}</span></div>` : h`<div class="texto-suave">Sin contacto</div>`}
          ${i.mensaje ? h`<div class="texto-suave" style="margin-top:4px">“${i.mensaje}”</div>` : ''}
          ${v.ok ? '' : h`<div class="aviso aviso--error" style="margin:8px 0">${v.motivo} Usa "Editar nombre y aprobar".</div>`}
          <div class="acciones" style="margin-top:10px">
            <button type="button" class="btn btn--verde btn--sm" data-aprobar ${v.ok ? '' : 'disabled'}>Aprobar</button>
            <button type="button" class="btn btn--sec btn--sm" data-editar>Editar nombre y aprobar</button>
            <button type="button" class="btn btn--peligro btn--sm" data-rechazar>Rechazar</button>
          </div>
        </article>`;
      })}
    </div>
  `);
  $$('[data-insc]', contenedor).forEach((card) => {
    const i = inscripciones.find((x) => x.id === card.dataset.insc);
    $('[data-aprobar]', card).addEventListener('click', async (e) => {
      e.currentTarget.disabled = true;
      try {
        await aprobarInscripcion(liga, i, i.nombre, actor);
        toast(`${i.nombre} agregado a la liga.`, 'ok');
      } catch (ex) {
        toast(mensajeError(ex), 'error');
        e.currentTarget.disabled = false;
      }
    });
    $('[data-editar]', card).addEventListener('click', async () => {
      const nuevo = await pedirTexto({ titulo: 'Aprobar inscripción', etiqueta: 'Nombre con el que aparecerá en la tabla', valor: i.nombre, textoOk: 'Aprobar' });
      if (nuevo === null) return;
      try {
        await aprobarInscripcion(liga, i, nuevo, actor);
        toast(`${nuevo.trim()} agregado a la liga.`, 'ok');
      } catch (ex) {
        toast(mensajeError(ex), 'error');
      }
    });
    $('[data-rechazar]', card).addEventListener('click', async () => {
      const motivo = await pedirTexto({ titulo: 'Rechazar inscripción', etiqueta: 'Motivo (opcional, lo verá quien la envió)', textoOk: 'Rechazar', placeholder: 'Ej.: la liga ya está completa' });
      if (motivo === null) return;
      try {
        await rechazarInscripcion(i, motivo, actor);
        toast('Inscripción rechazada.');
      } catch (ex) {
        toast(mensajeError(ex), 'error');
      }
    });
  });
}

export function renderPendientes(contenedor, ctx) {
  const { liga, propuestas, actor } = ctx;
  const inscripciones = ctx.inscripciones || [];
  contenedor.innerHTML = '<div data-inscripciones></div><div data-propuestas></div>';
  renderInscripciones($('[data-inscripciones]', contenedor), { ...ctx, inscripciones });
  contenedor = $('[data-propuestas]', contenedor);
  if (!propuestas.length) {
    contenedor.innerHTML = String(h`<div class="vacio"><h3>Sin ${inscripciones.length ? 'resultados' : 'propuestas'} pendientes</h3><p>Cuando un jugador se inscriba o cargue un resultado aparecerá aquí para que lo apruebes.</p></div>`);
    return;
  }
  contenedor.innerHTML = String(h`
    ${inscripciones.length ? h`<div class="seccion__cabecera"><h2>Resultados</h2></div>` : ''}
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
