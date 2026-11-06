// Página pública: carga la liga en tiempo real y renderiza cada sección.

import { $, $$, h, hace, fmtFechaHora } from './util.js';
import { aplicarTema, montarBotonTema } from './theme.js';
import { FIREBASE_CONFIGURADO, suscribirLiga, mensajeError, getAuthInstance } from './db.js';
import { renderTabla } from './ui/tabla.js';
import { renderResultados } from './ui/resultados.js';
import { renderCalendario } from './ui/calendario.js';
import { renderPlayoffs } from './ui/playoffs.js';
import { renderJugadores } from './ui/jugadores.js';
import { abrirEnvioResultado, montarMisEnvios } from './ui/enviar-resultado.js';
import { pendientes, esFormatoConCalendario } from './core/fixtures.js';
import { FORMATOS_LIGA, FORMATOS_PARTIDO } from './core/formats.js';
import { toast } from './ui/components.js';

aplicarTema();
montarBotonTema($('[data-tema]'));

let liga = null;
let meta = null;
const estadoResultados = { filtro: '' };
const misEnvios = montarMisEnvios($('#mis-envios'), () => liga);

function pintarCabecera() {
  const c = liga.config;
  $('#titulo').textContent = c.nombre;
  document.title = `${c.nombre} · Tabla y resultados`;
  $('#temporada').textContent = c.temporada ? `Temporada ${c.temporada}` : 'Liga de tenis en arcilla';
  $('#lema').textContent = c.lema || '';
  $('#formato').textContent = `${FORMATOS_LIGA[c.formatoLiga]?.label || ''} · ${FORMATOS_PARTIDO[c.formatoPartido]?.label || ''}`;
  const jugados = (liga.partidos || []).length;
  const faltan = esFormatoConCalendario(c.formatoLiga) ? pendientes(liga).length : null;
  const activos = (liga.jugadores || []).filter((j) => j.activo !== false).length;
  $('#stats').innerHTML = String(h`
    <div class="stat"><div class="stat__valor">${activos}</div><div class="stat__etiqueta">Jugadores</div></div>
    <div class="stat"><div class="stat__valor">${jugados}</div><div class="stat__etiqueta">Partidos</div></div>
    ${faltan !== null ? h`<div class="stat"><div class="stat__valor">${faltan}</div><div class="stat__etiqueta">Pendientes</div></div>` : ''}
  `);
  pintarActualizado();
}

function pintarActualizado() {
  const el = $('#actualizado');
  if (!meta || !meta.ultimaActualizacion) { el.textContent = 'En vivo'; return; }
  el.textContent = `Actualizado ${hace(meta.ultimaActualizacion)}`;
  el.title = fmtFechaHora(meta.ultimaActualizacion);
}
setInterval(pintarActualizado, 60000);

function pintar() {
  if (!liga) return;
  $('#cargando').hidden = true;
  if (!liga.config.configurada) {
    $('#sin-configurar').hidden = false;
    $('#contenido').hidden = true;
    $('#titulo').textContent = 'Liga de Tenis';
    return;
  }
  $('#sin-configurar').hidden = true;
  $('#contenido').hidden = false;
  pintarCabecera();
  renderTabla($('#tabla'), liga);
  renderResultados($('#resultados'), liga, estadoResultados);
  const conCalendario = esFormatoConCalendario(liga.config.formatoLiga);
  $('#calendario').hidden = !conCalendario;
  $('[href="#calendario"]').parentElement.hidden = !conCalendario;
  if (conCalendario) renderCalendario($('#calendario-lista'), liga);
  renderPlayoffs($('#playoffs-llave'), $('#playoffs'), liga);
  $('[href="#playoffs"]').parentElement.hidden = $('#playoffs').hidden;
  renderJugadores($('#jugadores'), liga);
}

function montarNavegacion() {
  const enlaces = $$('.nav__lista a');
  const secciones = enlaces.map((a) => $(a.getAttribute('href'))).filter(Boolean);
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        enlaces.forEach((a) => a.classList.toggle('activo', a.getAttribute('href') === `#${e.target.id}`));
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  secciones.forEach((s) => obs.observe(s));
}

async function iniciar() {
  const params = new URLSearchParams(location.search);
  if (params.has('demo')) {
    if (params.get('tema')) { document.documentElement.setAttribute('data-theme', params.get('tema')); }
    const { ligaDemo } = await import('./demo-data.js');
    liga = ligaDemo;
    meta = { ultimaActualizacion: ligaDemo.config.updatedAt };
    pintar();
    $$('[data-cargar-resultado]').forEach((b) => b.addEventListener('click', () => abrirEnvioResultado(liga)));
    $('#reintentar').addEventListener('click', () => location.reload());
    montarNavegacion();
    if (params.get('abrir') === 'enviar') abrirEnvioResultado(liga);
    return;
  }
  if (!FIREBASE_CONFIGURADO) {
    $('#cargando').hidden = true;
    $('#error').hidden = false;
    $('#error-texto').textContent = 'La página aún no está conectada a la base de datos (falta js/firebase-config.js).';
    return;
  }
  suscribirLiga((l, m) => {
    liga = l;
    meta = m;
    $('#error').hidden = true;
    pintar();
  }, (e) => {
    $('#cargando').hidden = true;
    $('#error').hidden = false;
    $('#error-texto').textContent = mensajeError(e);
  });
  $$('[data-cargar-resultado]').forEach((b) => b.addEventListener('click', () => {
    if (!liga || !liga.config.configurada) { toast('La liga aún no está configurada.', 'error'); return; }
    abrirEnvioResultado(liga);
  }));
  $('#reintentar').addEventListener('click', () => location.reload());
  // Si este navegador ya envió propuestas, mostrar su estado.
  try {
    const auth = getAuthInstance();
    auth.onAuthStateChanged((u) => { if (u) misEnvios.conectar(u.uid); });
  } catch { /* sin Firebase */ }
  montarNavegacion();
}

iniciar();
