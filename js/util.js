// Utilidades de presentación compartidas por la página pública y la de administración.

export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Plantilla que escapa automáticamente las interpolaciones. Usa raw() para insertar HTML ya seguro. */
export function h(strings, ...values) {
  let out = '';
  strings.forEach((str, i) => {
    out += str;
    if (i < values.length) {
      const v = values[i];
      if (v && v.__raw) out += v.__raw;
      else if (Array.isArray(v)) out += v.map((x) => (x && x.__raw ? x.__raw : escapeHtml(x))).join('');
      else out += escapeHtml(v);
    }
  });
  return { __raw: out, toString() { return out; } };
}

export function raw(html) {
  return { __raw: String(html) };
}

export function $(sel, root = document) {
  return root.querySelector(sel);
}

export function $$(sel, root = document) {
  return [...root.querySelectorAll(sel)];
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** "2026-04-12" → "12 abr 2026". */
export function fmtFecha(s, largo = false) {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return s || '';
  const [y, m, d] = s.split('-').map(Number);
  if (!largo) return `${d} ${MESES[m - 1]} ${y}`;
  const dt = new Date(y, m - 1, d);
  return `${DIAS[dt.getDay()]} ${d} de ${MESES_LARGO[m - 1]} de ${y}`;
}

/** "2026-03" → "Marzo 2026". */
export function fmtMes(s) {
  if (!s || !/^\d{4}-\d{2}/.test(s)) return s || '';
  const [y, m] = s.split('-').map(Number);
  const nombre = MESES_LARGO[m - 1] || '';
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${y}`;
}

/** ISO o Date → "12 abr 2026, 23:10". */
export function fmtFechaHora(v) {
  if (!v) return '';
  const d = v instanceof Date ? v : (typeof v.toDate === 'function' ? v.toDate() : new Date(v));
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`;
}

/** Tiempo relativo: "hace 2 min". */
export function hace(v) {
  if (!v) return '';
  const d = v instanceof Date ? v : (typeof v.toDate === 'function' ? v.toDate() : new Date(v));
  const s = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
  if (s < 45) return 'hace instantes';
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const hrs = Math.round(m / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const dias = Math.round(hrs / 24);
  if (dias < 30) return `hace ${dias} d`;
  return fmtFechaHora(d);
}

export function fmtPct(x) {
  if (!Number.isFinite(x)) return '–';
  return `${Math.round(x * 100)}%`;
}

export function fmtDif(x) {
  if (!Number.isFinite(x)) return '–';
  return x > 0 ? `+${x}` : String(x);
}

export function nombreJugador(liga, id) {
  const j = (liga.jugadores || []).find((x) => x.id === id);
  return j ? j.nombre : '—';
}

export function iniciales(nombre) {
  return String(nombre || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

export function debounce(fn, ms = 200) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function claveLocal(k) {
  return `ligaTenis.${k}`;
}

export function leerLocal(k, porDefecto = null) {
  try {
    const v = localStorage.getItem(claveLocal(k));
    return v === null ? porDefecto : JSON.parse(v);
  } catch {
    return porDefecto;
  }
}

export function guardarLocal(k, v) {
  try {
    localStorage.setItem(claveLocal(k), JSON.stringify(v));
  } catch {
    // Almacenamiento no disponible: se ignora.
  }
}
