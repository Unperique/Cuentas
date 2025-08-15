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
  Calendar,
  CreditCard,
  Banknote,
  Gift,
  Edit3,
  Target,
  PiggyBank,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Repeat,
  Clock,
  Zap
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

// Función para obtener fecha local en formato YYYY-MM-DD
function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Función para formatear fecha correctamente evitando desfase de zona horaria
function formatDateString(dateString) {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-');
  const date = new Date(year, month - 1, day); // month - 1 porque JavaScript usa 0-based months
  return date.toLocaleDateString('es-CO');
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
    date: getLocalDateString(),
    paymentMethod: 'efectivo', // 'efectivo', 'tarjeta', 'puntos'
    balance: 'principal' // balance seleccionado
  });
  const [activeTab, setActiveTab] = useState('personal'); // 'personal' or 'group'
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [balances, setBalances] = useState([]);
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [editingBalance, setEditingBalance] = useState(null);
  const [balanceData, setBalanceData] = useState({
    name: '',
    type: 'savings', // 'savings', 'debt', 'general'
    description: '',
    goal: ''
  });
  
  // Estados para transacciones automáticas
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [recurringData, setRecurringData] = useState({
    type: 'income', // 'income' or 'expense'
    description: '',
    amount: '',
    category: '',
    paymentMethod: 'efectivo',
    balance: 'principal',
    frequency: 'monthly', // 'monthly', 'weekly', 'daily'
    dayOfMonth: 1, // día del mes para ejecutar
    isActive: true
  });
  const [recurringTransactions, setRecurringTransactions] = useState([]);
  
  // Estados para pestañas de filtros
  const [recurringFilter, setRecurringFilter] = useState('all'); // 'all', 'income', 'expense'
  const [recentFilter, setRecentFilter] = useState('all'); // 'all', 'income', 'expense'
  
  // Estados para paginación
  const [currentPage, setCurrentPage] = useState(1);
  const transactionsPerPage = 8;
  
  // Estados para loading
  const [isLoadingTransaction, setIsLoadingTransaction] = useState(false);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isLoadingRoom, setIsLoadingRoom] = useState(false);

  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'rooms'),
      where('members', 'array-contains', currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const roomsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Calcular el total de gastos para cada sala
      const roomsWithExpenses = await Promise.all(
        roomsData.map(async (room) => {
          try {
            const expensesQuery = query(
              collection(db, 'expenses'),
              where('roomId', '==', room.id)
            );
            const expensesSnapshot = await getDocs(expensesQuery);
            const expenses = expensesSnapshot.docs.map(doc => doc.data());
            
            const totalExpenses = expenses.reduce((total, expense) => {
              return total + (parseFloat(expense.amount) || 0);
            }, 0);

            return {
              ...room,
              totalExpenses
            };
          } catch (error) {
            console.error('Error calculating expenses for room:', room.id, error);
            return {
              ...room,
              totalExpenses: 0
            };
          }
        })
      );

      setRooms(roomsWithExpenses);
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

  useEffect(() => {
    if (!currentUser) return;

    // Escuchar cambios en balances/bolsillos
    const balancesQuery = query(
      collection(db, 'balances'),
      where('userId', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(balancesQuery, (snapshot) => {
      const balancesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setBalances(balancesData);
    });

    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    // Escuchar cambios en transacciones recurrentes
    const recurringQuery = query(
      collection(db, 'recurringTransactions'),
      where('userId', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(recurringQuery, (snapshot) => {
      const recurringData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRecurringTransactions(recurringData);
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

  function openTransactionModal(type = 'income', transaction = null) {
    if (transaction) {
      // Modo edición
      setEditingTransaction(transaction);
      setTransactionData({
        type: transaction.type,
        description: transaction.description,
        amount: transaction.amount.toString(),
        category: transaction.category,
        date: transaction.date,
        paymentMethod: transaction.paymentMethod || 'efectivo',
        balance: transaction.balance || 'principal'
      });
    } else {
      // Modo creación
      setEditingTransaction(null);
      setTransactionData({
        type,
        description: '',
        amount: '',
        category: '',
        date: getLocalDateString(),
        paymentMethod: 'efectivo',
        balance: 'principal'
      });
    }
    setShowTransactionModal(true);
  }

  function closeTransactionModal() {
    setShowTransactionModal(false);
    setEditingTransaction(null);
    setTransactionData({
      type: 'income',
      description: '',
      amount: '',
      category: '',
      date: getLocalDateString(),
      paymentMethod: 'efectivo',
      balance: 'principal'
    });
  }

  async function addTransaction(e) {
    e.preventDefault();
    if (isLoadingTransaction) return; // Prevenir múltiples clicks
    
    if (!transactionData.description || !transactionData.amount || !transactionData.category) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    setIsLoadingTransaction(true);
    try {
      const transactionObj = {
        userId: currentUser.uid,
        type: transactionData.type,
        description: transactionData.description,
        amount: parseFloat(transactionData.amount),
        category: transactionData.category,
        date: transactionData.date,
        paymentMethod: transactionData.paymentMethod,
        balance: transactionData.balance,
        updatedAt: serverTimestamp()
      };

      if (editingTransaction) {
        // Actualizar transacción existente
        await updateDoc(doc(db, 'personalTransactions', editingTransaction.id), transactionObj);
        toast.success('Transacción actualizada exitosamente');
      } else {
        // Crear nueva transacción
        transactionObj.createdAt = serverTimestamp();
        await addDoc(collection(db, 'personalTransactions'), transactionObj);
        toast.success(`${transactionData.type === 'income' ? 'Ingreso' : 'Egreso'} agregado exitosamente`);
      }

      closeTransactionModal();
    } catch (error) {
      toast.error(editingTransaction ? 'Error al actualizar la transacción' : 'Error al agregar la transacción');
    } finally {
      setIsLoadingTransaction(false);
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

  // Calcular totales por método de pago (solo egresos)
  const paymentMethodTotals = personalTransactions
    .filter(t => t.type === 'expense')
    .reduce((totals, t) => {
      const method = t.paymentMethod || 'efectivo';
      totals[method] = (totals[method] || 0) + (t.amount || 0);
      return totals;
    }, {});

  // Calcular montos actuales de cada balance basado en transacciones
  const balancesWithCurrentAmount = balances.map(balance => {
    const balanceTransactions = personalTransactions.filter(t => t.balance === balance.id);
    
    const currentAmount = balanceTransactions.reduce((total, transaction) => {
      if (transaction.type === 'income') {
        return total + (transaction.amount || 0);
      } else if (transaction.type === 'expense') {
        return total - (transaction.amount || 0);
      }
      return total;
    }, 0);

    return {
      ...balance,
      currentAmount: Math.max(0, currentAmount) // No permitir valores negativos para ahorros
    };
  });

  // Filtrado de transacciones recurrentes
  const filteredRecurringTransactions = recurringTransactions.filter(transaction => {
    if (recurringFilter === 'all') return true;
    return transaction.type === recurringFilter;
  });

  // Filtrado de transacciones recientes
  const filteredRecentTransactions = personalTransactions.filter(transaction => {
    if (recentFilter === 'all') return true;
    return transaction.type === recentFilter;
  });

  // Lógica de paginación (aplicada a transacciones filtradas)
  const totalPages = Math.ceil(filteredRecentTransactions.length / transactionsPerPage);
  const startIndex = (currentPage - 1) * transactionsPerPage;
  const endIndex = startIndex + transactionsPerPage;
  const currentTransactions = filteredRecentTransactions.slice(startIndex, endIndex);

  const goToPage = (page) => {
    setCurrentPage(page);
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  // Funciones para cambiar filtros (resetea paginación)
  const setRecurringFilterAndResetPage = (filter) => {
    setRecurringFilter(filter);
  };

  const setRecentFilterAndResetPage = (filter) => {
    setRecentFilter(filter);
    setCurrentPage(1); // Reset pagination when filter changes
  };

  // Funciones para manejar balances/bolsillos
  function openBalanceModal(balance = null) {
    if (balance) {
      // Modo edición
      setEditingBalance(balance);
      setBalanceData({
        name: balance.name,
        type: balance.type,
        description: balance.description,
        goal: balance.goal || ''
      });
    } else {
      // Modo creación
      setEditingBalance(null);
      setBalanceData({
        name: '',
        type: 'savings',
        description: '',
        goal: ''
      });
    }
    setShowBalanceModal(true);
  }

  function closeBalanceModal() {
    setShowBalanceModal(false);
    setEditingBalance(null);
    setBalanceData({
      name: '',
      type: 'savings',
      description: '',
      goal: ''
    });
  }

  async function addBalance(e) {
    e.preventDefault();
    if (isLoadingBalance) return; // Prevenir múltiples clicks
    
    if (!balanceData.name || !balanceData.description) {
      toast.error('Por favor completa todos los campos obligatorios');
      return;
    }

    setIsLoadingBalance(true);
    try {
      if (editingBalance) {
        // Modo edición - actualizar balance existente
        await updateDoc(doc(db, 'balances', editingBalance.id), {
          name: balanceData.name,
          type: balanceData.type,
          description: balanceData.description,
          goal: balanceData.goal ? parseFloat(balanceData.goal) : null,
          updatedAt: serverTimestamp()
        });
        toast.success('Balance actualizado exitosamente');
      } else {
        // Modo creación - crear nuevo balance
        await addDoc(collection(db, 'balances'), {
          userId: currentUser.uid,
          name: balanceData.name,
          type: balanceData.type,
          description: balanceData.description,
          goal: balanceData.goal ? parseFloat(balanceData.goal) : null,
          currentAmount: 0,
          createdAt: serverTimestamp()
        });
        toast.success('Balance creado exitosamente');
      }

      closeBalanceModal();
    } catch (error) {
      toast.error(editingBalance ? 'Error al actualizar el balance' : 'Error al crear el balance');
    } finally {
      setIsLoadingBalance(false);
    }
  }

  async function deleteBalance(balanceId) {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este balance?')) return;

    try {
      await deleteDoc(doc(db, 'balances', balanceId));
      toast.success('Balance eliminado');
    } catch (error) {
      toast.error('Error al eliminar el balance');
    }
  }

  // Función para obtener el ícono del método de pago
  function getPaymentMethodIcon(method) {
    switch (method) {
      case 'tarjeta':
        return <CreditCard className="h-4 w-4" />;
      case 'efectivo':
        return <Banknote className="h-4 w-4" />;
      case 'puntos':
        return <Gift className="h-4 w-4" />;
      default:
        return <Banknote className="h-4 w-4" />;
    }
  }

  // Función para obtener el ícono del tipo de balance
  function getBalanceTypeIcon(type) {
    switch (type) {
      case 'savings':
        return <PiggyBank className="h-5 w-5" />;
      case 'debt':
        return <AlertTriangle className="h-5 w-5" />;
      case 'general':
        return <Wallet className="h-5 w-5" />;
      default:
        return <Wallet className="h-5 w-5" />;
    }
  }

  // Funciones para transacciones recurrentes
  function openRecurringModal(type = 'income') {
    setRecurringData({
      type,
      description: '',
      amount: '',
      category: '',
      paymentMethod: 'efectivo',
      balance: 'principal',
      frequency: 'monthly',
      dayOfMonth: 1,
      isActive: true
    });
    setShowRecurringModal(true);
  }

  function closeRecurringModal() {
    setShowRecurringModal(false);
    setRecurringData({
      type: 'income',
      description: '',
      amount: '',
      category: '',
      paymentMethod: 'efectivo',
      balance: 'principal',
      frequency: 'monthly',
      dayOfMonth: 1,
      isActive: true
    });
  }

  async function addRecurringTransaction(e) {
    e.preventDefault();
    if (!recurringData.description || !recurringData.amount || !recurringData.category) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    try {
      await addDoc(collection(db, 'recurringTransactions'), {
        userId: currentUser.uid,
        type: recurringData.type,
        description: recurringData.description,
        amount: parseFloat(recurringData.amount),
        category: recurringData.category,
        paymentMethod: recurringData.paymentMethod,
        balance: recurringData.balance,
        frequency: recurringData.frequency,
        dayOfMonth: parseInt(recurringData.dayOfMonth),
        isActive: recurringData.isActive,
        createdAt: serverTimestamp(),
        lastExecuted: null
      });

      closeRecurringModal();
      toast.success(`${recurringData.type === 'income' ? 'Ingreso' : 'Egreso'} automático creado exitosamente`);
    } catch (error) {
      toast.error('Error al crear la transacción automática');
    }
  }

  async function toggleRecurringTransaction(id, isActive) {
    try {
      await updateDoc(doc(db, 'recurringTransactions', id), {
        isActive: !isActive
      });
      toast.success(isActive ? 'Transacción automática pausada' : 'Transacción automática activada');
    } catch (error) {
      toast.error('Error al cambiar el estado');
    }
  }

  async function deleteRecurringTransaction(id) {
    if (!window.confirm('¿Estás seguro de que quieres eliminar esta transacción automática?')) return;

    try {
      await deleteDoc(doc(db, 'recurringTransactions', id));
      toast.success('Transacción automática eliminada');
    } catch (error) {
      toast.error('Error al eliminar la transacción automática');
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

            {/* Estadísticas por Método de Pago */}
            {Object.keys(paymentMethodTotals).length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <CreditCard className="h-5 w-5 mr-2" />
                  Egresos por Método de Pago
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {paymentMethodTotals.efectivo > 0 && (
                    <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg shadow p-6 border border-green-200">
                      <div className="flex items-center">
                        <Banknote className="h-8 w-8 text-green-600" />
                        <div className="ml-4">
                          <p className="text-sm font-medium text-green-700">Efectivo</p>
                          <p className="text-2xl font-semibold text-green-800">
                            {formatCurrency(paymentMethodTotals.efectivo)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {paymentMethodTotals.tarjeta > 0 && (
                    <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg shadow p-6 border border-blue-200">
                      <div className="flex items-center">
                        <CreditCard className="h-8 w-8 text-blue-600" />
                        <div className="ml-4">
                          <p className="text-sm font-medium text-blue-700">Tarjeta</p>
                          <p className="text-2xl font-semibold text-blue-800">
                            {formatCurrency(paymentMethodTotals.tarjeta)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {paymentMethodTotals.puntos > 0 && (
                    <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg shadow p-6 border border-purple-200">
                      <div className="flex items-center">
                        <Gift className="h-8 w-8 text-purple-600" />
                        <div className="ml-4">
                          <p className="text-sm font-medium text-purple-700">Puntos</p>
                          <p className="text-2xl font-semibold text-purple-800">
                            {formatCurrency(paymentMethodTotals.puntos)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Acciones Personales */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Acciones Rápidas</h3>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => openTransactionModal('income')}
                  disabled={isLoadingTransaction}
                  className={`group flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all duration-200 transform ${
                    isLoadingTransaction 
                      ? 'bg-emerald-400 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 hover:scale-105 hover:shadow-lg'
                  } text-white shadow-md`}
                >
                  {isLoadingTransaction ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <TrendingUp className="h-5 w-5 group-hover:scale-110 transition-transform duration-200" />
                  )}
                  <span>{isLoadingTransaction ? 'Procesando...' : 'Agregar Ingreso'}</span>
                </button>
                
                <button
                  onClick={() => openTransactionModal('expense')}
                  disabled={isLoadingTransaction}
                  className={`group flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all duration-200 transform ${
                    isLoadingTransaction 
                      ? 'bg-red-400 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 hover:scale-105 hover:shadow-lg'
                  } text-white shadow-md`}
                >
                  {isLoadingTransaction ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <TrendingDown className="h-5 w-5 group-hover:scale-110 transition-transform duration-200" />
                  )}
                  <span>{isLoadingTransaction ? 'Procesando...' : 'Agregar Egreso'}</span>
                </button>

                <button
                  onClick={openBalanceModal}
                  disabled={isLoadingBalance}
                  className={`group flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all duration-200 transform ${
                    isLoadingBalance 
                      ? 'bg-purple-400 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 hover:scale-105 hover:shadow-lg'
                  } text-white shadow-md`}
                >
                  {isLoadingBalance ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <PiggyBank className="h-5 w-5 group-hover:scale-110 transition-transform duration-200" />
                  )}
                  <span>{isLoadingBalance ? 'Creando...' : 'Crear Balance'}</span>
                </button>

                <button
                  onClick={() => openRecurringModal('income')}
                  className="group flex items-center space-x-2 px-6 py-3 rounded-xl font-medium bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white shadow-md hover:scale-105 hover:shadow-lg transition-all duration-200 transform"
                >
                  <Repeat className="h-5 w-5 group-hover:scale-110 transition-transform duration-200" />
                  <span>Ingreso Automático</span>
                </button>

                <button
                  onClick={() => openRecurringModal('expense')}
                  className="group flex items-center space-x-2 px-6 py-3 rounded-xl font-medium bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-md hover:scale-105 hover:shadow-lg transition-all duration-200 transform"
                >
                  <Clock className="h-5 w-5 group-hover:scale-110 transition-transform duration-200" />
                  <span>Egreso Automático</span>
                </button>
              </div>
            </div>

            {/* Balances/Bolsillos */}
            {balancesWithCurrentAmount.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Target className="h-5 w-5 mr-2" />
                  Mis Balances
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {balancesWithCurrentAmount.map((balance) => (
                    <div key={balance.id} className={`p-6 rounded-xl shadow-lg border-2 transition-all duration-200 hover:shadow-xl hover:scale-105 ${
                      balance.type === 'savings' ? 'bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:border-green-300' :
                      balance.type === 'debt' ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-200 hover:border-red-300' :
                      'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:border-blue-300'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          {getBalanceTypeIcon(balance.type)}
                          <h4 className="font-semibold text-gray-900">{balance.name}</h4>
                        </div>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => openBalanceModal(balance)}
                            className="group p-2 rounded-lg hover:bg-blue-100 transition-all duration-200 transform hover:scale-110"
                            title="Editar balance"
                          >
                            <Edit3 className="h-4 w-4 text-blue-600 group-hover:text-blue-700" />
                          </button>
                          <button
                            onClick={() => deleteBalance(balance.id)}
                            className="group p-2 rounded-lg hover:bg-red-100 transition-all duration-200 transform hover:scale-110"
                            title="Eliminar balance"
                          >
                            <Trash2 className="h-4 w-4 text-red-600 group-hover:text-red-700" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{balance.description}</p>
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold text-gray-900">
                          {formatCurrency(balance.currentAmount || 0)}
                        </span>
                        {balance.goal && (
                          <span className="text-sm text-gray-500">
                            Meta: {formatCurrency(balance.goal)}
                          </span>
                        )}
                      </div>
                      {balance.goal && (
                        <div className="mt-2">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${
                                balance.type === 'savings' ? 'bg-green-500' :
                                balance.type === 'debt' ? 'bg-red-500' :
                                'bg-blue-500'
                              }`}
                              style={{ 
                                width: `${Math.min(100, ((balance.currentAmount || 0) / balance.goal) * 100)}%` 
                              }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Transacciones Automáticas */}
            {recurringTransactions.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Zap className="h-5 w-5 mr-2" />
                  Transacciones Automáticas
                </h3>
                
                <div className="bg-white rounded-lg shadow border">
                  {/* Pestañas para Transacciones Automáticas */}
                  <div className="border-b border-gray-200 bg-gray-50 rounded-t-lg">
                    <nav className="flex space-x-1 px-6 pt-4 pb-2" aria-label="Tabs">
                      <button
                        onClick={() => setRecurringFilterAndResetPage('all')}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                          recurringFilter === 'all'
                            ? 'bg-blue-100 text-blue-700 shadow-sm border border-blue-200'
                            : 'text-gray-600 hover:text-gray-800 hover:bg-white hover:shadow-sm'
                        }`}
                      >
                        Todas ({recurringTransactions.length})
                      </button>
                      <button
                        onClick={() => setRecurringFilterAndResetPage('income')}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                          recurringFilter === 'income'
                            ? 'bg-green-100 text-green-700 shadow-sm border border-green-200'
                            : 'text-gray-600 hover:text-gray-800 hover:bg-white hover:shadow-sm'
                        }`}
                      >
                        Ingresos ({recurringTransactions.filter(t => t.type === 'income').length})
                      </button>
                      <button
                        onClick={() => setRecurringFilterAndResetPage('expense')}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                          recurringFilter === 'expense'
                            ? 'bg-red-100 text-red-700 shadow-sm border border-red-200'
                            : 'text-gray-600 hover:text-gray-800 hover:bg-white hover:shadow-sm'
                        }`}
                      >
                        Gastos ({recurringTransactions.filter(t => t.type === 'expense').length})
                      </button>
                    </nav>
                  </div>
                  
                  <div className="p-6">
                    {filteredRecurringTransactions.length > 0 ? (
                      <div className="grid gap-4">
                        {filteredRecurringTransactions.map((recurring) => (
                        <div key={recurring.id} className={`p-4 rounded-lg border-l-4 ${
                          recurring.type === 'income' 
                            ? 'bg-green-50 border-l-green-500' 
                            : 'bg-red-50 border-l-red-500'
                        }`}>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-3 sm:space-y-0">
                            <div className="flex items-start space-x-3">
                              <div className={`p-2 rounded-full flex-shrink-0 ${
                                recurring.type === 'income' ? 'bg-green-100' : 'bg-red-100'
                              }`}>
                                <Repeat className={`h-5 w-5 ${
                                  recurring.type === 'income' ? 'text-green-600' : 'text-red-600'
                                }`} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-gray-900 truncate">{recurring.description}</p>
                                
                                <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-600">
                                  <span className={`inline-block px-2 py-1 rounded-full text-xs flex-shrink-0 ${
                                    recurring.type === 'income' 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-red-100 text-red-800'
                                  }`}>
                                    {recurring.category}
                                  </span>
                                  
                                  <span className="flex items-center space-x-1 bg-blue-100 px-2 py-1 rounded-full text-xs flex-shrink-0">
                                    <Clock className="h-3 w-3" />
                                    <span>Día {recurring.dayOfMonth} de cada mes</span>
                                  </span>
                                  
                                  <span className={`inline-block px-2 py-1 rounded-full text-xs flex-shrink-0 ${
                                    recurring.isActive 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {recurring.isActive ? 'Activo' : 'Pausado'}
                                  </span>
                                </div>
                                
                                {recurring.balance && recurring.balance !== 'principal' && (
                                  <p className="text-xs text-purple-600 mt-1 truncate">
                                    Balance: {balancesWithCurrentAmount.find(b => b.id === recurring.balance)?.name || recurring.balance}
                                  </p>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between sm:justify-end space-x-2 flex-shrink-0">
                              <span className={`font-bold text-lg ${
                                recurring.type === 'income' ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {recurring.type === 'income' ? '+' : '-'}{formatCurrency(recurring.amount)}
                              </span>
                              
                              <div className="flex items-center space-x-1">
                                <button
                                  onClick={() => toggleRecurringTransaction(recurring.id, recurring.isActive)}
                                  className={`p-1 rounded transition-colors ${
                                    recurring.isActive 
                                      ? 'text-orange-600 hover:text-orange-800 hover:bg-orange-100' 
                                      : 'text-green-600 hover:text-green-800 hover:bg-green-100'
                                  }`}
                                  title={recurring.isActive ? 'Pausar' : 'Activar'}
                                >
                                  {recurring.isActive ? (
                                    <Clock className="h-4 w-4" />
                                  ) : (
                                    <Zap className="h-4 w-4" />
                                  )}
                                </button>
                                <button
                                  onClick={() => deleteRecurringTransaction(recurring.id)}
                                  className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-100 transition-colors"
                                  title="Eliminar transacción automática"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Zap className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p>No hay transacciones automáticas de tipo "{recurringFilter === 'income' ? 'ingresos' : recurringFilter === 'expense' ? 'gastos' : 'todas'}"</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Transacciones Recientes */}
            {personalTransactions.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Calendar className="h-5 w-5 mr-2" />
                  Transacciones Recientes
                </h3>
                
                <div className="bg-white rounded-lg shadow border">
                  {/* Pestañas para Transacciones Recientes */}
                  <div className="border-b border-gray-200 bg-gray-50 rounded-t-lg">
                    <nav className="flex space-x-1 px-6 pt-4 pb-2" aria-label="Tabs">
                      <button
                        onClick={() => setRecentFilterAndResetPage('all')}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                          recentFilter === 'all'
                            ? 'bg-blue-100 text-blue-700 shadow-sm border border-blue-200'
                            : 'text-gray-600 hover:text-gray-800 hover:bg-white hover:shadow-sm'
                        }`}
                      >
                        Todas ({personalTransactions.length})
                      </button>
                      <button
                        onClick={() => setRecentFilterAndResetPage('income')}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                          recentFilter === 'income'
                            ? 'bg-green-100 text-green-700 shadow-sm border border-green-200'
                            : 'text-gray-600 hover:text-gray-800 hover:bg-white hover:shadow-sm'
                        }`}
                      >
                        Ingresos ({personalTransactions.filter(t => t.type === 'income').length})
                      </button>
                      <button
                        onClick={() => setRecentFilterAndResetPage('expense')}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                          recentFilter === 'expense'
                            ? 'bg-red-100 text-red-700 shadow-sm border border-red-200'
                            : 'text-gray-600 hover:text-gray-800 hover:bg-white hover:shadow-sm'
                        }`}
                      >
                        Gastos ({personalTransactions.filter(t => t.type === 'expense').length})
                      </button>
                    </nav>
                  </div>
                  
                  <div className="p-6">
                    {currentTransactions.length > 0 ? (
                      <div className="grid gap-4">
                        {currentTransactions.map((transaction) => (
                        <div key={transaction.id} className={`p-4 rounded-lg border-l-4 ${
                          transaction.type === 'income' 
                            ? 'bg-green-50 border-l-green-500' 
                            : 'bg-red-50 border-l-red-500'
                        }`}>
                          {/* Diseño responsive mejorado */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-3 sm:space-y-0">
                            <div className="flex items-start space-x-3">
                              <div className={`p-2 rounded-full flex-shrink-0 ${
                                transaction.type === 'income' ? 'bg-green-100' : 'bg-red-100'
                              }`}>
                                {transaction.type === 'income' ? (
                                  <TrendingUp className="h-5 w-5 text-green-600" />
                                ) : (
                                  <TrendingDown className="h-5 w-5 text-red-600" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-gray-900 truncate">{transaction.description}</p>
                                
                                {/* Información adicional en mobile */}
                                <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-600">
                                  <span className={`inline-block px-2 py-1 rounded-full text-xs flex-shrink-0 ${
                                    transaction.type === 'income' 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-red-100 text-red-800'
                                  }`}>
                                    {transaction.category}
                                  </span>
                                  
                                  {transaction.paymentMethod && (
                                    <span className="flex items-center space-x-1 bg-gray-100 px-2 py-1 rounded-full text-xs flex-shrink-0">
                                      {getPaymentMethodIcon(transaction.paymentMethod)}
                                      <span className="capitalize">{transaction.paymentMethod}</span>
                                    </span>
                                  )}
                                  
                                  <span className="text-xs flex-shrink-0">{formatDateString(transaction.date)}</span>
                                </div>
                                
                                {transaction.balance && transaction.balance !== 'principal' && (
                                  <p className="text-xs text-purple-600 mt-1 truncate">
                                    Balance: {balancesWithCurrentAmount.find(b => b.id === transaction.balance)?.name || transaction.balance}
                                  </p>
                                )}
                              </div>
                            </div>
                            
                            {/* Monto y acciones */}
                            <div className="flex items-center justify-between sm:justify-end space-x-2 flex-shrink-0">
                              <span className={`font-bold text-lg ${
                                transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                              </span>
                              
                              <div className="flex items-center space-x-1">
                                <button
                                  onClick={() => openTransactionModal(transaction.type, transaction)}
                                  className="group p-2 rounded-lg hover:bg-blue-100 transition-all duration-200 transform hover:scale-110"
                                  title="Editar transacción"
                                >
                                  <Edit3 className="h-4 w-4 text-blue-600 group-hover:text-blue-700" />
                                </button>
                                <button
                                  onClick={() => deleteTransaction(transaction.id)}
                                  className="group p-2 rounded-lg hover:bg-red-100 transition-all duration-200 transform hover:scale-110"
                                  title="Eliminar transacción"
                                >
                                  <Trash2 className="h-4 w-4 text-red-600 group-hover:text-red-700" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p>No hay transacciones de tipo "{recentFilter === 'income' ? 'ingresos' : recentFilter === 'expense' ? 'gastos' : 'todas'}"</p>
                      </div>
                    )}
                    
                    {filteredRecentTransactions.length > transactionsPerPage && (
                      <div className="mt-6 border-t pt-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-4 sm:space-y-0">
                          <div className="flex items-center justify-center sm:justify-start">
                            <Calendar className="h-4 w-4 text-gray-500 mr-2" />
                            <span className="text-sm text-gray-600 font-medium">
                              Mostrando {startIndex + 1} - {Math.min(endIndex, filteredRecentTransactions.length)} de {filteredRecentTransactions.length} transacciones {recentFilter !== 'all' ? `(${recentFilter === 'income' ? 'ingresos' : 'gastos'})` : ''}
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-center space-x-2">
                            <button
                              onClick={goToPreviousPage}
                              disabled={currentPage === 1}
                              className={`flex items-center px-4 py-2 rounded-xl border transition-all duration-200 ${
                                currentPage === 1 
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200' 
                                  : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300 hover:shadow-md transform hover:scale-105'
                              }`}
                            >
                              <ChevronLeft className="h-4 w-4 mr-1" />
                              Anterior
                            </button>
                            
                            <div className="flex items-center space-x-1">
                              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                <button
                                  key={page}
                                  onClick={() => goToPage(page)}
                                  className={`px-3 py-2 rounded-xl transition-all duration-200 transform ${
                                    currentPage === page
                                      ? 'bg-blue-600 text-white shadow-lg scale-110'
                                      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 hover:shadow-md hover:scale-105'
                                  }`}
                                >
                                  {page}
                                </button>
                              ))}
                            </div>
                            
                            <button
                              onClick={goToNextPage}
                              disabled={currentPage === totalPages}
                              className={`flex items-center px-4 py-2 rounded-xl border transition-all duration-200 ${
                                currentPage === totalPages 
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200' 
                                  : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300 hover:shadow-md transform hover:scale-105'
                              }`}
                            >
                              Siguiente
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </button>
                          </div>
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
                {editingTransaction 
                  ? `Editar ${transactionData.type === 'income' ? 'Ingreso' : 'Egreso'}`
                  : `Agregar ${transactionData.type === 'income' ? 'Ingreso' : 'Egreso'}`
                }
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

                  {transactionData.type === 'expense' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Método de Pago
                      </label>
                      <select
                        value={transactionData.paymentMethod}
                        onChange={(e) => setTransactionData({...transactionData, paymentMethod: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="efectivo">💵 Efectivo</option>
                        <option value="tarjeta">💳 Tarjeta</option>
                        <option value="puntos">🎁 Puntos</option>
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Balance
                    </label>
                    <select
                      value={transactionData.balance}
                      onChange={(e) => setTransactionData({...transactionData, balance: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="principal">💼 Balance Principal</option>
                      {balancesWithCurrentAmount.map(balance => (
                        <option key={balance.id} value={balance.id}>
                          {balance.type === 'savings' ? '🐷' : balance.type === 'debt' ? '⚠️' : '💰'} {balance.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="flex space-x-3 mt-6">
                  <button
                    type="submit"
                    disabled={isLoadingTransaction}
                    className={`flex-1 flex items-center justify-center space-x-2 text-white py-2 px-4 rounded-lg transition-colors ${
                      isLoadingTransaction 
                        ? (transactionData.type === 'income' ? 'bg-emerald-400' : 'bg-red-400') + ' cursor-not-allowed'
                        : transactionData.type === 'income' 
                          ? 'bg-emerald-600 hover:bg-emerald-700' 
                          : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    {isLoadingTransaction && <Loader2 className="h-4 w-4 animate-spin" />}
                    <span>
                      {isLoadingTransaction 
                        ? (editingTransaction ? 'Actualizando...' : 'Agregando...')
                        : editingTransaction 
                          ? `Actualizar ${transactionData.type === 'income' ? 'Ingreso' : 'Egreso'}`
                          : `Agregar ${transactionData.type === 'income' ? 'Ingreso' : 'Egreso'}`
                      }
                    </span>
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

        {/* Balance Modal */}
        {showBalanceModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">
                {editingBalance ? 'Editar Balance' : 'Crear Nuevo Balance'}
              </h3>
              <form onSubmit={addBalance}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nombre del Balance
                    </label>
                    <input
                      type="text"
                      value={balanceData.name}
                      onChange={(e) => setBalanceData({...balanceData, name: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ej: Vacaciones, Emergencias, etc."
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tipo de Balance
                    </label>
                    <select
                      value={balanceData.type}
                      onChange={(e) => setBalanceData({...balanceData, type: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="savings">🐷 Ahorro</option>
                      <option value="debt">⚠️ Deuda</option>
                      <option value="general">💰 General</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Descripción
                    </label>
                    <textarea
                      value={balanceData.description}
                      onChange={(e) => setBalanceData({...balanceData, description: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Describe el propósito de este balance..."
                      rows="3"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Meta (Opcional)
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={balanceData.goal}
                      onChange={(e) => setBalanceData({...balanceData, goal: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {balanceData.type === 'savings' ? 'Cantidad que quieres ahorrar' :
                       balanceData.type === 'debt' ? 'Cantidad de la deuda total' :
                       'Meta financiera para este balance'}
                    </p>
                  </div>
                </div>
                
                <div className="flex space-x-3 mt-6">
                  <button
                    type="submit"
                    disabled={isLoadingBalance}
                    className={`flex-1 flex items-center justify-center space-x-2 text-white py-2 px-4 rounded-lg transition-colors ${
                      isLoadingBalance 
                        ? 'bg-purple-400 cursor-not-allowed' 
                        : 'bg-purple-600 hover:bg-purple-700'
                    }`}
                  >
                    {isLoadingBalance && <Loader2 className="h-4 w-4 animate-spin" />}
                    <span>
                      {isLoadingBalance 
                        ? (editingBalance ? 'Actualizando...' : 'Creando...') 
                        : (editingBalance ? 'Actualizar Balance' : 'Crear Balance')
                      }
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={closeBalanceModal}
                    className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Recurring Transaction Modal */}
        {showRecurringModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">
                Crear {recurringData.type === 'income' ? 'Ingreso' : 'Egreso'} Automático
              </h3>
              <form onSubmit={addRecurringTransaction}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tipo
                    </label>
                    <select
                      value={recurringData.type}
                      onChange={(e) => setRecurringData({...recurringData, type: e.target.value})}
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
                      value={recurringData.description}
                      onChange={(e) => setRecurringData({...recurringData, description: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ej: Salario, Arriendo, Servicios..."
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
                      value={recurringData.amount}
                      onChange={(e) => setRecurringData({...recurringData, amount: e.target.value})}
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
                      value={recurringData.category}
                      onChange={(e) => setRecurringData({...recurringData, category: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Selecciona una categoría</option>
                      {recurringData.type === 'income' ? (
                        <>
                          <option value="Salario">Salario</option>
                          <option value="Freelance">Freelance</option>
                          <option value="Inversiones">Inversiones</option>
                          <option value="Otros ingresos">Otros ingresos</option>
                        </>
                      ) : (
                        <>
                          <option value="Arriendo">Arriendo</option>
                          <option value="Servicios">Servicios públicos</option>
                          <option value="Internet">Internet</option>
                          <option value="Celular">Celular</option>
                          <option value="Gimnasio">Gimnasio</option>
                          <option value="Suscripciones">Suscripciones</option>
                          <option value="Otros gastos">Otros gastos</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Día del mes para ejecutar
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="28"
                      value={recurringData.dayOfMonth}
                      onChange={(e) => setRecurringData({...recurringData, dayOfMonth: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Recomendado: día 1-28 para que funcione en todos los meses
                    </p>
                  </div>
                  
                  {recurringData.type === 'expense' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Método de Pago
                      </label>
                      <select
                        value={recurringData.paymentMethod}
                        onChange={(e) => setRecurringData({...recurringData, paymentMethod: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="efectivo">💵 Efectivo</option>
                        <option value="tarjeta">💳 Tarjeta</option>
                        <option value="puntos">🎁 Puntos</option>
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Balance
                    </label>
                    <select
                      value={recurringData.balance}
                      onChange={(e) => setRecurringData({...recurringData, balance: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="principal">💼 Balance Principal</option>
                      {balancesWithCurrentAmount.map(balance => (
                        <option key={balance.id} value={balance.id}>
                          {balance.type === 'savings' ? '🐷' : balance.type === 'debt' ? '⚠️' : '💰'} {balance.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="flex space-x-3 mt-6">
                  <button
                    type="submit"
                    className={`flex-1 text-white py-2 px-4 rounded-lg transition-colors ${
                      recurringData.type === 'income' 
                        ? 'bg-emerald-600 hover:bg-emerald-700' 
                        : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    Crear {recurringData.type === 'income' ? 'Ingreso' : 'Egreso'} Automático
                  </button>
                  <button
                    type="button"
                    onClick={closeRecurringModal}
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