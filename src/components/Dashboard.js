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
  EyeOff,
  Wallet,
  TrendingUp,
  TrendingDown,
  Calendar
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

// Función para formatear moneda en pesos colombianos
function formatCurrency(amount) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

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
  const [personalTransactions, setPersonalTransactions] = useState([]);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionData, setTransactionData] = useState({
    type: 'income', // 'income' or 'expense'
    description: '',
    amount: '',
    category: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [activeTab, setActiveTab] = useState('personal'); // 'personal' or 'group'

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

  useEffect(() => {
    if (!currentUser) return;

    // Escuchar cambios en transacciones personales
    const transactionsQuery = query(
      collection(db, 'personalTransactions'),
      where('userId', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(transactionsQuery, (snapshot) => {
      const transactionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Ordenar por fecha (más reciente primero)
      transactionsData.sort((a, b) => {
        const dateA = a.date || '';
        const dateB = b.date || '';
        return dateB.localeCompare(dateA);
      });
      setPersonalTransactions(transactionsData);
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

  function openTransactionModal(type = 'income') {
    setTransactionData({
      type,
      description: '',
      amount: '',
      category: '',
      date: new Date().toISOString().split('T')[0]
    });
    setShowTransactionModal(true);
  }

  function closeTransactionModal() {
    setShowTransactionModal(false);
    setTransactionData({
      type: 'income',
      description: '',
      amount: '',
      category: '',
      date: new Date().toISOString().split('T')[0]
    });
  }

  async function addTransaction(e) {
    e.preventDefault();
    if (!transactionData.description || !transactionData.amount || !transactionData.category) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    try {
      await addDoc(collection(db, 'personalTransactions'), {
        userId: currentUser.uid,
        type: transactionData.type,
        description: transactionData.description,
        amount: parseFloat(transactionData.amount),
        category: transactionData.category,
        date: transactionData.date,
        createdAt: serverTimestamp()
      });

      closeTransactionModal();
      toast.success(`${transactionData.type === 'income' ? 'Ingreso' : 'Egreso'} agregado exitosamente`);
    } catch (error) {
      toast.error('Error al agregar la transacción');
    }
  }

  async function deleteTransaction(transactionId) {
    if (!window.confirm('¿Estás seguro de que quieres eliminar esta transacción?')) return;

    try {
      await deleteDoc(doc(db, 'personalTransactions', transactionId));
      toast.success('Transacción eliminada');
    } catch (error) {
      toast.error('Error al eliminar la transacción');
    }
  }

  // Calcular totales de cuentas personales
  const totalIncome = personalTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  
  const totalExpenses = personalTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  
  const balance = totalIncome - totalExpenses;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Home className="h-8 w-8 text-blue-600" />
              <h1 className="text-xl font-semibold text-gray-900">
                Gastos
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
        {/* Tabs Navigation */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('personal')}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === 'personal'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Wallet className="h-5 w-5" />
                <span>Finanzas Personales</span>
              </button>
              <button
                onClick={() => setActiveTab('group')}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === 'group'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Users className="h-5 w-5" />
                <span>Gastos Compartidos</span>
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'personal' ? (
          /* Contenido de Finanzas Personales */
          <div>
            {/* Estadísticas Personales */}
            <div className="mb-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg shadow p-6 border border-green-200">
                  <div className="flex items-center">
                    <TrendingUp className="h-8 w-8 text-green-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-green-700">Ingresos</p>
                      <p className="text-2xl font-semibold text-green-800">
                        {formatCurrency(totalIncome)}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-red-50 to-red-100 rounded-lg shadow p-6 border border-red-200">
                  <div className="flex items-center">
                    <TrendingDown className="h-8 w-8 text-red-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-red-700">Egresos</p>
                      <p className="text-2xl font-semibold text-red-800">
                        {formatCurrency(totalExpenses)}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className={`bg-gradient-to-r ${balance >= 0 ? 'from-emerald-50 to-emerald-100 border-emerald-200' : 'from-orange-50 to-orange-100 border-orange-200'} rounded-lg shadow p-6 border`}>
                  <div className="flex items-center">
                    <Wallet className={`h-8 w-8 ${balance >= 0 ? 'text-emerald-600' : 'text-orange-600'}`} />
                    <div className="ml-4">
                      <p className={`text-sm font-medium ${balance >= 0 ? 'text-emerald-700' : 'text-orange-700'}`}>Balance</p>
                      <p className={`text-2xl font-semibold ${balance >= 0 ? 'text-emerald-800' : 'text-orange-800'}`}>
                        {formatCurrency(balance)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Acciones Personales */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Acciones Rápidas</h3>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => openTransactionModal('income')}
                  className="flex items-center space-x-2 bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  <TrendingUp className="h-5 w-5" />
                  <span>Agregar Ingreso</span>
                </button>
                
                <button
                  onClick={() => openTransactionModal('expense')}
                  className="flex items-center space-x-2 bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors"
                >
                  <TrendingDown className="h-5 w-5" />
                  <span>Agregar Egreso</span>
                </button>
              </div>
            </div>

            {/* Transacciones Recientes */}
            {personalTransactions.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Calendar className="h-5 w-5 mr-2" />
                  Transacciones Recientes
                </h3>
                
                <div className="bg-white rounded-lg shadow border">
                  <div className="p-6">
                    <div className="grid gap-4">
                      {personalTransactions.slice(0, 5).map((transaction) => (
                        <div key={transaction.id} className={`p-4 rounded-lg border-l-4 ${
                          transaction.type === 'income' 
                            ? 'bg-green-50 border-l-green-500' 
                            : 'bg-red-50 border-l-red-500'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className={`p-2 rounded-full ${
                                transaction.type === 'income' ? 'bg-green-100' : 'bg-red-100'
                              }`}>
                                {transaction.type === 'income' ? (
                                  <TrendingUp className="h-5 w-5 text-green-600" />
                                ) : (
                                  <TrendingDown className="h-5 w-5 text-red-600" />
                                )}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">{transaction.description}</p>
                                <p className="text-sm text-gray-600">
                                  <span className={`inline-block px-2 py-1 rounded-full text-xs ${
                                    transaction.type === 'income' 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-red-100 text-red-800'
                                  }`}>
                                    {transaction.category}
                                  </span>
                                  <span className="ml-2">{new Date(transaction.date).toLocaleDateString('es-CO')}</span>
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-3">
                              <span className={`font-bold text-lg ${
                                transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                              </span>
                              <button
                                onClick={() => deleteTransaction(transaction.id)}
                                className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-100 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {personalTransactions.length > 5 && (
                      <div className="mt-6 text-center">
                        <div className="inline-flex items-center px-4 py-2 bg-gray-100 rounded-lg">
                          <Calendar className="h-4 w-4 text-gray-500 mr-2" />
                          <span className="text-sm text-gray-600 font-medium">
                            Mostrando 5 de {personalTransactions.length} transacciones
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Contenido de Gastos Compartidos */
          <div>
            {/* Estadísticas Grupales */}
            <div className="mb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg shadow p-6 border border-blue-200">
                  <div className="flex items-center">
                    <Home className="h-8 w-8 text-blue-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-blue-700">Salas Activas</p>
                      <p className="text-2xl font-semibold text-blue-800">{rooms.length}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-indigo-50 to-indigo-100 rounded-lg shadow p-6 border border-indigo-200">
                  <div className="flex items-center">
                    <DollarSign className="h-8 w-8 text-indigo-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-indigo-700">Total Gastado</p>
                      <p className="text-2xl font-semibold text-indigo-800">
                        {formatCurrency(rooms.reduce((total, room) => total + (room.totalExpenses || 0), 0))}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Acciones Grupales */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Acciones Rápidas</h3>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => setShowCreateRoom(true)}
                  className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-5 w-5" />
                  <span>Crear Nueva Sala</span>
                </button>
                
                <button
                  onClick={joinRoom}
                  className="flex items-center space-x-2 bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Users className="h-5 w-5" />
                  <span>Unirse a Sala</span>
                </button>
              </div>
            </div>

            {/* Lista de Salas */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Home className="h-5 w-5 mr-2" />
                Mis Salas de Gastos
              </h3>
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
                          Total: {formatCurrency(room.totalExpenses || 0)}
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
        )}

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

        {/* Transaction Modal */}
        {showTransactionModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">
                {transactionData.type === 'income' ? 'Agregar Ingreso' : 'Agregar Egreso'}
              </h3>
              <form onSubmit={addTransaction}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tipo
                    </label>
                    <select
                      value={transactionData.type}
                      onChange={(e) => setTransactionData({...transactionData, type: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="income">Ingreso</option>
                      <option value="expense">Egreso</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Descripción
                    </label>
                    <input
                      type="text"
                      value={transactionData.description}
                      onChange={(e) => setTransactionData({...transactionData, description: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ej: Salario, Compras, etc."
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Monto (COP)
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={transactionData.amount}
                      onChange={(e) => setTransactionData({...transactionData, amount: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Categoría
                    </label>
                    <select
                      value={transactionData.category}
                      onChange={(e) => setTransactionData({...transactionData, category: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Seleccionar categoría</option>
                      {transactionData.type === 'income' ? (
                        <>
                          <option value="Salario">Salario</option>
                          <option value="Freelance">Freelance</option>
                          <option value="Inversiones">Inversiones</option>
                          <option value="Ventas">Ventas</option>
                          <option value="Otros ingresos">Otros ingresos</option>
                        </>
                      ) : (
                        <>
                          <option value="Alimentación">Alimentación</option>
                          <option value="Transporte">Transporte</option>
                          <option value="Servicios">Servicios</option>
                          <option value="Entretenimiento">Entretenimiento</option>
                          <option value="Salud">Salud</option>
                          <option value="Educación">Educación</option>
                          <option value="Compras">Compras</option>
                          <option value="Otros gastos">Otros gastos</option>
                        </>
                      )}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Fecha
                    </label>
                    <input
                      type="date"
                      value={transactionData.date}
                      onChange={(e) => setTransactionData({...transactionData, date: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>
                
                <div className="flex space-x-3 mt-6">
                  <button
                    type="submit"
                    className={`flex-1 text-white py-2 px-4 rounded-lg transition-colors ${
                      transactionData.type === 'income' 
                        ? 'bg-emerald-600 hover:bg-emerald-700' 
                        : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    Agregar {transactionData.type === 'income' ? 'Ingreso' : 'Egreso'}
                  </button>
                  <button
                    type="button"
                    onClick={closeTransactionModal}
                    className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}


      </div>
    </div>
  );
} 