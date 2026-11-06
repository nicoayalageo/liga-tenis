// Configuración pública del proyecto Firebase.
// Estos valores no son secretos: identifican el proyecto. La seguridad la dan las reglas de Firestore
// y la restricción de la API key a los dominios del sitio en Google Cloud Console.
// Se completa con: npx firebase-tools apps:sdkconfig web

export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

export const FIREBASE_CONFIGURADO = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
