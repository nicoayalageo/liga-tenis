// Notificador por correo de la liga de tenis.
//
// Se ejecuta en Google Apps Script (script.google.com) con la cuenta del propietario del proyecto Firebase.
// Cada cierto tiempo revisa en Firestore las inscripciones y los resultados pendientes que todavía no
// se han avisado, envía un correo al administrador con el resumen y marca cada documento como avisado.
//
// No expone ningún punto de entrada público: lee Firestore con el permiso de tu propia cuenta de Google
// (que es propietaria del proyecto), por lo que nadie puede provocar envíos desde fuera.
//
// Instalación: ver README.md, sección "Avisos por correo".

var PROYECTO = 'liga-tenis-arcilla';
var CORREO_DESTINO = 'nicolas.ayala@ug.uchile.cl';
var URL_ADMIN = 'https://nicoayalageo.github.io/liga-tenis/admin.html';
var ASUNTO = 'Liga de tenis: hay novedades por aprobar';

var BASE = 'https://firestore.googleapis.com/v1/projects/' + PROYECTO + '/databases/(default)/documents';

function revisarPendientes() {
  var inscripciones = pendientesSinAviso_('inscripciones', 'estado');
  var propuestas = pendientesSinAviso_('propuestas', 'estadoPropuesta');
  if (inscripciones.length === 0 && propuestas.length === 0) return;

  var jugadores = nombresJugadores_();
  var lineas = [];

  if (inscripciones.length) {
    lineas.push(inscripciones.length === 1 ? 'Nueva inscripción:' : 'Nuevas inscripciones (' + inscripciones.length + '):');
    inscripciones.forEach(function (d) {
      var f = d.campos;
      var linea = '  - ' + f.nombre;
      if (f.contacto) linea += ' · ' + f.contacto;
      if (f.mensaje) linea += ' · "' + f.mensaje + '"';
      lineas.push(linea);
    });
    lineas.push('');
  }

  if (propuestas.length) {
    lineas.push(propuestas.length === 1 ? 'Nuevo resultado por aprobar:' : 'Nuevos resultados por aprobar (' + propuestas.length + '):');
    propuestas.forEach(function (d) {
      var f = d.campos;
      var j1 = jugadores[f.jugador1] || f.jugador1;
      var j2 = jugadores[f.jugador2] || f.jugador2;
      lineas.push('  - ' + j1 + ' vs ' + j2 + ' · ' + marcador_(f) + ' · ' + (f.fecha || ''));
    });
    lineas.push('');
  }

  lineas.push('Apruébalos o recházalos en: ' + URL_ADMIN);
  MailApp.sendEmail({ to: CORREO_DESTINO, subject: ASUNTO, body: lineas.join('\n') });

  inscripciones.concat(propuestas).forEach(function (d) { marcarAvisado_(d.nombre); });
}

// ---------- Firestore ----------

function cabeceras_() {
  return { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() };
}

function pendientesSinAviso_(coleccion, campoEstado) {
  var cuerpo = {
    structuredQuery: {
      from: [{ collectionId: coleccion }],
      where: { fieldFilter: { field: { fieldPath: campoEstado }, op: 'EQUAL', value: { stringValue: 'pendiente' } } },
      limit: 50,
    },
  };
  var resp = UrlFetchApp.fetch(BASE + ':runQuery', {
    method: 'post',
    contentType: 'application/json',
    headers: cabeceras_(),
    payload: JSON.stringify(cuerpo),
    muteHttpExceptions: true,
  });
  if (resp.getResponseCode() !== 200) throw new Error('Firestore respondió ' + resp.getResponseCode() + ': ' + resp.getContentText());
  var filas = JSON.parse(resp.getContentText());
  var salida = [];
  filas.forEach(function (fila) {
    if (!fila.document) return;
    var campos = aPlano_(fila.document.fields || {});
    if (campos.avisado === true) return;
    salida.push({ nombre: fila.document.name, campos: campos });
  });
  return salida;
}

function nombresJugadores_() {
  var resp = UrlFetchApp.fetch(BASE + '/jugadores?pageSize=300', { headers: cabeceras_(), muteHttpExceptions: true });
  var mapa = {};
  if (resp.getResponseCode() !== 200) return mapa;
  var datos = JSON.parse(resp.getContentText());
  (datos.documents || []).forEach(function (d) {
    var id = d.name.split('/').pop();
    mapa[id] = aPlano_(d.fields || {}).nombre || id;
  });
  return mapa;
}

function marcarAvisado_(nombreDoc) {
  UrlFetchApp.fetch('https://firestore.googleapis.com/v1/' + nombreDoc + '?updateMask.fieldPaths=avisado', {
    method: 'patch',
    contentType: 'application/json',
    headers: cabeceras_(),
    payload: JSON.stringify({ fields: { avisado: { booleanValue: true } } }),
    muteHttpExceptions: true,
  });
}

// Convierte el formato de valores de la API REST de Firestore a objetos simples.
function aPlano_(fields) {
  var out = {};
  Object.keys(fields).forEach(function (k) { out[k] = valor_(fields[k]); });
  return out;
}

function valor_(v) {
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.timestampValue !== undefined) return v.timestampValue;
  if (v.nullValue !== undefined) return null;
  if (v.arrayValue) return (v.arrayValue.values || []).map(valor_);
  if (v.mapValue) return aPlano_(v.mapValue.fields || {});
  return null;
}

function marcador_(p) {
  var sets = (p.sets || []).map(function (s) {
    if (Array.isArray(s)) return s.join('-');
    if (s && typeof s === 'object' && Array.isArray(s._l)) return s._l.join('-'); // lista anidada envuelta (ver js/core/firestore-codec.js)
    return String(s);
  });
  var texto = sets.join(' ');
  if (p.estado === 'retiro') texto += ' (retiro)';
  if (p.estado === 'wo') texto = 'W.O.';
  return texto || '(sin marcador)';
}

// ---------- Instalación ----------

/** Ejecuta esta función una vez desde el editor para autorizar los permisos y crear el disparador. */
function instalar() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'revisarPendientes') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('revisarPendientes').timeBased().everyMinutes(10).create();
  revisarPendientes();
  Logger.log('Listo: se revisará cada 10 minutos y se avisará a ' + CORREO_DESTINO);
}
