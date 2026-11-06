// Página de administración: sesión, pestañas y conexión de cada vista con los datos en tiempo real.

import { $, $$, h } from './util.js';
import { aplicarTema, montarBotonTema } from './theme.js';
import {
  FIREBASE_CONFIGURADO, suscribirLiga, suscribirPropuestasPendientes, suscribirHistorial, suscribirAdmins,
  suscribirSolicitudes, suscribirAcceso, mensajeError,
} from './db.js';
import { observarSesion, cerrarSesion, reenviarVerificacion, recargarUsuario, intentarAltaPropietario, solicitarAdmin } from './auth.js';
import { montarTabs, toast } from './ui/components.js';
import { renderAcceso } from './ui/admin-auth.js';
import { renderPendientes } from './ui/admin-pendientes.js';
import { renderResultadosAdmin } from './ui/admin-resultados.js';
import { renderJugadoresAdmin } from './ui/admin-jugadores.js';
import { renderConfig } from './ui/admin-config.js';
import { renderAdmins } from './ui/admin-admins.js';
import { renderHistorial } from './ui/admin-historial.js';
import { exportarLiga } from './store.js';

aplicarTema();
montarBotonTema($('[data-tema]'));

const estado = {
  liga: null,
  sesion: null,
  propuestas: [],
  historial: [],
  admins: [],
  solicitudes: [],
  acceso: null,
  tab: 'pendientes',
  configPintada: false,
};
const estadoResultados = { filtro: '' };
let subsAdmin = [];
let subLiga = null;
let altaIntentada = false;

function actor() {
  const s = estado.sesion;
  if (!s || !s.user) return '—';
  return (s.adminDoc && s.adminDoc.nombre) || s.user.displayName || s.user.email || '—';
}

function ctx() {
  return {
    liga: estado.liga,
    actor: actor(),
    uid: estado.sesion && estado.sesion.user ? estado.sesion.user.uid : null,
    propuestas: estado.propuestas,
    historial: estado.historial,
    admins: estado.admins,
    solicitudes: estado.solicitudes,
    acceso: estado.acceso,
  };
}

function mostrar(id) {
  for (const sec of ['acceso', 'sin-autorizar', 'panel']) $(`#${sec}`).hidden = sec !== id;
}

function pintarPanel() {
  if (!estado.liga || !estado.sesion || !estado.sesion.esAdmin) return;
  $('#quien').textContent = actor();
  $('#liga-nombre').textContent = estado.liga.config.configurada ? estado.liga.config.nombre : 'Liga sin configurar';
  const n = estado.propuestas.length;
  const contador = $('[data-tab="pendientes"] .contador');
  contador.textContent = n;
  contador.hidden = n === 0;
  const c = ctx();
  switch (estado.tab) {
    case 'pendientes': renderPendientes($('#panel-pendientes'), c); break;
    case 'resultados': renderResultadosAdmin($('#panel-resultados'), c, estadoResultados); break;
    case 'jugadores': renderJugadoresAdmin($('#panel-jugadores'), c); break;
    case 'config':
      // La configuración solo se repinta al entrar a la pestaña, para no perder lo que se está editando.
      if (!estado.configPintada) { renderConfig($('#panel-config'), c); estado.configPintada = true; }
      break;
    case 'admins': renderAdmins($('#panel-admins'), c); break;
    case 'historial': renderHistorial($('#panel-historial'), c); break;
    default: break;
  }
  if (!estado.liga.config.configurada && estado.tab !== 'config') {
    $('#aviso-config').hidden = false;
  } else {
    $('#aviso-config').hidden = true;
  }
}

function conectarAdmin() {
  desconectarAdmin();
  const onErr = (e) => toast(mensajeError(e), 'error');
  subsAdmin = [
    suscribirPropuestasPendientes((l) => { estado.propuestas = l; pintarPanel(); }, onErr),
    suscribirHistorial((l) => { estado.historial = l; if (estado.tab === 'historial') pintarPanel(); }, onErr),
    suscribirAdmins((l) => { estado.admins = l; if (estado.tab === 'admins') pintarPanel(); }, onErr),
    suscribirSolicitudes((l) => { estado.solicitudes = l; pintarSolicitudesBadge(); if (estado.tab === 'admins') pintarPanel(); }, onErr),
    suscribirAcceso((a) => { estado.acceso = a; if (estado.tab === 'config') { estado.configPintada = false; pintarPanel(); } }, onErr),
  ];
}

function pintarSolicitudesBadge() {
  const b = $('[data-tab="admins"] .contador');
  b.textContent = estado.solicitudes.length;
  b.hidden = estado.solicitudes.length === 0;
}

function desconectarAdmin() {
  subsAdmin.forEach((u) => u());
  subsAdmin = [];
}

