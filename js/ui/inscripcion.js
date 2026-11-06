// Inscripción de jugadores desde la página pública. Queda pendiente hasta que un administrador la apruebe.

import { h, $, fmtFechaHora, leerLocal, guardarLocal } from '../util.js';
import { abrirDialogo, toast } from './components.js';
import { sesionAnonima } from '../auth.js';
import { enviarInscripcion } from '../store.js';
import { suscribirMisInscripciones, mensajeError } from '../db.js';

export function abrirInscripcion(liga, { demo = false } = {}) {
  const nombreGuardado = leerLocal('inscripcion-nombre', '');
  abrirDialogo({
    titulo: 'Inscribirme en la liga',
    ancho: 'min(520px, calc(100vw - 32px))',
    cuerpo: String(h`
      <p class="aviso aviso--info" style="margin-bottom:14px">Tu inscripción quedará <strong>pendiente</strong> hasta que el administrador la apruebe. Recién entonces aparecerás en la lista de jugadores.</p>
      <div class="campo">
        <label for="in-nombre">Nombre y apellido</label>
        <input id="in-nombre" type="text" maxlength="40" autocomplete="name" value="${nombreGuardado}" placeholder="Como quieres aparecer en la tabla">
      </div>
      <div class="campo">
        <label for="in-contacto">Contacto <span class="texto-suave" style="font-weight:400">(opcional)</span></label>
        <input id="in-contacto" type="text" maxlength="80" autocomplete="tel" placeholder="Teléfono o correo, solo lo ve el administrador">
      </div>
      <div class="campo">
        <label for="in-mensaje">Mensaje <span class="texto-suave" style="font-weight:400">(opcional)</span></label>
        <textarea id="in-mensaje" rows="2" maxlength="200" placeholder="Ej.: disponible los fines de semana"></textarea>
      </div>
      <div class="campo">
        <label for="in-pin">PIN de la liga</label>
        <input id="in-pin" type="password" inputmode="numeric" autocomplete="off" maxlength="20" placeholder="Te lo entrega el administrador">
      </div>
      <div class="aviso aviso--error" data-error hidden></div>
    `),
    botones: [
      { texto: 'Cancelar', clase: 'btn--sec' },
      {
        texto: 'Enviar inscripción',
        clase: '',
        accion: async (d) => {
          const err = $('[data-error]', d);
          err.hidden = true;
          const datos = {
            nombre: $('#in-nombre', d).value,
            contacto: $('#in-contacto', d).value,
            mensaje: $('#in-mensaje', d).value,
          };
          const pin = $('#in-pin', d).value.trim();
          if (!pin) { err.textContent = 'Ingresa el PIN de la liga.'; err.hidden = false; return false; }
          if (demo) { toast('En la vista de demostración no se envían inscripciones.'); return true; }
          try {
            const uid = await sesionAnonima();
            await enviarInscripcion(liga, datos, pin, uid);
            guardarLocal('inscripcion-nombre', datos.nombre.trim());
            toast('Inscripción enviada. El administrador la revisará.', 'ok', 4500);
            return true;
          } catch (e) {
            err.textContent = (e && e.code === 'permission-denied') ? 'PIN incorrecto o datos no válidos. Revisa e intenta de nuevo.' : mensajeError(e);
            err.hidden = false;
            return false;
          }
        },
      },
    ],
  });
  $('#in-nombre').focus();
}

/** Muestra el estado de las inscripciones enviadas desde este navegador. */
export function montarMiInscripcion(contenedor) {
  let unsub = null;
  const etiqueta = { pendiente: ['chip--ocre', 'Pendiente'], aprobada: ['chip--exito', 'Aprobada'], rechazada: ['chip--error', 'Rechazada'] };
  const pintar = (lista) => {
    if (!lista.length) { contenedor.hidden = true; return; }
    contenedor.hidden = false;
    contenedor.innerHTML = String(h`
      <div class="tarjeta">
        <h3 style="margin-bottom:8px">Tu inscripción</h3>
        <ul class="lista-simple">
          ${lista.slice(0, 3).map((i) => h`
            <li>
              <span class="texto">${i.nombreFinal || i.nombre}
                <small>${i.creadoEn ? h`enviada ${fmtFechaHora(i.creadoEn)}` : ''}${i.motivoRechazo ? h` · ${i.motivoRechazo}` : ''}${i.estado === 'aprobada' ? ' · ya puedes cargar resultados' : ''}</small></span>
              <span class="chip ${etiqueta[i.estado]?.[0] || ''}">${etiqueta[i.estado]?.[1] || i.estado}</span>
            </li>`)}
        </ul>
      </div>`);
  };
  return {
    conectar(uid) {
      if (unsub) unsub();
      unsub = suscribirMisInscripciones(uid, pintar, () => {});
    },
  };
}
