// Firestore no admite una lista directamente dentro de otra lista.
// Antes de escribir, cada lista anidada se envuelve en un mapa { _l: [...] }; al leer se desenvuelve.
// Así los sets [[6,4],[3,6]] y las jornadas del calendario [[[a,b],[c,d]], ...] viajan sin cambios para el resto del código.

function esObjetoPlano(v) {
  if (v === null || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

export function codificar(v) {
  if (Array.isArray(v)) {
    return v.map((el) => (Array.isArray(el) ? { _l: codificar(el) } : codificar(el)));
  }
  if (esObjetoPlano(v)) {
    const out = {};
    for (const k of Object.keys(v)) out[k] = codificar(v[k]);
    return out;
  }
  return v;
}

export function decodificar(v) {
  if (Array.isArray(v)) return v.map(decodificar);
  if (esObjetoPlano(v)) {
    const claves = Object.keys(v);
    if (claves.length === 1 && claves[0] === '_l' && Array.isArray(v._l)) return decodificar(v._l);
    const out = {};
    for (const k of claves) out[k] = decodificar(v[k]);
    return out;
  }
  return v;
}
