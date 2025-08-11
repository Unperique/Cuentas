import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAtV-4J--e_EWws5PyN-gIsEjbZBBdE2rc",
  authDomain: "ubiko-395fd.firebaseapp.com",
  projectId: "ubiko-395fd",
  storageBucket: "ubiko-395fd.firebasestorage.app",
  messagingSenderId: "323799153344",
  appId: "1:323799153344:web:8897d509f62e569ceb0b25",
  measurementId: "G-461BNFNVDM"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Obtener servicios
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app; 