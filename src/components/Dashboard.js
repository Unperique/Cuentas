import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Users, 
  DollarSign, 
  LogOut, 
  Copy, 
  Check,
  Settings,
  Home,
  Trash2,
  User,
  Eye,
  EyeOff
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { 
  updateProfile, 
  updatePassword, 
  EmailAuthProvider, 
  reauthenticateWithCredential 
} from 'firebase/auth';
import { db } from '../firebase';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [copiedCode, setCopiedCode] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileData, setProfileData] = useState({
    displayName: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'rooms'),
      where('members', 'array-contains', currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const roomsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRooms(roomsData);
    });

    return () => unsubscribe();
  }, [currentUser]);

  async function handleLogout() {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      toast.error('Error al cerrar sesión');
    }
  }

  async function createRoom(e) {
    e.preventDefault();
    if (!roomName.trim()) return;

    try {
      const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      await addDoc(collection(db, 'rooms'), {
        name: roomName,
        code: roomCode,
        createdBy: currentUser.uid,
        members: [currentUser.uid],
        createdAt: serverTimestamp()
      });
      
      setRoomName('');
      setShowCreateRoom(false);
      toast.success('Sala creada exitosamente');
    } catch (error) {
      toast.error('Error al crear la sala');
    }
  }

  function copyCode(code) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success('Código copiado al portapapeles');
    setTimeout(() => setCopiedCode(null), 2000);
  }

  function joinRoom() {
    const code = prompt('Ingresa el código de la sala:');
    if (code) {
      navigate(`/join/${code.toUpperCase()}`);
    }
  }

  async function deleteRoom(roomId, roomName) {
    const confirmDelete = window.confirm(
      `¿Estás seguro de que quieres eliminar la sala "${roomName}"?\n\nEsta acción no se puede deshacer y eliminará todos los gastos asociados.`
    );
    
    if (!confirmDelete) return;

    try {
      // Primero, eliminar todos los gastos asociados a la sala
      const expensesQuery = query(
        collection(db, 'expenses'),
        where('roomId', '==', roomId)
      );
      
      const expensesSnapshot = await getDocs(expensesQuery);
      const deletePromises = expensesSnapshot.docs.map(expenseDoc => 
        deleteDoc(doc(db, 'expenses', expenseDoc.id))
      );
      
      await Promise.all(deletePromises);
      
      // Luego, eliminar la sala
      await deleteDoc(doc(db, 'rooms', roomId));
      
      toast.success('Sala y gastos eliminados exitosamente');
    } catch (error) {
      console.error('Error al eliminar la sala:', error);
      toast.error('Error al eliminar la sala');
    }
  }

  function openProfileModal() {
    setProfileData({
      displayName: currentUser?.displayName || '',
      email: currentUser?.email || '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setShowProfileModal(true);
  }

  function closeProfileModal() {
    setShowProfileModal(false);
    setProfileData({
      displayName: '',
      email: '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setShowPasswords({
      current: false,
      new: false,
      confirm: false
    });
  }

  async function updateUserProfile(e) {
    e.preventDefault();
    
    try {
      // Actualizar nombre si cambió
      if (profileData.displayName !== currentUser.displayName) {
        await updateProfile(currentUser, {
          displayName: profileData.displayName
        });
        
        // También actualizar en Firestore
        await updateDoc(doc(db, 'users', currentUser.uid), {
          displayName: profileData.displayName
        });
      }

      // Cambiar contraseña si se proporcionó
      if (profileData.newPassword) {
        if (profileData.newPassword !== profileData.confirmPassword) {
          toast.error('Las contraseñas nuevas no coinciden');
          return;
        }
        
        if (profileData.newPassword.length < 6) {
          toast.error('La contraseña debe tener al menos 6 caracteres');
          return;
        }

        if (!profileData.currentPassword) {
          toast.error('Debes ingresar tu contraseña actual para cambiarla');
          return;
        }

        // Reautenticar usuario
        const credential = EmailAuthProvider.credential(
          currentUser.email,
          profileData.currentPassword
        );
        
        await reauthenticateWithCredential(currentUser, credential);
        await updatePassword(currentUser, profileData.newPassword);
        
        toast.success('Contraseña actualizada exitosamente');
      }

      closeProfileModal();
      if (profileData.displayName !== currentUser.displayName) {
        toast.success('Perfil actualizado exitosamente');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      if (error.code === 'auth/wrong-password') {
        toast.error('La contraseña actual es incorrecta');
      } else if (error.code === 'auth/weak-password') {
        toast.error('La contraseña es muy débil');
      } else {
        toast.error('Error al actualizar el perfil');
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Home className="h-8 w-8 text-blue-600" />
              <h1 className="text-xl font-semibold text-gray-900">
                Compartir Gastos
              </h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Hola, {currentUser?.displayName || 'Usuario'}
              </span>
              <button
                onClick={openProfileModal}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
              >
                <User className="h-5 w-5" />
                <span>Mi Perfil</span>
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
              >
                <LogOut className="h-5 w-5" />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Salas Activas</p>
                <p className="text-2xl font-semibold text-gray-900">{rooms.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Gastos</p>
                <p className="text-2xl font-semibold text-gray-900">
                  ${rooms.reduce((total, room) => total + (room.totalExpenses || 0), 0).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Settings className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Deudas Pendientes</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {rooms.reduce((total, room) => total + (room.pendingDebts || 0), 0)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-4 mb-8">
          <button
            onClick={() => setShowCreateRoom(true)}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span>Crear Nueva Sala</span>
          </button>
          
          <button
            onClick={joinRoom}
            className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            <Users className="h-5 w-5" />
            <span>Unirse a Sala</span>
          </button>
        </div>

        {/* Create Room Modal */}
        {showCreateRoom && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">Crear Nueva Sala</h3>
              <form onSubmit={createRoom}>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="Nombre de la sala"
                  className="w-full p-3 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <div className="flex space-x-3">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
                  >
                    Crear
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateRoom(false)}
                    className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Profile Modal */}
        {showProfileModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-96 overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4">Mi Perfil</h3>
              <form onSubmit={updateUserProfile}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nombre
                    </label>
                    <input
                      type="text"
                      value={profileData.displayName}
                      onChange={(e) => setProfileData({...profileData, displayName: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Tu nombre"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={profileData.email}
                      className="w-full p-3 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                      disabled
                    />
                    <p className="text-xs text-gray-500 mt-1">El email no se puede cambiar</p>
                  </div>
                  
                  <div className="border-t pt-4">
                    <h4 className="text-md font-medium text-gray-900 mb-3">Cambiar Contraseña</h4>
                    <p className="text-xs text-gray-500 mb-3">Deja en blanco si no quieres cambiar tu contraseña</p>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Contraseña Actual
                        </label>
                        <div className="relative">
                          <input
                            type={showPasswords.current ? "text" : "password"}
                            value={profileData.currentPassword}
                            onChange={(e) => setProfileData({...profileData, currentPassword: e.target.value})}
                            className="w-full p-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Contraseña actual"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPasswords({...showPasswords, current: !showPasswords.current})}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                          >
                            {showPasswords.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Nueva Contraseña
                        </label>
                        <div className="relative">
                          <input
                            type={showPasswords.new ? "text" : "password"}
                            value={profileData.newPassword}
                            onChange={(e) => setProfileData({...profileData, newPassword: e.target.value})}
                            className="w-full p-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Nueva contraseña (mínimo 6 caracteres)"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPasswords({...showPasswords, new: !showPasswords.new})}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                          >
                            {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Confirmar Nueva Contraseña
                        </label>
                        <div className="relative">
                          <input
                            type={showPasswords.confirm ? "text" : "password"}
                            value={profileData.confirmPassword}
                            onChange={(e) => setProfileData({...profileData, confirmPassword: e.target.value})}
                            className="w-full p-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Confirmar nueva contraseña"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPasswords({...showPasswords, confirm: !showPasswords.confirm})}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                          >
                            {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex space-x-3 mt-6">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
                  >
                    Guardar Cambios
                  </button>
                  <button
                    type="button"
                    onClick={closeProfileModal}
                    className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Rooms List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map((room) => (
            <div key={room.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">{room.name}</h3>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => copyCode(room.code)}
                      className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700"
                    >
                      {copiedCode === room.code ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      <span>{room.code}</span>
                    </button>
                    
                    {/* Botón de eliminar solo para el creador */}
                    {room.createdBy === currentUser.uid && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteRoom(room.id, room.name);
                        }}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="Eliminar sala"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2 mb-4">
                  <p className="text-sm text-gray-600">
                    Miembros: {room.members?.length || 0}
                  </p>
                  <p className="text-sm text-gray-600">
                    Total: ${(room.totalExpenses || 0).toFixed(2)}
                  </p>
                </div>
                
                <button
                  onClick={() => navigate(`/room/${room.id}`)}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Ver Sala
                </button>
              </div>
            </div>
          ))}
        </div>

        {rooms.length === 0 && (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No tienes salas activas
            </h3>
            <p className="text-gray-600 mb-4">
              Crea una nueva sala o únete a una existente para empezar a compartir gastos
            </p>
            <button
              onClick={() => setShowCreateRoom(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Crear Primera Sala
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 