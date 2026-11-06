// Componentes de interfaz reutilizables: toasts, diálogos, pestañas y editor de sets.

import { h, raw, $, $$ } from '../util.js';
import { FORMATOS_PARTIDO } from '../core/formats.js';

let contenedorToasts = null;

export function toast(mensaje, tipo = 'info', ms = 3200) {
  if (!contenedorToasts) {
    contenedorToasts = document.createElement('div');
    contenedorToasts.className = 'toasts';
    contenedorToasts.setAttribute('role', 'status');
    document.body.appendChild(contenedorToasts);
  }
  const el = document.createElement('div');
  el.className = `toast${tipo === 'error' ? ' toast--error' : tipo === 'ok' ? ' toast--ok' : ''}`;
  el.textContent = mensaje;
  contenedorToasts.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

/** Abre un diálogo con título, cuerpo HTML seguro y botones. Devuelve el elemento dialog. */
export function abrirDialogo({ titulo, cuerpo, botones = [], alCerrar = null, ancho = null }) {
  const dlg = document.createElement('dialog');
  dlg.className = 'dialogo';
  if (ancho) dlg.style.width = ancho;
  dlg.innerHTML = String(h`
    <div class="dialogo__cab">
      <h3>${titulo}</h3>
      <button type="button" class="btn btn--fantasma" data-cerrar aria-label="Cerrar">✕</button>
    </div>
    <div class="dialogo__cuerpo">${raw(cuerpo)}</div>
    ${botones.length ? h`<div class="dialogo__pie">${botones.map((b, i) => h`<button type="button" class="btn ${b.clase ?? 'btn--sec'}" data-boton="${i}">${b.texto}</button>`)}</div>` : ''}
  `);
  document.body.appendChild(dlg);
  const cerrar = () => { if (dlg.open) dlg.close(); };
  dlg.addEventListener('close', () => { dlg.remove(); if (alCerrar) alCerrar(); });
  $('[data-cerrar]', dlg).addEventListener('click', cerrar);
  botones.forEach((b, i) => {
    $(`[data-boton="${i}"]`, dlg).addEventListener('click', async (ev) => {
      const btn = ev.currentTarget;
      if (b.accion) {
        btn.disabled = true;
        try {
          const r = await b.accion(dlg);
          if (r !== false) cerrar();
        } finally {
          btn.disabled = false;
        }
      } else {
        cerrar();
      }
    });
  });
  dlg.showModal();
  return dlg;
}

export function confirmar({ titulo = '¿Confirmas?', mensaje, textoOk = 'Confirmar', peligro = false }) {
  return new Promise((resolve) => {
    let decidido = false;
    abrirDialogo({
      titulo,
      cuerpo: String(h`<p>${mensaje}</p>`),
      botones: [
        { texto: 'Cancelar', clase: 'btn--sec', accion: () => { decidido = true; resolve(false); } },
        { texto: textoOk, clase: peligro ? 'btn--peligro' : '', accion: () => { decidido = true; resolve(true); } },
      ],
      alCerrar: () => { if (!decidido) resolve(false); },
    });
  });
}

export function pedirTexto({ titulo, etiqueta, valor = '', textoOk = 'Guardar', placeholder = '' }) {
  return new Promise((resolve) => {
    let decidido = false;
    const dlg = abrirDialogo({
      titulo,
      cuerpo: String(h`<div class="campo"><label for="dlg-texto">${etiqueta}</label><input id="dlg-texto" type="text" value="${valor}" placeholder="${placeholder}" maxlength="200"></div>`),
      botones: [
        { texto: 'Cancelar', clase: 'btn--sec', accion: () => { decidido = true; resolve(null); } },
        { texto: textoOk, clase: '', accion: (d) => { decidido = true; resolve($('#dlg-texto', d).value); } },
      ],
      alCerrar: () => { if (!decidido) resolve(null); },
    });
    const input = $('#dlg-texto', dlg);
    input.focus();
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); decidido = true; resolve(input.value); dlg.close(); } });
  });
}

/** Pestañas: botones con data-tab y paneles con data-panel. */
export function montarTabs(root, alCambiar = null) {
  const botones = $$('[data-tab]', root);
  const activar = (id) => {
    botones.forEach((b) => b.classList.toggle('activo', b.dataset.tab === id));
    $$('[data-panel]', root).forEach((p) => p.classList.toggle('activo', p.dataset.panel === id));
    if (alCambiar) alCambiar(id);
  };
  botones.forEach((b) => b.addEventListener('click', () => activar(b.dataset.tab)));
  return { activar };
}

/**
 * Editor de sets. Devuelve { leer(), escribir(sets), setFormato(id), setEstado(estado), onChange(cb), el }.
 * nombres: [nombre1, nombre2] para las cabeceras.
 */
