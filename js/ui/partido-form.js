// Formulario de partido compartido por la administración y el envío de jugadores.

import { h, raw, $, $$, nombreJugador } from '../util.js';
import { editorSets } from './components.js';
import { prepararPartido, hoyLocal } from '../core/model.js';
import { canAddMatch, crucesPlayoffsAbiertos } from '../core/fixtures.js';
import { FORMATOS_PARTIDO } from '../core/formats.js';

/**
 * Construye el formulario dentro de `contenedor`.
 * opciones: { liga, modo: 'admin'|'jugador', datos (para editar), fijarJugador1, excluirId, permitirPlayoffs }
 * Devuelve { leer(), validar(), onChange(fn), destruir() }.
 */
export function formularioPartido(contenedor, opciones) {
  const { liga, modo = 'admin', datos = null, excluirId = null } = opciones;
  const config = liga.config;
  const activos = (liga.jugadores || []).filter((j) => j.activo !== false);
  const todos = liga.jugadores || [];
  const hayPlayoffs = Boolean(liga.playoffs) && config.formatoLiga.endsWith('_playoffs');
  const abiertos = hayPlayoffs ? crucesPlayoffsAbiertos({ ...liga, partidos: (liga.partidos || []).filter((m) => m.id !== excluirId) }) : [];
  const editando = Boolean(datos && datos.id);
  const faseInicial = datos ? datos.fase || 'liga' : (opciones.fase || 'liga');
  let cb = () => {};

  const listaJugadores = editando ? todos : activos;
  const opcionesJugador = (sel, excluir) => listaJugadores
    .filter((j) => j.id !== excluir)
    .map((j) => h`<option value="${j.id}" ${sel === j.id ? 'selected' : ''}>${j.nombre}${j.activo === false ? ' (retirado)' : ''}</option>`);

  contenedor.innerHTML = String(h`
    ${hayPlayoffs && modo === 'admin' && !editando ? h`
      <div class="campo">
        <span class="etiqueta">Fase</span>
        <div class="segmentos">
          <label><input type="radio" name="fase" value="liga" ${faseInicial === 'liga' ? 'checked' : ''}> Liga</label>
          <label><input type="radio" name="fase" value="playoffs" ${faseInicial === 'playoffs' ? 'checked' : ''}> Playoffs</label>
        </div>
      </div>` : ''}
    <div data-bloque="llave" class="campo" hidden>
      <label for="pf-llave">Cruce de playoffs</label>
      <select id="pf-llave">
        ${abiertos.length ? abiertos.map((c) => h`<option value="${c.id}" ${datos && datos.llaveId === c.id ? 'selected' : ''}>${c.nombreRonda}: ${nombreJugador(liga, c.jugador1)} vs ${nombreJugador(liga, c.jugador2)}</option>`) : h`<option value="">No hay cruces disponibles</option>`}
      </select>
    </div>
    <div class="fila" data-bloque="jugadores">
      <div class="campo">
        <label for="pf-j1">${modo === 'jugador' ? 'Soy' : 'Jugador 1'}</label>
        <select id="pf-j1" ${opciones.fijarJugador1 ? 'disabled' : ''}>
          <option value="">Elegir…</option>
          ${opcionesJugador(datos ? datos.jugador1 : opciones.fijarJugador1 || '', null)}
        </select>
      </div>
      <div class="campo">
        <label for="pf-j2">${modo === 'jugador' ? 'Jugué contra' : 'Jugador 2'}</label>
        <select id="pf-j2">
          <option value="">Elegir…</option>
          ${opcionesJugador(datos ? datos.jugador2 : '', null)}
        </select>
        <span class="ayuda" data-ayuda-rival></span>
      </div>
    </div>
    <div class="fila">
      <div class="campo">
        <label for="pf-fecha">Fecha del partido</label>
        <input id="pf-fecha" type="date" value="${datos ? datos.fecha : hoyLocal()}" max="${hoyLocal()}">
      </div>
      <div class="campo">
        <span class="etiqueta">Estado</span>
        <div class="segmentos">
          <label><input type="radio" name="estado" value="completo" ${!datos || datos.estado === 'completo' ? 'checked' : ''}> Completo</label>
          <label><input type="radio" name="estado" value="retiro" ${datos && datos.estado === 'retiro' ? 'checked' : ''}> Retiro</label>
          <label><input type="radio" name="estado" value="wo" ${datos && datos.estado === 'wo' ? 'checked' : ''}> W.O.</label>
        </div>
      </div>
    </div>
    ${modo === 'admin' ? h`
      <div class="campo">
        <label for="pf-formato">Formato del partido</label>
        <select id="pf-formato">
          ${Object.entries(FORMATOS_PARTIDO).map(([id, f]) => h`<option value="${id}" ${(datos ? datos.formatoPartido : config.formatoPartido) === id ? 'selected' : ''}>${f.label}</option>`)}
        </select>
        <span class="ayuda">Por defecto, el formato configurado en la liga.</span>
      </div>` : ''}
    <div class="campo">
      <span class="etiqueta">Marcador</span>
      <div data-sets></div>
    </div>
    <div class="campo" data-bloque="ganador" hidden>
      <label for="pf-ganador">¿Quién gana?</label>
      <select id="pf-ganador"><option value="">Elegir…</option></select>
    </div>
    ${modo === 'admin' ? h`
      <div class="campo">
        <label for="pf-nota">Nota (opcional)</label>
        <input id="pf-nota" type="text" maxlength="200" value="${datos ? datos.nota || '' : ''}" placeholder="Cancha, hora, comentario…">
      </div>` : ''}
    <div class="previa previa--neutro" data-previa>Completa el marcador para ver el resultado.</div>
  `);

  const selJ1 = $('#pf-j1', contenedor);
  const selJ2 = $('#pf-j2', contenedor);
  const selLlave = $('#pf-llave', contenedor);
  const fecha = $('#pf-fecha', contenedor);
  const selFormato = $('#pf-formato', contenedor);
  const selGanador = $('#pf-ganador', contenedor);
  const previa = $('[data-previa]', contenedor);
  const ayudaRival = $('[data-ayuda-rival]', contenedor);

  const faseActual = () => {
    const r = $('input[name="fase"]:checked', contenedor);
    return r ? r.value : faseInicial;
  };
  const estadoActual = () => $('input[name="estado"]:checked', contenedor).value;
  const formatoActual = () => (selFormato ? selFormato.value : (datos ? datos.formatoPartido : config.formatoPartido));

  const nombres = () => [nombreJugador(liga, jugadores()[0]) || 'Jugador 1', nombreJugador(liga, jugadores()[1]) || 'Jugador 2']
    .map((n) => (n === '—' ? '…' : n));

  function jugadores() {
    if (faseActual() === 'playoffs') {
      const c = abiertos.find((x) => x.id === selLlave.value);
      if (editando && datos) return [datos.jugador1, datos.jugador2];
      return c ? [c.jugador1, c.jugador2] : ['', ''];
    }
    return [selJ1.value, selJ2.value];
  }

  const sets = editorSets($('[data-sets]', contenedor), {
    formatoId: formatoActual(),
    nombres: nombres(),
    sets: datos ? datos.sets : [],
    estado: datos ? datos.estado : 'completo',
  });

  function actualizarRivales() {
    if (faseActual() === 'playoffs') return;
    const j1 = selJ1.value;
    const actual = selJ2.value;
    const html = [String(h`<option value="">Elegir…</option>`)];
    for (const j of listaJugadores) {
      if (j.id === j1) continue;
      const c = j1 ? canAddMatch(liga, j1, j.id, { excluirId, permitirInactivos: editando }) : { ok: true };
      html.push(String(h`<option value="${j.id}" ${actual === j.id ? 'selected' : ''} ${c.ok ? '' : 'disabled'}>${j.nombre}${c.ok ? '' : ' · ya jugaron'}</option>`));
    }
    selJ2.innerHTML = html.join('');
    if (selJ2.value !== actual) selJ2.value = '';
    ayudaRival.textContent = j1 && Number.isFinite(reunionesPermitidas()) ? 'Los rivales con los que ya se completaron los cruces aparecen deshabilitados.' : '';
  }

  function reunionesPermitidas() {
    const f = config.formatoLiga;
    return f === 'libre' ? Infinity : (f.startsWith('rr2') ? 2 : 1);
  }

  function actualizarGanador() {
    const estado = estadoActual();
    const bloque = $('[data-bloque="ganador"]', contenedor);
    bloque.hidden = estado === 'completo';
    const [a, b] = jugadores();
    const previo = selGanador.value || (datos ? datos.ganador : '');
    selGanador.innerHTML = String(h`<option value="">Elegir…</option>${[a, b].filter(Boolean).map((id) => h`<option value="${id}" ${previo === id ? 'selected' : ''}>${nombreJugador(liga, id)}</option>`)}`);
  }

  function actualizarFase() {
    const po = faseActual() === 'playoffs';
    $('[data-bloque="llave"]', contenedor).hidden = !po;
    $('[data-bloque="jugadores"]', contenedor).hidden = po;
    sets.setNombres(nombres());
    actualizarGanador();
  }

  function leer() {
    const [jugador1, jugador2] = jugadores();
    return {
      fase: faseActual(),
      llaveId: faseActual() === 'playoffs' ? (editando ? datos.llaveId : selLlave.value) : null,
      jugador1, jugador2,
      fecha: fecha.value,
      estado: estadoActual(),
      formatoPartido: formatoActual(),
      sets: sets.leer(),
      ganador: estadoActual() === 'completo' ? null : selGanador.value,
      nota: $('#pf-nota', contenedor) ? $('#pf-nota', contenedor).value : '',
    };
  }

  function validar() {
    const d = leer();
    const prep = prepararPartido(d, config);
    if (prep.ok) {
      const c = d.fase === 'playoffs'
        ? (editando || abiertos.some((x) => x.id === d.llaveId) ? { ok: true } : { ok: false, motivo: 'Elige un cruce de playoffs.' })
        : canAddMatch(liga, d.jugador1, d.jugador2, { excluirId, permitirInactivos: editando });
      if (!c.ok) { prep.ok = false; prep.errores.unshift(c.motivo); }
    }
    return prep;
  }

  function pintarPrevia() {
    const v = validar();
    previa.className = 'previa';
    if (v.ok) {
      const p = v.partido;
      const sg = v.validacion.setsGanados;
      const g = nombreJugador(liga, p.ganador);
      const detalle = p.estado === 'wo' ? 'por W.O.' : p.estado === 'retiro' ? `por retiro (${sg[0]}–${sg[1]} en sets)` : `${p.ganador === p.jugador1 ? sg[0] : sg[1]}–${p.ganador === p.jugador1 ? sg[1] : sg[0]} en sets`;
      previa.classList.add('previa--ok');
      previa.textContent = `Gana ${g} ${detalle}.`;
    } else {
      const vacio = !v.partido.jugador1 || !v.partido.jugador2 || (v.partido.estado !== 'wo' && v.partido.sets.length === 0);
      previa.classList.add(vacio ? 'previa--neutro' : 'previa--error');
      previa.textContent = vacio ? 'Completa jugadores y marcador para ver el resultado.' : v.errores[0];
    }
    cb(v);
  }

  selJ1.addEventListener('change', () => { actualizarRivales(); sets.setNombres(nombres()); actualizarGanador(); pintarPrevia(); });
  selJ2.addEventListener('change', () => { sets.setNombres(nombres()); actualizarGanador(); pintarPrevia(); });
  if (selLlave) selLlave.addEventListener('change', () => { sets.setNombres(nombres()); actualizarGanador(); pintarPrevia(); });
  fecha.addEventListener('change', pintarPrevia);
  $$('input[name="estado"]', contenedor).forEach((r) => r.addEventListener('change', () => { sets.setEstado(estadoActual()); actualizarGanador(); pintarPrevia(); }));
  $$('input[name="fase"]', contenedor).forEach((r) => r.addEventListener('change', () => { actualizarFase(); pintarPrevia(); }));
  if (selFormato) selFormato.addEventListener('change', () => { sets.setFormato(selFormato.value); pintarPrevia(); });
  sets.onChange(pintarPrevia);

  actualizarRivales();
  if (datos) selJ2.value = datos.jugador2;
  actualizarFase();
  pintarPrevia();

  return {
    leer,
    validar,
    onChange(fn) { cb = fn; },
    enfocar() { (opciones.fijarJugador1 ? selJ2 : selJ1).focus(); },
  };
}
