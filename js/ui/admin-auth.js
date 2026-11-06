// Pantalla de acceso de administradores: entrar, crear cuenta y recuperar contraseña.

import { h, $, $$ } from '../util.js';
import { iniciarSesion, crearCuenta, recuperarContrasena } from '../auth.js';
import { mensajeError } from '../db.js';
import { toast } from './components.js';

export function renderAcceso(contenedor) {
  let modo = 'entrar';
  const pintar = () => {
    contenedor.innerHTML = String(h`
      <div class="tarjeta acceso">
        <h2>${modo === 'entrar' ? 'Administración' : modo === 'crear' ? 'Crear cuenta' : 'Recuperar contraseña'}</h2>
        <p class="texto-suave">${modo === 'entrar' ? 'Entra con tu correo y contraseña de administrador.' : modo === 'crear' ? 'Crea tu cuenta y luego pide acceso al administrador de la liga.' : 'Te enviaremos un enlace para restablecerla.'}</p>
        <form data-form novalidate>
          ${modo === 'crear' ? h`<div class="campo"><label for="ac-nombre">Tu nombre</label><input id="ac-nombre" type="text" maxlength="60" autocomplete="name" required></div>` : ''}
          <div class="campo"><label for="ac-email">Correo</label><input id="ac-email" type="email" autocomplete="email" required></div>
          ${modo !== 'recuperar' ? h`<div class="campo"><label for="ac-pass">Contraseña</label><input id="ac-pass" type="password" autocomplete="${modo === 'crear' ? 'new-password' : 'current-password'}" minlength="6" required></div>` : ''}
          <div class="aviso aviso--error" data-error hidden></div>
          <button type="submit" class="btn" style="width:100%">${modo === 'entrar' ? 'Entrar' : modo === 'crear' ? 'Crear cuenta' : 'Enviar enlace'}</button>
        </form>
        <div class="alternar">
          ${modo === 'entrar' ? h`<a href="#" data-modo="crear">Crear cuenta</a> · <a href="#" data-modo="recuperar">¿Olvidaste tu contraseña?</a>` : h`<a href="#" data-modo="entrar">Volver a entrar</a>`}
        </div>
        <p class="texto-suave" style="margin-top:16px;font-size:0.85rem"><a href="index.html">← Volver a la liga</a></p>
      </div>
    `);
    $$('[data-modo]', contenedor).forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); modo = a.dataset.modo; pintar(); }));
    const form = $('[data-form]', contenedor);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('[data-error]', form);
      err.hidden = true;
      const btn = $('button[type="submit"]', form);
      btn.disabled = true;
      try {
        const email = $('#ac-email', form).value;
        if (modo === 'entrar') {
          await iniciarSesion(email, $('#ac-pass', form).value);
        } else if (modo === 'crear') {
          await crearCuenta(email, $('#ac-pass', form).value, $('#ac-nombre', form).value);
          toast('Cuenta creada. Revisa tu correo para verificarla.', 'ok', 5000);
        } else {
          await recuperarContrasena(email);
          toast('Si el correo existe, recibirás un enlace para restablecer la contraseña.', 'ok', 5000);
          modo = 'entrar';
          pintar();
        }
      } catch (ex) {
        err.textContent = mensajeError(ex);
        err.hidden = false;
      } finally {
        btn.disabled = false;
      }
    });
    $('#ac-email', contenedor).focus();
  };
  pintar();
}
