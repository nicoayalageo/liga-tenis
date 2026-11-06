// Tema claro / oscuro: respeta la preferencia del sistema y permite forzarla.

import { leerLocal, guardarLocal } from './util.js';

export function aplicarTema() {
  const guardado = leerLocal('tema', null);
  const root = document.documentElement;
  if (guardado === 'light' || guardado === 'dark') root.setAttribute('data-theme', guardado);
  else root.removeAttribute('data-theme');
}

export function temaActual() {
  const forzado = document.documentElement.getAttribute('data-theme');
  if (forzado) return forzado;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function alternarTema() {
  const nuevo = temaActual() === 'dark' ? 'light' : 'dark';
  guardarLocal('tema', nuevo);
  aplicarTema();
  return nuevo;
}

export function montarBotonTema(boton) {
  if (!boton) return;
  const pintar = () => {
    const oscuro = temaActual() === 'dark';
    boton.setAttribute('aria-label', oscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');
    boton.textContent = oscuro ? '☀' : '☾';
  };
  boton.addEventListener('click', () => { alternarTema(); pintar(); });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', pintar);
  pintar();
}