export function editorSets(contenedor, { formatoId, nombres = ['Jugador 1', 'Jugador 2'], sets = [], estado = 'completo' } = {}) {
  let formato = FORMATOS_PARTIDO[formatoId] || FORMATOS_PARTIDO.bo3;
  let estadoActual = estado;
  let filas = sets.length ? sets.map((s) => [s[0], s[1]]) : [];
  let cb = () => {};
  let nombresActuales = nombres;

  const minFilas = () => Math.max(1, formato.setsParaGanar === null ? 1 : Math.min(formato.setsParaGanar, formato.maxSets));

  function etiquetaSet(i) {
    if (formato.superTb === true && i === formato.maxSets - 1) return 'Super tiebreak';
    return `Set ${i + 1}`;
  }

  function render() {
    if (estadoActual === 'wo') {
      contenedor.innerHTML = String(h`<p class="texto-suave">Un W.O. no lleva marcador. Indica solo quién gana.</p>`);
      return;
    }
    while (filas.length < minFilas()) filas.push(['', '']);
    const puedeAgregar = filas.length < formato.maxSets;
    const puedeQuitar = filas.length > minFilas();
    contenedor.innerHTML = String(h`
      <div class="sets-cabecera"><span></span><span title="${nombresActuales[0]}">${nombresActuales[0]}</span><span></span><span title="${nombresActuales[1]}">${nombresActuales[1]}</span></div>
      <div class="sets-editor">
        ${filas.map((f, i) => h`
          <div class="set-fila" data-i="${i}">
            <label>${etiquetaSet(i)}</label>
            <input type="number" inputmode="numeric" min="0" max="99" data-lado="0" value="${f[0]}" aria-label="${etiquetaSet(i)} ${nombresActuales[0]}">
            <span class="guion">–</span>
            <input type="number" inputmode="numeric" min="0" max="99" data-lado="1" value="${f[1]}" aria-label="${etiquetaSet(i)} ${nombresActuales[1]}">
            ${puedeQuitar && i === filas.length - 1 ? h`<button type="button" class="btn btn--fantasma btn--sm quitar" data-quitar aria-label="Quitar set">✕</button>` : ''}
          </div>`)}
      </div>
      ${puedeAgregar ? h`<div style="margin-top:8px"><button type="button" class="btn btn--sec btn--sm" data-agregar>+ Agregar set</button></div>` : ''}
    `);
    $$('input', contenedor).forEach((inp) => {
      inp.addEventListener('input', () => {
        const fila = Number(inp.closest('.set-fila').dataset.i);
        filas[fila][Number(inp.dataset.lado)] = inp.value;
        cb();
      });
      inp.addEventListener('keydown', (e) => {
        // Enter o guion salta al siguiente campo.
        if (e.key === 'Enter' || e.key === '-') {
          e.preventDefault();
          const todos = $$('input', contenedor);
          const idx = todos.indexOf(inp);
          if (todos[idx + 1]) todos[idx + 1].focus();
        }
      });
    });
    const agregar = $('[data-agregar]', contenedor);
    if (agregar) agregar.addEventListener('click', () => { filas.push(['', '']); render(); cb(); $$('input', contenedor).at(-2)?.focus(); });
    const quitar = $('[data-quitar]', contenedor);
    if (quitar) quitar.addEventListener('click', () => { filas.pop(); render(); cb(); });
  }

  render();

  return {
    el: contenedor,
    leer() {
      if (estadoActual === 'wo') return [];
      return filas
        .filter((f) => String(f[0]).trim() !== '' || String(f[1]).trim() !== '')
        .map((f) => [Number(f[0]), Number(f[1])]);
    },
    escribir(nuevos) { filas = (nuevos || []).map((s) => [s[0], s[1]]); render(); },
    setFormato(id) { formato = FORMATOS_PARTIDO[id] || formato; if (filas.length > formato.maxSets) filas = filas.slice(0, formato.maxSets); render(); },
    setEstado(e) { estadoActual = e; render(); },
    setNombres(n) { nombresActuales = n; render(); },
    onChange(fn) { cb = fn; },
  };
}

/** Marcador en tarjeta: cada set como cajita, con el ganador del set resaltado. */
export function marcadorHtml(partido, desdeJugadorId = null) {
  if ((partido.estado || 'completo') === 'wo') return h`<span class="partido__sets"><span class="g">W.O.</span></span>`;
  const invertir = desdeJugadorId && desdeJugadorId === partido.jugador2;
  const fmt = FORMATOS_PARTIDO[partido.formatoPartido];
  const cajas = (partido.sets || []).map((set, i) => {
    const [a, b] = invertir ? [set[1], set[0]] : set;
    const esStb = fmt && fmt.superTb === true ? i === fmt.maxSets - 1 : Math.max(set[0], set[1]) >= 10;
    const ganoSet = a > b;
    return h`<span class="${ganoSet ? 'g' : ''}${esStb ? ' stb' : ''}" title="${esStb ? 'Super tiebreak' : `Set ${i + 1}`}">${a}-${b}</span>`;
  });
  return h`<span class="partido__sets">${cajas}${partido.estado === 'retiro' ? h`<span class="stb" title="Retiro">ret.</span>` : ''}</span>`;
}
