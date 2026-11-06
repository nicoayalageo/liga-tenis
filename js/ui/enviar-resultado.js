// Modal para que un jugador proponga un resultado.

import { h, $, fmtFechaHora, nombreJugador, leerLocal, guardarLocal } from '../util.js';
import { abrirDialogo, toast } from './components.js';
import { formularioPartido } from './partido-form.js';
import { sesionAnonima } from '../auth.js';
import { enviarPropuesta } from '../store.js';
import { suscribirMisPropuestas, mensajeError } from '../db.js';
import { formatScore } from '../core/scoring.js';

export function abrirEnvioResultado(liga) {
  const activos = (liga.jugadores || []).filter((j) => j.activo !== false);
  if (activos.length < 2) { toast('Aún no hay suficientes jugadores en la liga.', 'error'); return; }
  const yoGuardado = leerLocal('soy', '');
  const dlg = abrirDialogo({
    titulo: 'Cargar resultado',
    ancho: 'min(640px, calc(100vw - 32px))',
    cuerpo: `
      <p class="aviso aviso--info" style="margin-bottom:14px">El resultado quedará <strong>pendiente</strong> hasta que el administrador lo apruebe. Recién entonces se verá en la tabla.</p>
      <div data-form></div>
      <div class="campo">
        <label for="er-pin">PIN de la liga</label>
        <input id="er-pin" type="password" inputmode="numeric" autocomplete="off" maxlength="20" placeholder="Te lo entrega el administrador">
      </div>
      <div class="aviso aviso--error" data-error hidden></div>
    `,
    botones: [
      { texto: 'Cancelar', clase: 'btn--sec' },
      {
        texto: 'Enviar para aprobación',
        clase: '',
        accion: async (d) => {
          const err = $('[data-error]', d);
          err.hidden = true;
          const v = form.validar();
          if (!v.ok) { err.textContent = v.errores[0]; err.hidden = false; return false; }
          const pin = $('#er-pin', d).value.trim();
          if (!pin) { err.textContent = 'Ingresa el PIN de la liga.'; err.hidden = false; return false; }
          try {
            const uid = await sesionAnonima();
            const datos = form.leer();
            await enviarPropuesta(liga, datos, pin, uid, datos.jugador1);
            guardarLocal('soy', datos.jugador1);
            toast('Resultado enviado. El administrador lo revisará.', 'ok', 4500);
            return true;
          } catch (e) {
            const msg = (e && e.code === 'permission-denied') ? 'PIN incorrecto o datos no válidos. Revisa e intenta de nuevo.' : mensajeError(e);
            err.textContent = msg;
            err.hidden = false;
            return false;
          }
        },
      },
    ],
  });
  const form = formularioPartido($('[data-form]', dlg), { liga, modo: 'jugador', fijarJugador1: activos.some((j) => j.id === yoGuardado) ? yoGuardado : null });
  if (yoGuardado && activos.some((j) => j.id === yoGuardado)) {
    // Permitir cambiar "Soy" aunque venga guardado.
    const sel = $('#pf-j1', dlg);
    sel.disabled = false;
  }
  form.enfocar();
}

/** Muestra el estado de los envíos de este navegador. */
export function montarMisEnvios(contenedor, obtenerLiga) {
  let unsub = null;
  const pintar = (lista) => {
    const liga = obtenerLiga();
    if (!lista.length || !liga) { contenedor.hidden = true; return; }
    contenedor.hidden = false;
    const etiqueta = { pendiente: ['chip--ocre', 'Pendiente'], aprobada: ['chip--exito', 'Aprobada'], rechazada: ['chip--error', 'Rechazada'] };
    contenedor.innerHTML = String(h`
      <div class="tarjeta">
        <h3 style="margin-bottom:8px">Tus envíos</h3>
        <ul class="lista-simple">
          ${lista.slice(0, 8).map((p) => h`
            <li>
              <span class="texto">${nombreJugador(liga, p.jugador1)} vs ${nombreJugador(liga, p.jugador2)} · <span class="mono">${formatScore(p)}</span>
                <small>${p.fecha}${p.creadoEn ? h` · enviado ${fmtFechaHora(p.creadoEn)}` : ''}${p.motivoRechazo ? h` · ${p.motivoRechazo}` : ''}</small></span>
              <span class="chip ${etiqueta[p.estadoPropuesta]?.[0] || ''}">${etiqueta[p.estadoPropuesta]?.[1] || p.estadoPropuesta}</span>
            </li>`)}
        </ul>
      </div>`);
  };
  return {
    conectar(uid) {
      if (unsub) unsub();
      unsub = suscribirMisPropuestas(uid, pintar, () => {});
    },
    repintar() { /* se repinta en la próxima emisión */ },
  };
}
