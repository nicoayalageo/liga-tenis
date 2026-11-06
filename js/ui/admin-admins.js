// Administradores y solicitudes de acceso.

import { h, $, $$, fmtFechaHora } from '../util.js';
import { confirmar, toast } from './components.js';
import { aprobarSolicitudAdmin, rechazarSolicitudAdmin, quitarAdmin } from '../store.js';
import { mensajeError } from '../db.js';

export function renderAdmins(contenedor, ctx) {
  const { admins, solicitudes, actor, uid } = ctx;
  contenedor.innerHTML = String(h`
    <div class="pila">
      <section class="tarjeta">
        <h3 style="margin-bottom:10px">Solicitudes de acceso ${solicitudes.length ? h`<span class="chip chip--ocre">${solicitudes.length}</span>` : ''}</h3>
        ${solicitudes.length === 0 ? h`<p class="texto-suave">No hay solicitudes. Quien quiera administrar debe crear una cuenta en esta página, verificar su correo y pulsar "Solicitar acceso".</p>` : h`
          <ul class="lista-simple">
            ${solicitudes.map((s) => h`
              <li data-sol="${s.id}">
                <span class="texto"><strong>${s.nombre}</strong><small>${s.email}${s.creadoEn ? h` · ${fmtFechaHora(s.creadoEn)}` : ''}</small></span>
                <span class="acciones">
                  <button type="button" class="btn btn--verde btn--sm" data-aprobar>Dar acceso</button>
                  <button type="button" class="btn btn--peligro btn--sm" data-rechazar>Rechazar</button>
                </span>
              </li>`)}
          </ul>`}
      </section>
      <section class="tarjeta">
        <h3 style="margin-bottom:10px">Administradores</h3>
        <ul class="lista-simple">
          ${admins.map((a) => h`
            <li data-adm="${a.id}">
              <span class="texto"><strong>${a.nombre || a.email}</strong>${a.id === uid ? h` <span class="chip chip--verde">Tú</span>` : ''}<small>${a.email}</small></span>
              ${a.id !== uid ? h`<button type="button" class="btn btn--fantasma btn--sm" style="color:var(--error)" data-quitar>Quitar</button>` : ''}
            </li>`)}
        </ul>
      </section>
    </div>
  `);
  $$('[data-sol]', contenedor).forEach((li) => {
    const s = solicitudes.find((x) => x.id === li.dataset.sol);
    $('[data-aprobar]', li).addEventListener('click', async () => {
      try { await aprobarSolicitudAdmin(s, actor); toast(`${s.nombre} ahora es administrador.`, 'ok'); } catch (ex) { toast(mensajeError(ex), 'error'); }
    });
    $('[data-rechazar]', li).addEventListener('click', async () => {
      try { await rechazarSolicitudAdmin(s, actor); toast('Solicitud rechazada.'); } catch (ex) { toast(mensajeError(ex), 'error'); }
    });
  });
  $$('[data-adm]', contenedor).forEach((li) => {
    const a = admins.find((x) => x.id === li.dataset.adm);
    const b = $('[data-quitar]', li);
    if (b) b.addEventListener('click', async () => {
      const ok = await confirmar({ titulo: 'Quitar administrador', mensaje: `${a.nombre || a.email} dejará de poder administrar la liga. ¿Continuar?`, textoOk: 'Quitar', peligro: true });
      if (!ok) return;
      try { await quitarAdmin(a, actor, uid); toast('Administrador quitado.'); } catch (ex) { toast(mensajeError(ex), 'error'); }
    });
  });
}