async function pintarSinAutorizar() {
  const s = estado.sesion;
  const cont = $('#sin-autorizar');
  const yaSolicito = estado.solicitudPropia;
  cont.innerHTML = String(h`
    <div class="tarjeta acceso">
      <h2>Cuenta sin acceso de administrador</h2>
      <p class="texto-suave">Sesión iniciada como <strong>${s.user.email}</strong>.</p>
      ${!s.verificado ? h`
        <div class="aviso aviso--aviso" style="margin-bottom:12px">Primero verifica tu correo con el enlace que te enviamos. Luego pulsa "Ya verifiqué".</div>
        <div class="acciones">
          <button type="button" class="btn" data-ya-verifique>Ya verifiqué</button>
          <button type="button" class="btn btn--sec" data-reenviar>Reenviar correo</button>
        </div>` : h`
        <p>Pide acceso al administrador de la liga. Verá tu solicitud en su panel.</p>
        <div class="acciones">
          <button type="button" class="btn" data-solicitar ${yaSolicito ? 'disabled' : ''}>${yaSolicito ? 'Solicitud enviada' : 'Solicitar acceso'}</button>
        </div>`}
      <p style="margin-top:16px"><button type="button" class="btn btn--fantasma" data-salir>Cerrar sesión</button></p>
    </div>
  `);
  const bv = $('[data-ya-verifique]', cont);
  if (bv) bv.addEventListener('click', async () => {
    const u = await recargarUsuario();
    if (u && u.emailVerified) {
      const ok = await intentarAltaPropietario(u);
      if (!ok) { estado.sesion = { ...estado.sesion, verificado: true }; pintarSinAutorizar(); }
    } else {
      toast('Tu correo aún no figura como verificado. Revisa la bandeja de entrada o spam.', 'error', 5000);
    }
  });
  const br = $('[data-reenviar]', cont);
  if (br) br.addEventListener('click', async () => { try { await reenviarVerificacion(); toast('Correo de verificación enviado.', 'ok'); } catch (e) { toast(mensajeError(e), 'error'); } });
  const bs = $('[data-solicitar]', cont);
  if (bs) bs.addEventListener('click', async () => {
    try {
      await solicitarAdmin(s.user.displayName);
      estado.solicitudPropia = true;
      toast('Solicitud enviada. El administrador la verá en su panel.', 'ok', 5000);
      pintarSinAutorizar();
    } catch (e) { toast(mensajeError(e), 'error'); }
  });
  $('[data-salir]', cont).addEventListener('click', () => cerrarSesion());
}

async function iniciar() {
  const params = new URLSearchParams(location.search);
  if (params.has('demo')) {
    if (params.get('tema')) document.documentElement.setAttribute('data-theme', params.get('tema'));
    const { ligaDemo, propuestasDemo, historialDemo } = await import('./demo-data.js');
    estado.liga = ligaDemo;
    estado.propuestas = propuestasDemo;
    estado.historial = historialDemo;
    estado.admins = [{ id: 'uid-demo', email: 'admin@ejemplo.cl', nombre: 'Nicolás' }];
    estado.solicitudes = [{ id: 'uid-2', email: 'amigo@ejemplo.cl', nombre: 'Pedro', creadoEn: new Date() }];
    estado.acceso = { pin: '2026' };
    estado.sesion = { user: { uid: 'uid-demo', email: 'admin@ejemplo.cl', displayName: 'Nicolás' }, esAdmin: true, adminDoc: { nombre: 'Nicolás' } };
    const tabs = montarTabs($('#panel'), (id) => { estado.tab = id; if (id !== 'config') estado.configPintada = false; pintarPanel(); });
    mostrar('panel');
    tabs.activar(params.get('tab') || 'pendientes');
    pintarSolicitudesBadge();
    if (params.get('abrir') === 'nuevo') {
      const { abrirFormularioPartido } = await import('./ui/admin-resultados.js');
      abrirFormularioPartido(ctx());
    }
    return;
  }
  if (!FIREBASE_CONFIGURADO) {
    mostrar('acceso');
    $('#acceso').innerHTML = '<div class="aviso aviso--error">La página aún no está conectada a la base de datos (falta js/firebase-config.js).</div>';
    return;
  }
  const tabs = montarTabs($('#panel'), (id) => { estado.tab = id; if (id !== 'config') estado.configPintada = false; pintarPanel(); });
  tabs.activar('pendientes');

  $('[data-salir-barra]').addEventListener('click', async () => { await cerrarSesion(); location.reload(); });
  $('[data-exportar]').addEventListener('click', () => {
    if (!estado.liga) return;
    const blob = new Blob([exportarLiga(estado.liga, { propuestasPendientes: estado.propuestas })], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `liga-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  observarSesion(async (s) => {
    estado.sesion = s;
    if (!s.user || s.anonimo) {
      desconectarAdmin();
      if (subLiga) { subLiga(); subLiga = null; }
      mostrar('acceso');
      renderAcceso($('#acceso'));
      return;
    }
    if (!s.esAdmin) {
      desconectarAdmin();
      if (!altaIntentada && s.verificado) {
        altaIntentada = true;
        const ok = await intentarAltaPropietario(s.user);
        if (ok) return; // el onSnapshot de admins volverá a llamar con esAdmin = true
      }
      mostrar('sin-autorizar');
      pintarSinAutorizar();
      return;
    }
    mostrar('panel');
    if (!subLiga) {
      subLiga = suscribirLiga((l) => { estado.liga = l; estado.configPintada = false; pintarPanel(); }, (e) => toast(mensajeError(e), 'error'));
    }
    if (subsAdmin.length === 0) conectarAdmin();
    pintarPanel();
  });
}

iniciar();
