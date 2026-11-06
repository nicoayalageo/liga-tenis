// Configuración de la liga: formato, puntos, desempate, calendario, playoffs y PIN.

import { h, $, $$ } from '../util.js';
import { confirmar, toast } from './components.js';
import { FORMATOS_LIGA, FORMATOS_PARTIDO, CRITERIOS_DESEMPATE, PRESETS_DESEMPATE, H2H_MODOS } from '../core/formats.js';
import { guardarConfig, guardarPin, generarCalendario, borrarCalendario, generarLlavePlayoffs, borrarLlavePlayoffs } from '../store.js';
import { mensajeError } from '../db.js';
import { validateLiga, normalizarConfig } from '../core/model.js';
import { pendientes } from '../core/fixtures.js';

export function renderConfig(contenedor, ctx) {
  const { liga, actor, acceso } = ctx;
  const c = liga.config;
  let criterios = [...c.desempate];
  const hayPartidos = (liga.partidos || []).length > 0;
  const hayPlayoffsPartidos = (liga.partidos || []).some((m) => m.fase === 'playoffs');
  const activos = (liga.jugadores || []).filter((j) => j.activo !== false).length;
  const pend = pendientes(liga).length;

  contenedor.innerHTML = String(h`
    <form data-form class="pila" novalidate>
      <section class="tarjeta conf-seccion">
        <h3>Identidad</h3>
        <div class="fila">
          <div class="campo"><label for="cf-nombre">Nombre de la liga</label><input id="cf-nombre" type="text" maxlength="80" value="${c.nombre}" required></div>
          <div class="campo"><label for="cf-temporada">Temporada</label><input id="cf-temporada" type="text" maxlength="40" value="${c.temporada}" placeholder="2026"></div>
        </div>
        <div class="campo"><label for="cf-lema">Lema (opcional)</label><input id="cf-lema" type="text" maxlength="120" value="${c.lema || ''}"></div>
      </section>

      <section class="tarjeta conf-seccion">
        <h3>Formato de la liga</h3>
        ${hayPartidos ? h`<p class="aviso aviso--aviso" style="margin-bottom:10px">Ya hay partidos registrados. Si cambias a un formato con menos enfrentamientos permitidos, se verificará que ningún par los supere.</p>` : ''}
        <div class="tarjetas-opcion">
          ${Object.entries(FORMATOS_LIGA).map(([id, f]) => h`<label class="opcion"><input type="radio" name="formatoLiga" value="${id}" ${c.formatoLiga === id ? 'checked' : ''}><strong>${f.label}</strong><small>${f.desc}</small></label>`)}
        </div>
      </section>

      <section class="tarjeta conf-seccion">
        <h3>Formato de los partidos</h3>
        <p class="texto-suave" style="font-size:0.9rem">Cada partido guarda el formato con el que se ingresó; cambiarlo no altera los anteriores.</p>
        <div class="tarjetas-opcion">
          ${Object.entries(FORMATOS_PARTIDO).map(([id, f]) => h`<label class="opcion"><input type="radio" name="formatoPartido" value="${id}" ${c.formatoPartido === id ? 'checked' : ''}><strong>${f.label}</strong><small>${f.desc}</small></label>`)}
        </div>
      </section>

      <section class="tarjeta conf-seccion">
        <h3>Puntos</h3>
        <div class="fila">
          <div class="campo"><label for="cf-pv">Puntos por victoria</label><input id="cf-pv" type="number" min="0" max="10" step="1" value="${c.puntosVictoria}"></div>
          <div class="campo"><label for="cf-pd">Puntos por derrota</label><input id="cf-pd" type="number" min="-5" max="10" step="1" value="${c.puntosDerrota}"></div>
          <div class="campo"><label for="cf-pw">Puntos por perder por W.O.</label><input id="cf-pw" type="number" min="-5" max="10" step="1" value="${c.puntosDerrotaWO}"><span class="ayuda">Quien no se presenta. Puede ser negativo.</span></div>
        </div>
        <div class="campo"><label><input type="checkbox" id="cf-exwo" ${c.excluirWOdeSetsGames ? 'checked' : ''}> Los W.O. no cuentan para el % de sets ni de games</label></div>
        <div class="campo"><label><input type="checkbox" id="cf-stb" ${c.superTiebreakCuentaGames ? 'checked' : ''}> Los puntos del super tiebreak se suman como games</label></div>
      </section>

      <section class="tarjeta conf-seccion">
        <h3>Desempate</h3>
        <div class="campo">
          <label for="cf-preset">Elegir un reglamento conocido</label>
          <select id="cf-preset">
            <option value="">Personalizado</option>
            ${Object.entries(PRESETS_DESEMPATE).map(([id, p]) => h`<option value="${id}">${p.label}</option>`)}
          </select>
          <span class="ayuda" data-preset-desc></span>
        </div>
        <div class="fila">
          <div class="campo">
            <span class="etiqueta">Criterios en orden</span>
            <ul class="lista-orden" data-criterios></ul>
            <span class="ayuda">Si un criterio no separa a los empatados se pasa al siguiente. Cuando un grupo se separa parcialmente, los que siguen empatados vuelven a evaluarse desde el primero. Sin criterios restantes, comparten posición.</span>
          </div>
          <div class="campo">
            <label for="cf-agregar">Agregar criterio</label>
            <select id="cf-agregar"><option value="">Elegir…</option></select>
            <label for="cf-h2h" style="margin-top:10px">Enfrentamiento directo con 3 o más empatados</label>
            <select id="cf-h2h">${Object.entries(H2H_MODOS).map(([id, m]) => h`<option value="${id}" ${c.h2hModo === id ? 'selected' : ''}>${m.label}</option>`)}</select>
          </div>
        </div>
      </section>

      <section class="tarjeta conf-seccion" data-bloque-playoffs>
        <h3>Playoffs</h3>
        <div class="fila">
          <div class="campo"><label for="cf-clas">Clasificados</label><select id="cf-clas">${[2, 4, 8, 16].map((n) => h`<option value="${n}" ${c.playoffs.clasificados === n ? 'selected' : ''}>${n}</option>`)}</select></div>
          <div class="campo"><label style="margin-top:28px"><input type="checkbox" id="cf-3p" ${c.playoffs.tercerPuesto ? 'checked' : ''}> Partido por el tercer puesto</label></div>
        </div>
      </section>

      <div class="acciones">
        <button type="submit" class="btn">Guardar configuración</button>
        <span class="texto-suave" data-estado></span>
      </div>
    </form>

    <section class="tarjeta conf-seccion" style="margin-top:18px">
      <h3>Calendario</h3>
      <p class="texto-suave">${c.calendario ? h`Calendario vigente con ${c.calendario.jornadas.length} jornadas (${c.calendario.jugadores.length} jugadores). Faltan ${pend} partidos.` : 'Aún no hay calendario. Se genera con los jugadores activos.'}</p>
      <div class="acciones">
        <button type="button" class="btn btn--verde" data-generar-cal ${activos < 2 || !c.formatoLiga.startsWith('rr') ? 'disabled' : ''}>${c.calendario ? 'Regenerar calendario' : 'Generar calendario'}</button>
        ${c.calendario ? h`<button type="button" class="btn btn--peligro" data-borrar-cal>Quitar calendario</button>` : ''}
        ${!c.formatoLiga.startsWith('rr') ? h`<span class="texto-suave">El formato libre no usa calendario.</span>` : ''}
      </div>
    </section>

    ${c.formatoLiga.endsWith('_playoffs') ? h`
    <section class="tarjeta conf-seccion">
      <h3>Llave de playoffs</h3>
      <p class="texto-suave">${liga.playoffs ? h`Llave generada con ${liga.playoffs.clasificados} clasificados.` : 'Se genera con la tabla actual cuando termine la fase regular.'}</p>
      <div class="acciones">
        ${!liga.playoffs ? h`<button type="button" class="btn btn--verde" data-generar-po>Generar llave</button>` : h`<button type="button" class="btn btn--peligro" data-borrar-po ${hayPlayoffsPartidos ? 'disabled title="Hay partidos de playoffs registrados"' : ''}>Quitar llave</button>`}
      </div>
    </section>` : ''}

    <section class="tarjeta conf-seccion">
      <h3>PIN para los jugadores</h3>
      <p class="texto-suave">Los jugadores lo escriben al inscribirse y al cargar un resultado. Compártelo solo con los participantes. ${acceso && acceso.pin ? h`PIN actual: <strong class="mono">${acceso.pin}</strong>` : h`<strong>Todavía no hay PIN: nadie puede enviar resultados.</strong>`}</p>
      <form class="inline-form" data-pin>
        <label for="cf-pin" class="visually-hidden">Nuevo PIN</label>
        <input id="cf-pin" class="entrada" type="text" minlength="4" maxlength="20" placeholder="Nuevo PIN (4 a 20 caracteres)" autocomplete="off">
        <button type="submit" class="btn btn--sec">Guardar PIN</button>
      </form>
    </section>
  `);

  // ----- desempate -----
  const lista = $('[data-criterios]', contenedor);
  const selAgregar = $('#cf-agregar', contenedor);
  const selPreset = $('#cf-preset', contenedor);
  const descPreset = $('[data-preset-desc]', contenedor);

  function pintarCriterios() {
    lista.innerHTML = criterios.length === 0
      ? String(h`<li class="texto-suave">Sin criterios: los empates comparten posición.</li>`)
      : criterios.map((id, i) => String(h`
        <li>
          <span class="num">${i + 1}</span>
          <span class="texto">${CRITERIOS_DESEMPATE[id].label}<small>${CRITERIOS_DESEMPATE[id].desc}</small></span>
          <button type="button" class="btn btn--fantasma btn--sm" data-subir="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Subir">▲</button>
          <button type="button" class="btn btn--fantasma btn--sm" data-bajar="${i}" ${i === criterios.length - 1 ? 'disabled' : ''} aria-label="Bajar">▼</button>
          <button type="button" class="btn btn--fantasma btn--sm" data-quitar="${i}" aria-label="Quitar">✕</button>
        </li>`)).join('');
    selAgregar.innerHTML = String(h`<option value="">Elegir…</option>${Object.entries(CRITERIOS_DESEMPATE).filter(([id]) => !criterios.includes(id)).map(([id, cr]) => h`<option value="${id}">${cr.label}</option>`)}`);
    const presetActual = Object.entries(PRESETS_DESEMPATE).find(([, p]) => p.criterios.join() === criterios.join() && p.h2hModo === $('#cf-h2h', contenedor).value);
    selPreset.value = presetActual ? presetActual[0] : '';
    descPreset.textContent = presetActual ? PRESETS_DESEMPATE[presetActual[0]].desc : 'Orden personalizado.';
    $$('[data-subir]', lista).forEach((b) => b.addEventListener('click', () => { const i = Number(b.dataset.subir); [criterios[i - 1], criterios[i]] = [criterios[i], criterios[i - 1]]; pintarCriterios(); }));
    $$('[data-bajar]', lista).forEach((b) => b.addEventListener('click', () => { const i = Number(b.dataset.bajar); [criterios[i + 1], criterios[i]] = [criterios[i], criterios[i + 1]]; pintarCriterios(); }));
    $$('[data-quitar]', lista).forEach((b) => b.addEventListener('click', () => { criterios.splice(Number(b.dataset.quitar), 1); pintarCriterios(); }));
  }
  selAgregar.addEventListener('change', () => { if (selAgregar.value) { criterios.push(selAgregar.value); pintarCriterios(); } });
  selPreset.addEventListener('change', () => {
    const p = PRESETS_DESEMPATE[selPreset.value];
    if (p) { criterios = [...p.criterios]; $('#cf-h2h', contenedor).value = p.h2hModo; }
    pintarCriterios();
  });
  $('#cf-h2h', contenedor).addEventListener('change', pintarCriterios);
  pintarCriterios();

  const bloquePlayoffs = $('[data-bloque-playoffs]', contenedor);
  const refrescarPlayoffs = () => { bloquePlayoffs.hidden = !$('input[name="formatoLiga"]:checked', contenedor).value.endsWith('_playoffs'); };
  $$('input[name="formatoLiga"]', contenedor).forEach((r) => r.addEventListener('change', refrescarPlayoffs));
  refrescarPlayoffs();

  // ----- guardar -----
  $('[data-form]', contenedor).addEventListener('submit', async (e) => {
    e.preventDefault();
    const cambios = {
      nombre: $('#cf-nombre', contenedor).value,
      temporada: $('#cf-temporada', contenedor).value,
      lema: $('#cf-lema', contenedor).value,
      formatoLiga: $('input[name="formatoLiga"]:checked', contenedor).value,
      formatoPartido: $('input[name="formatoPartido"]:checked', contenedor).value,
      puntosVictoria: Number($('#cf-pv', contenedor).value),
      puntosDerrota: Number($('#cf-pd', contenedor).value),
      puntosDerrotaWO: Number($('#cf-pw', contenedor).value),
      excluirWOdeSetsGames: $('#cf-exwo', contenedor).checked,
      superTiebreakCuentaGames: $('#cf-stb', contenedor).checked,
      desempate: criterios,
      h2hModo: $('#cf-h2h', contenedor).value,
      playoffs: { clasificados: Number($('#cf-clas', contenedor).value), tercerPuesto: $('#cf-3p', contenedor).checked },
    };
    if (!cambios.nombre.trim()) { toast('La liga necesita un nombre.', 'error'); return; }
    const nueva = normalizarConfig({ ...c, ...cambios });
    const errores = validateLiga({ ...liga, config: nueva });
    const graves = errores.filter((x) => /permite/.test(x));
    if (graves.length) { toast(graves[0], 'error', 6000); return; }
    if (nueva.formatoLiga !== c.formatoLiga && c.calendario && !nueva.formatoLiga.startsWith('rr')) {
      const ok = await confirmar({ titulo: 'Cambiar a liga libre', mensaje: 'El calendario actual dejará de usarse. ¿Continuar?', textoOk: 'Cambiar' });
      if (!ok) return;
      cambios.calendario = null;
    }
    const estado = $('[data-estado]', contenedor);
    estado.textContent = 'Guardando…';
    try {
      await guardarConfig(liga, cambios, actor);
      toast('Configuración guardada.', 'ok');
      estado.textContent = '';
    } catch (ex) {
      estado.textContent = '';
      toast(mensajeError(ex), 'error');
    }
  });

  // ----- calendario -----
  const btnCal = $('[data-generar-cal]', contenedor);
  if (btnCal) btnCal.addEventListener('click', async () => {
    if (c.calendario) {
      const ok = await confirmar({ titulo: 'Regenerar calendario', mensaje: 'Se armarán jornadas nuevas con los jugadores activos. Los partidos ya jugados se conservan y se descuentan de los cruces. ¿Continuar?', textoOk: 'Regenerar' });
      if (!ok) return;
    }
    try { await generarCalendario(liga, actor); toast('Calendario generado.', 'ok'); } catch (ex) { toast(mensajeError(ex), 'error'); }
  });
  const btnBorrarCal = $('[data-borrar-cal]', contenedor);
  if (btnBorrarCal) btnBorrarCal.addEventListener('click', async () => {
    const ok = await confirmar({ titulo: 'Quitar calendario', mensaje: 'La sección Calendario dejará de mostrarse. Los partidos no se tocan. ¿Continuar?', textoOk: 'Quitar', peligro: true });
    if (!ok) return;
    try { await borrarCalendario(actor); toast('Calendario eliminado.'); } catch (ex) { toast(mensajeError(ex), 'error'); }
  });

  // ----- playoffs -----
  const btnPo = $('[data-generar-po]', contenedor);
  if (btnPo) btnPo.addEventListener('click', async () => {
    if (pend > 0) {
      const ok = await confirmar({ titulo: 'Fase regular incompleta', mensaje: `Aún faltan ${pend} partidos de la fase regular. La llave se armará con la tabla actual. ¿Generar igual?`, textoOk: 'Generar' });
      if (!ok) return;
    }
    try { await generarLlavePlayoffs(liga, actor); toast('Llave generada.', 'ok'); } catch (ex) { toast(mensajeError(ex), 'error'); }
  });
  const btnBorrarPo = $('[data-borrar-po]', contenedor);
  if (btnBorrarPo) btnBorrarPo.addEventListener('click', async () => {
    const ok = await confirmar({ titulo: 'Quitar llave', mensaje: '¿Eliminar la llave de playoffs?', textoOk: 'Quitar', peligro: true });
    if (!ok) return;
    try { await borrarLlavePlayoffs(liga, actor); toast('Llave eliminada.'); } catch (ex) { toast(mensajeError(ex), 'error'); }
  });

  // ----- PIN -----
  $('[data-pin]', contenedor).addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('#cf-pin', contenedor);
    try { await guardarPin(input.value, actor); toast('PIN actualizado.', 'ok'); input.value = ''; } catch (ex) { toast(mensajeError(ex), 'error'); }
  });
}
