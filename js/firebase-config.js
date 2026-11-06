// Configuración pública del proyecto Firebase.
// Estos valores no son secretos: identifican el proyecto. La seguridad la dan las reglas de Firestore
// y la restricción de la API key a los dominios del sitio en Google Cloud Console.
// Generado con: npx firebase-tools apps:sdkconfig WEB

export const firebaseConfig = {
  apiKey: 'AIzaSyDqgoKXj4ydSzLpRzrz3-cFF-CkThFY9Vo',
  authDomain: 'liga-tenis-arcilla.firebaseapp.com',
  projectId: 'liga-tenis-arcilla',
  storageBucket: 'liga-tenis-arcilla.firebasestorage.app',
  messagingSenderId: '380642022823',
  appId: '1:380642022823:web:2948f55614d82ee3685282',
};

export const FIREBASE_CONFIGURADO = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
