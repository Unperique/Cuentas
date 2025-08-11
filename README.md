# Compartir Gastos - Aplicación Web

Una aplicación web moderna para dividir gastos entre amigos con sincronización en tiempo real usando Firebase.

## 🚀 Características

- **Autenticación de usuarios** con Firebase Auth
- **Sistema de salas** con códigos de invitación únicos
- **Gestión de gastos** en tiempo real
- **Cálculo automático de deudas** entre miembros
- **Interfaz moderna y responsive** con Tailwind CSS
- **Sincronización en tiempo real** con Firestore
- **Notificaciones** con react-hot-toast

## 📋 Requisitos Previos

- Node.js (versión 14 o superior)
- npm o yarn
- Cuenta de Firebase

## 🛠️ Instalación

1. **Clona el repositorio:**
```bash
git clone <tu-repositorio>
cd compartirGastos
```

2. **Instala las dependencias:**
```bash
npm install
```

3. **Configura Firebase:**
   - Ve a [Firebase Console](https://console.firebase.google.com/)
   - Crea un nuevo proyecto
   - Habilita Authentication con Email/Password
   - Crea una base de datos Firestore
   - Obtén las credenciales de configuración

4. **Configura las credenciales de Firebase:**
   - Abre `src/firebase.js`
   - Reemplaza la configuración con tus credenciales:

```javascript
const firebaseConfig = {
  apiKey: "tu-api-key",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "123456789",
  appId: "tu-app-id"
};
```

5. **Configura las reglas de Firestore:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Usuarios pueden leer/escribir sus propios datos
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Miembros de una sala pueden leer/escribir datos de la sala
    match /rooms/{roomId} {
      allow read, write: if request.auth != null && 
        request.auth.uid in resource.data.members;
    }
    
    // Miembros de una sala pueden leer/escribir gastos
    match /expenses/{expenseId} {
      allow read, write: if request.auth != null && 
        request.auth.uid in get(/databases/$(database)/documents/rooms/$(resource.data.roomId)).data.members;
    }
  }
}
```

6. **Inicia la aplicación:**
```bash
npm start
```

La aplicación estará disponible en `http://localhost:3000`

## 📱 Uso de la Aplicación

### 1. Registro e Inicio de Sesión
- Crea una cuenta nueva o inicia sesión con tu email y contraseña
- La aplicación te redirigirá automáticamente al dashboard

### 2. Dashboard Principal
- **Crear Sala**: Crea una nueva sala para compartir gastos
- **Unirse a Sala**: Únete a una sala existente usando el código de invitación
- **Ver Salas**: Lista de todas las salas de las que eres miembro
- **Estadísticas**: Resumen de gastos totales y deudas pendientes

### 3. Gestión de Salas
- **Código de Invitación**: Cada sala tiene un código único de 6 caracteres
- **Copiar Código**: Haz clic en el código para copiarlo al portapapeles
- **Compartir**: Envía el código a tus amigos para que se unan

### 4. Gestión de Gastos
- **Agregar Gasto**: Registra un nuevo gasto con descripción, monto y participantes
- **Dividir Gastos**: Selecciona quién pagó y entre quiénes se divide
- **Ver Balance**: Consulta el balance de deudas en tiempo real
- **Eliminar Gastos**: Solo el creador puede eliminar gastos

### 5. Cálculo de Deudas
- **Balance Automático**: La aplicación calcula automáticamente quién debe a quién
- **Tiempo Real**: Los cambios se reflejan inmediatamente para todos los miembros
- **Equitativo**: Los gastos se dividen equitativamente entre los participantes seleccionados

## 🏗️ Estructura del Proyecto

```
src/
├── components/          # Componentes React
│   ├── Login.js        # Página de autenticación
│   ├── Dashboard.js    # Dashboard principal
│   ├── Room.js         # Gestión de sala y gastos
│   ├── JoinRoom.js     # Unirse a sala con código
│   └── PrivateRoute.js # Protección de rutas
├── contexts/           # Contextos de React
│   └── AuthContext.js  # Contexto de autenticación
├── firebase.js         # Configuración de Firebase
├── App.js             # Componente principal
├── index.js           # Punto de entrada
└── index.css          # Estilos globales
```

## 🔧 Tecnologías Utilizadas

- **React 18** - Biblioteca de interfaz de usuario
- **Firebase** - Backend como servicio
  - Authentication - Autenticación de usuarios
  - Firestore - Base de datos en tiempo real
- **React Router** - Enrutamiento de la aplicación
- **Tailwind CSS** - Framework de estilos
- **Lucide React** - Iconos
- **React Hot Toast** - Notificaciones

## 🚀 Despliegue

### Firebase Hosting
1. Instala Firebase CLI:
```bash
npm install -g firebase-tools
```

2. Inicia sesión en Firebase:
```bash
firebase login
```

3. Inicializa Firebase en tu proyecto:
```bash
firebase init hosting
```

4. Construye la aplicación:
```bash
npm run build
```

5. Despliega:
```bash
firebase deploy
```

### Netlify
1. Conecta tu repositorio a Netlify
2. Configura el comando de build: `npm run build`
3. Configura el directorio de publicación: `build`
4. Agrega las variables de entorno de Firebase

## 🔒 Seguridad

- Autenticación requerida para todas las operaciones
- Reglas de Firestore para proteger datos
- Validación de entrada en formularios
- Verificación de permisos de usuario

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.

## 🆘 Soporte

Si tienes problemas o preguntas:

1. Revisa la documentación de Firebase
2. Verifica que las reglas de Firestore estén configuradas correctamente
3. Asegúrate de que todas las dependencias estén instaladas
4. Abre un issue en el repositorio

## 🎯 Próximas Características

- [ ] Notificaciones push
- [ ] Exportar reportes a PDF
- [ ] Categorías de gastos
- [ ] Fotos de comprobantes
- [ ] Historial de pagos
- [ ] Múltiples monedas
- [ ] Modo offline 