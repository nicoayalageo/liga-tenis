# Liga de Tenis en Arcilla

Sitio público para llevar una liga de tenis: tabla de posiciones, resultados, calendario por jornadas, llave de playoffs y fichas de jugadores. Los jugadores cargan sus resultados desde la página y el administrador los aprueba antes de que cuenten.

- **Sitio**: alojado en GitHub Pages (archivos estáticos, sin servidor propio).
- **Datos**: Cloud Firestore (Firebase). La tabla se calcula en el navegador a partir de los partidos aprobados.
- **Acceso**: administradores con correo y contraseña (Firebase Authentication); jugadores con sesión anónima y el PIN de la liga.

## Estructura

```
index.html            Página pública
admin.html            Administración (requiere cuenta de administrador)
css/                  Estilos (tokens de color, base, componentes, administración)
js/core/              Lógica pura sin dependencias: formatos, validación de marcadores, estadísticas, tabla, calendario, playoffs, modelo
js/db.js              Conexión a Firestore y suscripciones en tiempo real
js/auth.js            Sesión de administradores y jugadores
js/store.js           Escrituras en Firestore (resultados, propuestas, jugadores, configuración, historial)
js/ui/                Vistas de la página pública y de la administración
js/demo-data.js       Datos de ejemplo para previsualizar sin Firebase
firestore.rules       Reglas de seguridad
tests/                Pruebas del núcleo (node --test)
```

## Cómo funciona

1. El administrador configura la liga en `admin.html` → Configuración: nombre, formato de liga (todos contra todos a 1 o 2 vueltas, liga libre, con o sin playoffs), formato de partido (2 sets + super tiebreak, mejor de 3, 1 set, mejor de 5, libre), puntos por victoria y derrota, criterios de desempate (presets USTA/ATP, ITF, universitario o un orden propio) y el PIN para los jugadores.
2. Agrega jugadores y genera el calendario (método del círculo; con número impar hay un "libre" por jornada).
3. Un jugador pulsa **Cargar resultado** en la página pública, elige rival, marcador y escribe el PIN. El envío queda **pendiente**.
4. El administrador lo ve en **Pendientes** y lo aprueba, lo edita y aprueba, o lo rechaza con un motivo. Solo entonces el partido se publica y la tabla cambia, al instante para todos.
5. Todo cambio queda en **Historial**. El botón **Exportar respaldo** descarga la liga completa en JSON.

Los administradores adicionales crean su cuenta en `admin.html`, verifican su correo y pulsan **Solicitar acceso**; el propietario aprueba desde **Administradores**.

## Desarrollo

```bash
npm test                      # pruebas del núcleo
npm run check                 # sintaxis de los módulos del navegador
python3 -m http.server 8080   # servir en local
```

Vista previa sin Firebase: `http://localhost:8080/index.html?demo=1` y `http://localhost:8080/admin.html?demo=1&tab=config`.

## Puesta en marcha de Firebase

1. `npx firebase-tools login`
2. Crear el proyecto y la app web; copiar la configuración en `js/firebase-config.js` (`npx firebase-tools apps:sdkconfig web`).
3. Crear la base de datos Firestore (modo producción) y desplegar reglas e índices: `npx firebase-tools deploy --only firestore`.
4. En la consola de Firebase → Authentication: habilitar **Correo electrónico/contraseña** y **Anónimo**; en *Dominios autorizados* agregar el dominio de GitHub Pages.
5. El correo del propietario está fijado en `firestore.rules` (`emailPropietario`). Al crear esa cuenta en `admin.html` y verificar el correo, queda como primer administrador automáticamente.
6. Recomendado: en Google Cloud Console restringir la clave de API web a los dominios del sitio.

## Licencia

Todos los derechos reservados. Ver `LICENSE`.
