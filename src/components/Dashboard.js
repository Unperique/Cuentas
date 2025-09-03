import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Users, 
  DollarSign, 
  LogOut, 
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
  Edit3,
  Target,
  PiggyBank,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Repeat,
  Clock,
  Zap,
  ArrowLeftRight,
  X
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


// Formatea un número a string con separador de miles (sin símbolo de moneda)
function formatNumberThousands(value) {
  if (value === '' || value === null || value === undefined) return '';
  const num = Number(value.toString().replace(/\D/g, ''));
  if (isNaN(num)) return '';
  return num.toLocaleString('es-CO');
}

// Quita separadores de miles y retorna número puro
function parseNumberThousands(value) {
  if (typeof value !== 'string') return value;
  const cleaned = value.replace(/\./g, '').replace(/,/g, '');
  return parseInt(cleaned) || 0;
}

// Función para obtener el ícono según el tipo de balance
function getBalanceTypeIcon(type) {
  switch (type) {
    case 'savings':
      return <PiggyBank className="h-5 w-5 text-green-600" />;
    case 'debt':
      return <AlertTriangle className="h-5 w-5 text-red-600" />;
    case 'general':
      return <Wallet className="h-5 w-5 text-blue-600" />;
    case 'future':
      return <Calendar className="h-5 w-5 text-orange-600" />;
    default:
      return <Wallet className="h-5 w-5 text-gray-600" />;
  }
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
  
  let date;
  
  // Si es un string, intentar parsearlo
  if (typeof dateString === 'string') {
    // Si es un string ISO, usar directamente
    if (dateString.includes('T')) {
      date = new Date(dateString);
    } else {
      // Si es formato YYYY-MM-DD, parsearlo
  const [year, month, day] = dateString.split('-');
      date = new Date(year, month - 1, day);
    }
  } else if (dateString instanceof Date) {
    // Si ya es un objeto Date, usarlo directamente
    date = dateString;
  } else {
    // Si no es ni string ni Date, intentar convertirlo
    date = new Date(dateString);
  }
  
  // Verificar que la fecha es válida
  if (isNaN(date.getTime())) {
    return '';
  }
  
  return date.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export default function Dashboard() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  // All state declarations here
  const [showProfile, setShowProfile] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [personalTransactions, setPersonalTransactions] = useState([]);
  const [balances, setBalances] = useState([]);
  const [recurringTransactions, setRecurringTransactions] = useState([]);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showAbonoModal, setShowAbonoModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [transactionsPerPage] = useState(10);
  const [recentFilter, setRecentFilter] = useState('all');
  const [recurringFilter, setRecurringFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [editingBalance, setEditingBalance] = useState(null);
  const [isLoadingTransaction, setIsLoadingTransaction] = useState(false);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isLoadingAbono, setIsLoadingAbono] = useState(false);
  const [selectedBalance, setSelectedBalance] = useState(null);
  const [activeTab, setActiveTab] = useState('personal');
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [showJoinRoomModal, setShowJoinRoomModal] = useState(false);
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [newRoomData, setNewRoomData] = useState({
    name: '',
    description: ''
  });
  const [showFutureBalanceModal, setShowFutureBalanceModal] = useState(false);
  const [futureBalanceData, setFutureBalanceData] = useState({
    name: '',
    description: '',
    targetMonth: ''
  });
  const [showCardsModal, setShowCardsModal] = useState(false);
  const [cards, setCards] = useState([]);
  const [editingCard, setEditingCard] = useState(null);
  const [showPayCardModal, setShowPayCardModal] = useState(false);
  const [payingCard, setPayingCard] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferData, setTransferData] = useState({
    fromBalance: '',
    toBalance: '',
    amount: '',
    description: ''
  });
  const [isLoadingTransfer, setIsLoadingTransfer] = useState(false);
  const [isLoadingCardOperation, setIsLoadingCardOperation] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  
  // Estado para alertas personalizadas
  const [customAlert, setCustomAlert] = useState({
    show: false,
    title: '',
    message: '',
    type: 'confirm', // 'confirm', 'info', 'warning', 'error'
    onConfirm: null,
    onCancel: null,
    confirmText: 'Aceptar',
    cancelText: 'Cancelar'
  });
  const [cardData, setCardData] = useState({
    bank: '',
    type: 'credit',
    lastFourDigits: '',
    nickname: '',
    creditLimit: ''
  });
  
          // Transaction form data
  const [transactionData, setTransactionData] = useState({
     type: 'expense',
    description: '',
    amount: '',
    category: '',
    date: getLocalDateString(),
     paymentMethod: 'efectivo',
     balance: '',
     selectedCard: ''
   });

  // Balance form data
  const [balanceData, setBalanceData] = useState({
    name: '',
    type: 'savings',
    description: '',
    goal: '',
    targetMonth: ''
  });
  
          // Recurring transaction form data
  const [recurringData, setRecurringData] = useState({
     type: 'expense',
    description: '',
    amount: '',
    category: '',
    paymentMethod: 'efectivo',
    balance: 'principal',
    frequency: 'monthly', // 'monthly', 'weekly', 'daily'
    dayOfMonth: 1, // día del mes para ejecutar
    isActive: true,
    selectedCard: ''
  });

  const [isLoadingRoom, setIsLoadingRoom] = useState(false);
  
  // Estados para datos de formularios
  const [abonoData, setAbonoData] = useState({
    amount: '',
    description: '',
    balanceId: ''
  });
  
  const [profileData, setProfileData] = useState({
    displayName: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    if (!currentUser) return;

    // Suscripción a salas
    const roomsQuery = query(
      collection(db, 'rooms'),
      where('members', 'array-contains', currentUser.uid)
    );

    const unsubscribeRooms = onSnapshot(
      roomsQuery, 
      (snapshot) => {
      const roomsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
        setRooms(roomsData);
      },
      (error) => {
        console.error('Error en suscripción a salas:', error);
        toast.error('Error al cargar salas. Verifica tu conexión.');
      }
    );

    // Suscripción a transacciones personales
    const personalTransactionsQuery = query(
      collection(db, 'personalTransactions'),
      where('userId', '==', currentUser.uid)
    );

    const unsubscribePersonalTransactions = onSnapshot(
      personalTransactionsQuery, 
      (snapshot) => {
      const transactionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
        })).sort((a, b) => {
          const dateA = a.date ? new Date(a.date) : new Date(a.createdAt?.seconds * 1000 || 0);
          const dateB = b.date ? new Date(b.date) : new Date(b.createdAt?.seconds * 1000 || 0);
          return dateB - dateA;
        });
        
      setPersonalTransactions(transactionsData);
      },
      (error) => {
        console.error('Error en suscripción a transacciones:', error);
        setConnectionStatus('error');
        toast.error('Error al cargar transacciones. Verifica tu conexión.');
      }
    );

    // Suscripción a balances
    const balancesQuery = query(
      collection(db, 'balances'),
      where('userId', '==', currentUser.uid)
    );

    const unsubscribeBalances = onSnapshot(
      balancesQuery, 
      (snapshot) => {
      const balancesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setBalances(balancesData);
      },
      (error) => {
        console.error('Error en suscripción a balances:', error);
        toast.error('Error al cargar balances. Verifica tu conexión.');
      }
    );

    // Suscripción a transacciones automáticas
    const recurringQuery = query(
      collection(db, 'recurringTransactions'),
      where('userId', '==', currentUser.uid)
    );

    const unsubscribeRecurring = onSnapshot(
      recurringQuery, 
      (snapshot) => {
      const recurringData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRecurringTransactions(recurringData);
      },
      (error) => {
        console.error('Error en suscripción a transacciones automáticas:', error);
        toast.error('Error al cargar transacciones automáticas. Verifica tu conexión.');
      }
    );

    // Suscripción a tarjetas
    const cardsQuery = query(
      collection(db, 'cards'),
      where('userId', '==', currentUser.uid)
    );

    const unsubscribeCards = onSnapshot(
      cardsQuery, 
      (snapshot) => {
        const cardsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setCards(cardsData);
      },
      (error) => {
        console.error('Error en suscripción a tarjetas:', error);
        toast.error('Error al cargar tarjetas. Verifica tu conexión.');
      }
    );

    return () => {
      unsubscribeRooms();
      unsubscribePersonalTransactions();
      unsubscribeBalances();
      unsubscribeRecurring();
      unsubscribeCards();
    };
  }, [currentUser]);

  // Efecto para manejar el estado de carga inicial
  useEffect(() => {
    if (personalTransactions.length > 0 || balances.length > 0 || cards.length > 0) {
      setIsInitialLoading(false);
    }
  }, [personalTransactions, balances, cards]);

  // All function definitions here BEFORE the return statement
  async function addTransaction(e) {
    e.preventDefault();
    if (isLoadingTransaction) return;
    
    if (!transactionData.description || !transactionData.amount || !transactionData.category) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    // Validar que si se selecciona tarjeta, se debe seleccionar una tarjeta específica
    if (transactionData.paymentMethod === 'tarjeta' && !transactionData.selectedCard) {
      toast.error('Por favor selecciona una tarjeta');
      return;
    }

    setIsLoadingTransaction(true);
    try {
      // Determinar si es un gasto con tarjeta de crédito
      const isCreditCardExpense = transactionData.type === 'expense' && 
                                 transactionData.paymentMethod === 'tarjeta' && 
                                 transactionData.selectedCard;
      
      let cardType = null;
      if (isCreditCardExpense) {
        const card = cards.find(c => c.id === transactionData.selectedCard);
        cardType = card ? card.type : null;
      }

      const transactionObj = {
        userId: currentUser.uid,
        type: transactionData.type,
        description: transactionData.description,
        amount: parseFloat(transactionData.amount),
        category: transactionData.category,
        date: transactionData.date,
        paymentMethod: transactionData.paymentMethod,
        balance: transactionData.balance || null,
        selectedCard: transactionData.selectedCard || null,
        // Para gastos con tarjeta de crédito, marcar como crédito
        isCreditExpense: isCreditCardExpense && cardType === 'credit',
        updatedAt: serverTimestamp()
      };

      if (editingTransaction) {
        await updateDoc(doc(db, 'personalTransactions', editingTransaction.id), transactionObj);
        toast.success('Transacción actualizada exitosamente');
      } else {
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
    showCustomAlert(
      'Eliminar Transacción',
      '¿Estás seguro de que quieres eliminar esta transacción?',
      'confirm',
      async () => {
        try {
          await deleteDoc(doc(db, 'personalTransactions', transactionId));
          toast.success('Transacción eliminada');
        } catch (error) {
          toast.error('Error al eliminar la transacción');
        }
      },
      null,
      'Eliminar',
      'Cancelar'
    );
  }

  async function addBalance(e) {
    e.preventDefault();
    if (isLoadingBalance) return;
    
    if (!balanceData.name || !balanceData.description) {
      toast.error('Por favor completa todos los campos obligatorios');
      return;
    }

    setIsLoadingBalance(true);
    try {
      if (editingBalance) {
        const updateData = {
          name: balanceData.name,
          type: balanceData.type,
          description: balanceData.description,
          goal: balanceData.goal ? parseFloat(balanceData.goal) : null,
          updatedAt: serverTimestamp()
        };
        
        if (balanceData.type === 'future' && balanceData.targetMonth) {
          updateData.targetMonth = balanceData.targetMonth;
        }
        
        await updateDoc(doc(db, 'balances', editingBalance.id), updateData);
        toast.success('Balance actualizado exitosamente');
      } else {
        const createData = {
          userId: currentUser.uid,
          name: balanceData.name,
          type: balanceData.type,
          description: balanceData.description,
          goal: balanceData.goal ? parseFloat(balanceData.goal) : null,
          currentAmount: 0,
        createdAt: serverTimestamp()
        };
        
        if (balanceData.type === 'future' && balanceData.targetMonth) {
          createData.targetMonth = balanceData.targetMonth;
        }
        
        await addDoc(collection(db, 'balances'), createData);
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
    showCustomAlert(
      'Eliminar Balance',
      '¿Estás seguro de que quieres eliminar este balance?',
      'confirm',
      async () => {
        try {
          await deleteDoc(doc(db, 'balances', balanceId));
          toast.success('Balance eliminado');
        } catch (error) {
          toast.error('Error al eliminar el balance');
        }
      },
      null,
      'Eliminar',
      'Cancelar'
    );
  }

  async function addRecurringTransaction(e) {
    e.preventDefault();
    if (!recurringData.description || !recurringData.amount || !recurringData.category) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    // Validar que si se selecciona tarjeta, se debe seleccionar una tarjeta específica
    if (recurringData.paymentMethod === 'tarjeta' && !recurringData.selectedCard) {
      toast.error('Por favor selecciona una tarjeta');
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
        frequency: recurringData.frequency,
        dayOfMonth: parseInt(recurringData.dayOfMonth),
        isActive: recurringData.isActive,
        selectedCard: recurringData.selectedCard || null,
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
    showCustomAlert(
      'Eliminar Transacción Automática',
      '¿Estás seguro de que quieres eliminar esta transacción automática?',
      'confirm',
      async () => {
        try {
          await deleteDoc(doc(db, 'recurringTransactions', id));
          toast.success('Transacción automática eliminada');
        } catch (error) {
          toast.error('Error al eliminar la transacción automática');
        }
      },
      null,
      'Eliminar',
      'Cancelar'
    );
  }

  async function handleAbono(e) {
    e.preventDefault();
    if (!abonoData.amount || !abonoData.balanceId || isLoadingAbono) return;

    const targetBalance = allBalancesWithAmounts.find(b => b.id === abonoData.balanceId);
    if (!targetBalance) {
      toast.error('No se ha seleccionado un balance válido para el abono');
      return;
    }

    const abonoAmount = parseFloat(abonoData.amount);
    if (abonoAmount <= 0) {
      toast.error('El monto debe ser mayor a 0');
      return;
    }

    setIsLoadingAbono(true);
    try {
      if (targetBalance.type === 'future') {
        // Para balances futuros, solo crear un egreso asignado al balance futuro
        await addDoc(collection(db, 'personalTransactions'), {
          userId: currentUser.uid,
          type: 'expense',
          description: abonoData.description || `Gasto futuro - ${targetBalance.name}`,
          amount: abonoAmount,
          category: 'Gasto Futuro',
          date: new Date().toISOString().split('T')[0],
          paymentMethod: 'efectivo',
          balance: targetBalance.id, // Asignar al balance futuro
          createdAt: serverTimestamp()
        });
        
        toast.success(`Gasto futuro de $${formatNumberThousands(abonoAmount)} agregado a ${targetBalance.name}`);
      } else {
        // Para otros balances (ahorro, deuda), crear transferencia
        // 1. Crear transacción de egreso desde el balance general
        await addDoc(collection(db, 'personalTransactions'), {
          userId: currentUser.uid,
          type: 'expense',
          description: abonoData.description || `Abono a ${targetBalance.name}`,
          amount: abonoAmount,
          category: 'Abono/Transferencia',
          date: new Date().toISOString().split('T')[0],
          paymentMethod: 'efectivo',
          balance: 'principal', // Desde balance general
          createdAt: serverTimestamp()
        });

        // 2. Crear transacción de ingreso al balance específico
        await addDoc(collection(db, 'personalTransactions'), {
          userId: currentUser.uid,
          type: 'income',
          description: abonoData.description || `Abono recibido`,
          amount: abonoAmount,
          category: 'Abono/Transferencia',
          date: new Date().toISOString().split('T')[0],
          paymentMethod: 'efectivo',
          balance: targetBalance.id,
          createdAt: serverTimestamp()
        });
        
        toast.success(`Abono de $${formatNumberThousands(abonoAmount)} realizado exitosamente`);
      }
      
      closeAbonoModal();
    } catch (error) {
      console.error('Error al procesar abono:', error);
      toast.error('Error al procesar el abono');
    } finally {
      setIsLoadingAbono(false);
    }
  }

  async function updateProfile(e) {
    e.preventDefault();
    
    try {
      // Actualizar nombre de usuario
      if (profileData.displayName !== currentUser.displayName) {
        await updateProfile(currentUser, {
          displayName: profileData.displayName
        });
      }

      // Si el usuario quiere cambiar contraseña
      if (profileData.newPassword) {
        if (profileData.newPassword.length < 6) {
          toast.error('La nueva contraseña debe tener al menos 6 caracteres');
          return;
        }
        
        if (profileData.newPassword !== profileData.confirmPassword) {
          toast.error('Las contraseñas no coinciden');
          return;
        }

        if (!profileData.currentPassword) {
          toast.error('Debes proporcionar tu contraseña actual');
          return;
        }

        // Re-autenticar al usuario
        const credential = EmailAuthProvider.credential(
          currentUser.email,
          profileData.currentPassword
        );
        
        await reauthenticateWithCredential(currentUser, credential);
        await updatePassword(currentUser, profileData.newPassword);
      }

        toast.success('Perfil actualizado exitosamente');
      closeProfileModal();
    } catch (error) {
      if (error.code === 'auth/wrong-password') {
        toast.error('La contraseña actual es incorrecta');
      } else {
        toast.error('Error al actualizar el perfil');
      }
    }
  }

  // Modal handlers
          function openTransactionModal(type, transaction = null) {
    if (transaction) {
      setEditingTransaction(transaction);
      setTransactionData({
        type: transaction.type,
        description: transaction.description,
        amount: transaction.amount.toString(),
        category: transaction.category,
        date: transaction.date,
        paymentMethod: transaction.paymentMethod || 'efectivo',
         balance: transaction.balance || '',
         selectedCard: transaction.selectedCard || ''
      });
    } else {
      setEditingTransaction(null);
      setTransactionData({
        type,
        description: '',
        amount: '',
        category: '',
        date: getLocalDateString(),
        paymentMethod: 'efectivo',
         balance: '',
         selectedCard: ''
      });
    }
    setShowTransactionModal(true);
  }

  function closeTransactionModal() {
    setShowTransactionModal(false);
    setEditingTransaction(null);
      setIsLoadingTransaction(false);
  }

  function openBalanceModal(balance = null) {
    if (balance) {
      setEditingBalance(balance);
      setBalanceData({
        name: balance.name,
        type: balance.type,
        description: balance.description,
        goal: balance.goal ? balance.goal.toString() : '',
        targetMonth: balance.targetMonth || ''
      });
    } else { 
      setEditingBalance(null);
      setBalanceData({
        name: '',
        type: 'savings',
        description: '',
        goal: '',
        targetMonth: ''
      });
    }
    setShowBalanceModal(true);
  }

  function closeBalanceModal() {
    setShowBalanceModal(false);
    setEditingBalance(null);
      setIsLoadingBalance(false);
  }

          function openRecurringModal(type) {
     setRecurringData({
       ...recurringData,
       type,
      description: '',
      amount: '',
      category: '',
      paymentMethod: 'efectivo',
      balance: 'principal'
    });
  }



  async function deleteTransaction(transactionId) {
    showCustomAlert(
      'Eliminar Transacción',
      '¿Estás seguro de que quieres eliminar esta transacción?',
      'confirm',
      async () => {
        try {
          await deleteDoc(doc(db, 'personalTransactions', transactionId));
          toast.success('Transacción eliminada');
        } catch (error) {
          toast.error('Error al eliminar la transacción');
        }
      },
      null,
      'Eliminar',
      'Cancelar'
    );
  }

  // Calcular totales de cuentas personales
  const totalIncome = personalTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  
  const totalExpenses = personalTransactions
    .filter(t => t.type === 'expense')
    .filter(t => {
      // Solo incluir gastos que afecten el balance inmediatamente:
      // 1. Gastos con efectivo
      // 2. Gastos con tarjeta de débito
      // 3. Pagos de tarjetas de crédito
      // 4. Gastos con tarjeta de crédito que NO sean pagos de tarjeta (estos NO se incluyen)
      
      if (t.paymentMethod === 'efectivo') {
        return true; // Efectivo siempre afecta el balance
      }
      
      if (t.paymentMethod === 'tarjeta' && t.selectedCard) {
        const card = cards.find(c => c.id === t.selectedCard);
        if (card && card.type === 'debit') {
          return true; // Tarjeta de débito afecta el balance inmediatamente
        }
        if (card && card.type === 'credit') {
          // Solo incluir si es un pago de tarjeta de crédito
          const isPayment = t.category === 'Pago Tarjeta de Crédito';
          if (!isPayment) {
            // Este es un gasto con tarjeta de crédito que NO debe afectar el balance
            return false;
          }
          return true;
        }
      }
      
      // Para otros casos (sin tarjeta seleccionada, etc.)
      return true;
    })
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  
  const balance = totalIncome - totalExpenses;

  // Calcular totales por método de pago (solo egresos)
  const paymentMethodTotals = personalTransactions
    .filter(t => t.type === 'expense')
    .filter(t => {
      // Solo incluir gastos que afecten el balance inmediatamente:
      // 1. Gastos con efectivo
      // 2. Gastos con tarjeta de débito
      // 3. Pagos de tarjetas de crédito
      // 4. Gastos con tarjeta de crédito que NO sean pagos de tarjeta (estos NO se incluyen)
      
      if (t.paymentMethod === 'efectivo') {
        return true; // Efectivo siempre afecta el balance
      }
      
      if (t.paymentMethod === 'tarjeta' && t.selectedCard) {
        const card = cards.find(c => c.id === t.selectedCard);
        if (card && card.type === 'debit') {
          return true; // Tarjeta de débito afecta el balance inmediatamente
        }
        if (card && card.type === 'credit') {
          // Solo incluir si es un pago de tarjeta de crédito
          const isPayment = t.category === 'Pago Tarjeta de Crédito';
          if (!isPayment) {
            // Este es un gasto con tarjeta de crédito que NO debe afectar el balance
            return false;
          }
          return true;
        }
      }
      
      // Para otros casos (sin tarjeta seleccionada, etc.)
      return true;
    })
    .reduce((totals, t) => {
      const method = t.paymentMethod || 'efectivo';
      totals[method] = (totals[method] || 0) + (t.amount || 0);
      return totals;
    }, {});

  // Filtrado de transacciones recurrentes
  const filteredRecurringTransactions = recurringTransactions.filter(transaction => {
    if (recurringFilter === 'all') return true;
    return transaction.type === recurringFilter;
  });

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

  // Funciones para alertas personalizadas
  const showCustomAlert = (title, message, type = 'confirm', onConfirm = null, onCancel = null, confirmText = 'Aceptar', cancelText = 'Cancelar') => {
    setCustomAlert({
      show: true,
      title,
      message,
      type,
      onConfirm,
      onCancel,
      confirmText,
      cancelText
    });
  };

  const hideCustomAlert = () => {
    setCustomAlert({
      show: false,
      title: '',
      message: '',
      type: 'confirm',
      onConfirm: null,
      onCancel: null,
      confirmText: 'Aceptar',
      cancelText: 'Cancelar'
    });
  };

  const handleAlertConfirm = () => {
    if (customAlert.onConfirm) {
      customAlert.onConfirm();
    }
    hideCustomAlert();
  };

  const handleAlertCancel = () => {
    if (customAlert.onCancel) {
      customAlert.onCancel();
    }
    hideCustomAlert();
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
    // Validación más robusta para determinar si es modo edición
    const isEditMode = balance && balance.id && typeof balance === 'object';
    
    if (isEditMode) {
      // Modo edición
      setEditingBalance(balance);
      setBalanceData({
        name: balance.name || '',
        type: balance.type || 'savings',
        description: balance.description || '',
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

  async function addCard(e) {
    e.preventDefault();
    if (!cardData.bank.trim() || !cardData.lastFourDigits.trim() || !cardData.nickname.trim()) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    setIsLoadingCardOperation(true);
    try {
      if (editingCard) {
        // Editar tarjeta existente
        await updateDoc(doc(db, 'cards', editingCard.id), {
          bank: cardData.bank.trim(),
          type: cardData.type,
          lastFourDigits: cardData.lastFourDigits.trim(),
          nickname: cardData.nickname.trim(),
          creditLimit: cardData.creditLimit || '',
          updatedAt: serverTimestamp()
        });
        toast.success(`Tarjeta "${cardData.nickname}" actualizada exitosamente`);
      } else {
        // Crear nueva tarjeta
        await addDoc(collection(db, 'cards'), {
          userId: currentUser.uid,
          bank: cardData.bank.trim(),
          type: cardData.type,
          lastFourDigits: cardData.lastFourDigits.trim(),
          nickname: cardData.nickname.trim(),
          creditLimit: cardData.creditLimit || '',
          createdAt: serverTimestamp()
        });
        toast.success(`Tarjeta "${cardData.nickname}" agregada exitosamente`);
      }

      setShowCardsModal(false);
      setEditingCard(null);
      setCardData({ bank: '', type: 'credit', lastFourDigits: '', nickname: '', creditLimit: '' });
    } catch (error) {
      console.error('Error al procesar la tarjeta:', error);
      toast.error(editingCard ? 'Error al actualizar la tarjeta' : 'Error al agregar la tarjeta');
    } finally {
      setIsLoadingCardOperation(false);
    }
  }

  function openEditCardModal(card) {
    setEditingCard(card);
    setCardData({
      bank: card.bank,
      type: card.type,
      lastFourDigits: card.lastFourDigits,
      nickname: card.nickname,
      creditLimit: card.creditLimit || ''
    });
    setShowCardsModal(true);
  }

  function closeCardsModal() {
    setShowCardsModal(false);
    setEditingCard(null);
    setCardData({ bank: '', type: 'credit', lastFourDigits: '', nickname: '' });
  }

  function openPayCardModal(card) {
    setPayingCard(card);
    setPayAmount('');
    setShowPayCardModal(true);
  }

  function closePayCardModal() {
    setShowPayCardModal(false);
    setPayingCard(null);
    setPayAmount('');
  }

  function openTransferModal() {
    setShowTransferModal(true);
    setTransferData({
      fromBalance: '',
      toBalance: '',
      amount: '',
      description: ''
    });
  }

  function closeTransferModal() {
    setShowTransferModal(false);
    setTransferData({
      fromBalance: '',
      toBalance: '',
      amount: '',
      description: ''
    });
  }

  function closeRecurringModal() {
    setShowRecurringModal(false);
    setRecurringData({
      type: 'income',
      amount: '',
      description: '',
      category: '',
      paymentMethod: 'efectivo',
      balance: 'principal',
      frequency: 'monthly',
      dayOfMonth: 1,
      isActive: true
    });
  }

  function closeAbonoModal() {
    setShowAbonoModal(false);
    setAbonoData({
      amount: '',
      description: '',
      balanceId: ''
    });
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
  }

  function openProfileModal() {
    setShowProfileModal(true);
    setProfileData({
      displayName: currentUser.displayName || '',
      email: currentUser.email || '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
  }

  function openAbonoModal(balance) {
    setShowAbonoModal(true);
    setAbonoData({
      amount: '',
      description: '',
      balanceId: balance.id
    });
  }

  function openCardsModal() {
    setShowCardsModal(true);
  }

  function closeCardsModal() {
    setShowCardsModal(false);
    setCardData({
      bank: '',
      type: 'credit',
      nickname: '',
      lastFourDigits: ''
    });
    setEditingCard(null);
  }

  function setDateFilterAndResetPage(filter) {
    setDateFilter(filter);
    setCurrentPage(1);
  }

  function setPaymentMethodFilterAndResetPage(filter) {
    setPaymentMethodFilter(filter);
    setCurrentPage(1);
  }

  function getBalanceAmount(balanceId) {
    const balance = balances.find(b => b.id === balanceId);
    if (!balance) return 0;

    if (balance.type === 'future') {
      // Para balances futuros, calcular el total de gastos asignados a este balance
      const futureTransactions = personalTransactions.filter(transaction => 
        transaction.type === 'expense' && 
        transaction.balance === balanceId
      );
      const futureAmount = futureTransactions.reduce((sum, transaction) => sum + (transaction.amount || 0), 0);
      return futureAmount;
    } else {
      // Para otros balances, calcular ingresos - egresos
      const balanceTransactions = personalTransactions.filter(transaction => 
        transaction.balance === balanceId
      );
      
      const totalIncome = balanceTransactions
        .filter(transaction => transaction.type === 'income')
        .reduce((sum, transaction) => sum + (transaction.amount || 0), 0);
      
      const totalExpenses = balanceTransactions
        .filter(transaction => transaction.type === 'expense')
        .filter(transaction => {
          // Solo incluir gastos que afecten el balance inmediatamente:
          // 1. Gastos con efectivo
          // 2. Gastos con tarjeta de débito
          // 3. Pagos de tarjetas de crédito
          // 4. Gastos con tarjeta de crédito que NO sean pagos de tarjeta (estos NO se incluyen)
          
          if (transaction.paymentMethod === 'efectivo') {
            return true; // Efectivo siempre afecta el balance
          }
          
          if (transaction.paymentMethod === 'tarjeta' && transaction.selectedCard) {
            const card = cards.find(c => c.id === transaction.selectedCard);
            if (card && card.type === 'debit') {
              return true; // Tarjeta de débito afecta el balance inmediatamente
            }
            if (card && card.type === 'credit') {
              // Solo incluir si es un pago de tarjeta de crédito
              const isPayment = transaction.category === 'Pago Tarjeta de Crédito';
              if (!isPayment) {
                // Este es un gasto con tarjeta de crédito que NO debe afectar el balance
                return false;
              }
              return true;
            }
          }
          
          // Para otros casos (sin tarjeta seleccionada, etc.)
          return true;
        })
        .reduce((sum, transaction) => sum + (transaction.amount || 0), 0);
      
      return totalIncome - totalExpenses;
    }
  }

  function getCreditCardPendingAmount(cardId) {
    const card = cards.find(c => c.id === cardId);
    if (!card || card.type !== 'credit') return 0;

    // Gastos con esta tarjeta (excluyendo pagos de tarjeta)
    const cardExpenses = personalTransactions
      .filter(t => t.selectedCard === cardId && t.type === 'expense' && t.category !== 'Pago Tarjeta de Crédito')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    // Pagos realizados a esta tarjeta
    const cardPayments = personalTransactions
      .filter(t => t.type === 'expense' && t.category === 'Pago Tarjeta de Crédito' && t.selectedCard === cardId)
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    
    const pending = cardExpenses - cardPayments;
    
    return pending;
  }

  async function createFutureBalance(e) {
    e.preventDefault();
    if (!currentUser) return;

    setIsLoadingBalance(true);
    try {
      await addDoc(collection(db, 'balances'), {
        userId: currentUser.uid,
        name: futureBalanceData.name,
        type: 'future',
        targetMonth: futureBalanceData.targetMonth,
        description: futureBalanceData.description || '',
        createdAt: serverTimestamp()
      });

      setFutureBalanceData({
        name: '',
        targetMonth: '',
        description: ''
      });
      setShowFutureBalanceModal(false);
      toast.success('Balance futuro creado exitosamente');
    } catch (error) {
      toast.error('Error al crear el balance futuro');
    } finally {
      setIsLoadingBalance(false);
    }
  }

  async function deleteCard(cardId) {
    showCustomAlert(
      'Eliminar Tarjeta',
      '¿Estás seguro de que quieres eliminar esta tarjeta?',
      'confirm',
      async () => {
        setIsLoadingCardOperation(true);
        try {
          await deleteDoc(doc(db, 'cards', cardId));
          toast.success('Tarjeta eliminada');
        } catch (error) {
          toast.error('Error al eliminar la tarjeta');
        } finally {
          setIsLoadingCardOperation(false);
        }
      },
      null,
      'Eliminar',
      'Cancelar'
    );
  }

  async function handleTransfer(e) {
    e.preventDefault();
    
    if (!transferData.fromBalance || !transferData.toBalance || !transferData.amount) {
      toast.error('Completa todos los campos obligatorios');
      return;
    }

    if (transferData.fromBalance === transferData.toBalance) {
      toast.error('No puedes transferir al mismo balance');
      return;
    }

    const amount = parseNumberThousands(transferData.amount);
    if (!amount || amount <= 0) {
      toast.error('Ingresa un monto válido');
      return;
    }

    const fromBalance = balances.find(b => b.id === transferData.fromBalance);
    const toBalance = balances.find(b => b.id === transferData.toBalance);

    if (!fromBalance || !toBalance) {
      toast.error('Balance no encontrado');
      return;
    }

    // Verificar que el balance origen tenga suficiente saldo
    const fromBalanceAmount = getBalanceAmount(fromBalance.id);
    if (fromBalanceAmount < amount) {
      toast.error(`Saldo insuficiente. Disponible: ${formatCurrency(fromBalanceAmount)}`);
      return;
    }

    setIsLoadingTransfer(true);
    try {
      // Crear transacción de egreso del balance origen
      const fromTransactionData = {
        type: 'expense',
        amount: amount,
        description: transferData.description || `Transferencia a ${toBalance.name}`,
        category: 'Transferencia',
        paymentMethod: 'transferencia',
        balanceId: transferData.fromBalance,
        userId: currentUser.uid,
        date: new Date(),
        createdAt: serverTimestamp(),
        isTransfer: true,
        transferTo: transferData.toBalance
      };

      // Crear transacción de ingreso al balance destino
      const toTransactionData = {
        type: 'income',
        amount: amount,
        description: transferData.description || `Transferencia desde ${fromBalance.name}`,
        category: 'Transferencia',
        paymentMethod: 'transferencia',
        balanceId: transferData.toBalance,
        userId: currentUser.uid,
        date: new Date(),
        createdAt: serverTimestamp(),
        isTransfer: true,
        transferFrom: transferData.fromBalance
      };

      // Guardar ambas transacciones
      await addDoc(collection(db, 'personalTransactions'), fromTransactionData);
      await addDoc(collection(db, 'personalTransactions'), toTransactionData);

      toast.success(`Transferencia de ${formatCurrency(amount)} realizada exitosamente`);
      closeTransferModal();
    } catch (error) {
      console.error('Error al realizar transferencia:', error);
      toast.error('Error al realizar la transferencia');
    } finally {
      setIsLoadingTransfer(false);
    }
  }

  async function handlePayCreditCard(e) {
    e.preventDefault();
    const amount = parseNumberThousands(payAmount);
    
    if (!amount || amount <= 0) {
      toast.error('Ingresa un monto válido');
      return;
    }

    const pendingAmount = getCreditCardPendingAmount(payingCard.id);
    if (amount > pendingAmount) {
      toast.error(`El monto no puede ser mayor al saldo pendiente (${formatCurrency(pendingAmount)})`);
      return;
    }

    setIsLoadingCardOperation(true);
    try {
      const transactionData = {
        userId: currentUser.uid,
        type: 'expense',
        amount: amount,
        description: `Pago tarjeta de crédito ${payingCard.nickname}`,
        category: 'Pago Tarjeta de Crédito',
        paymentMethod: 'efectivo',
        selectedCard: payingCard.id,
        date: new Date(),
        createdAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, 'personalTransactions'), transactionData);
      
      // Agregar la transacción al estado local inmediatamente
      const newTransaction = {
        id: docRef.id,
        ...transactionData,
        date: new Date(), // Asegurar que tenga fecha
        createdAt: new Date().toISOString() // Usar string ISO para el estado
      };
      
      setPersonalTransactions(prev => {
        const updated = [...prev, newTransaction];
        // Ordenar por fecha del más reciente al más antiguo
        const sorted = updated.sort((a, b) => {
          const dateA = a.date ? new Date(a.date) : new Date(a.createdAt || 0);
          const dateB = b.date ? new Date(b.date) : new Date(b.createdAt || 0);
          return dateB - dateA;
        });
        
        return sorted;
      });
      
      toast.success(`Pago de ${formatCurrency(amount)} registrado exitosamente`);
      closePayCardModal();
    } catch (error) {
      console.error('Error al registrar el pago:', error);
      toast.error('Error al registrar el pago');
    } finally {
      setIsLoadingCardOperation(false);
    }
  }

  async function handleLogout() {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      toast.error('Error al eliminar la transacción automática');
    }
  }

  // Cálculos de transacciones filtradas
  const filteredTransactions = personalTransactions
    .filter(transaction => {
      const typeMatch = recentFilter === 'all' || transaction.type === recentFilter;
      
      let dateMatch = true;
      if (dateFilter === 'today') {
        const today = new Date().toDateString();
        const transactionDate = new Date(transaction.date || transaction.createdAt?.seconds * 1000).toDateString();
        dateMatch = today === transactionDate;
      } else if (dateFilter === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const transactionDate = new Date(transaction.date || transaction.createdAt?.seconds * 1000);
        dateMatch = transactionDate >= weekAgo;
      } else if (dateFilter === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        const transactionDate = new Date(transaction.date || transaction.createdAt?.seconds * 1000);
        dateMatch = transactionDate >= monthAgo;
      } else if (dateFilter === 'custom' && startDate && endDate) {
        const transactionDate = new Date(transaction.date || transaction.createdAt?.seconds * 1000);
        const start = new Date(startDate);
        const end = new Date(endDate);
        dateMatch = transactionDate >= start && transactionDate <= end;
      }
      
      let paymentMethodMatch = true;
      if (paymentMethodFilter !== 'all' && transaction.type === 'expense') {
        paymentMethodMatch = transaction.paymentMethod === paymentMethodFilter;
      }
      
      const passesFilter = typeMatch && dateMatch && paymentMethodMatch;
      
      return passesFilter;
    })
    .sort((a, b) => {
      // Ordenar por fecha del más reciente al más antiguo
      const dateA = a.date ? new Date(a.date) : new Date(a.createdAt || 0);
      const dateB = b.date ? new Date(b.date) : new Date(b.createdAt || 0);
      return dateB - dateA;
    });

  // Cálculos de paginación
  const indexOfLastTransaction = currentPage * transactionsPerPage;
  const indexOfFirstTransaction = indexOfLastTransaction - transactionsPerPage;
  const currentTransactions = filteredTransactions.slice(indexOfFirstTransaction, indexOfLastTransaction);
  const totalPages = Math.ceil(filteredTransactions.length / transactionsPerPage);

  // Cálculos de gastos por tarjeta
  const getCardExpenses = (cardId) => {
    return personalTransactions
      .filter(t => t.selectedCard === cardId && t.type === 'expense' && t.category !== 'Pago Tarjeta de Crédito')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
  };

  const cardExpenses = cards.map(card => ({
    ...card,
    totalExpenses: getCardExpenses(card.id)
  })).filter(card => card.totalExpenses > 0);

  // Cálculos de balances con montos
  const balancesWithCurrentAmount = balances.map(balance => {
    if (balance.type === 'future') {
      const futureTransactions = personalTransactions.filter(transaction => 
        transaction.type === 'expense' && 
        transaction.balance === balance.id
      );
      const futureAmount = futureTransactions.reduce((sum, transaction) => sum + (transaction.amount || 0), 0);
      return {
        ...balance,
        currentAmount: futureAmount
      };
    } else {
      const balanceTransactions = personalTransactions.filter(transaction => 
        transaction.balance === balance.id
      );
      
      const totalIncome = balanceTransactions
        .filter(transaction => transaction.type === 'income')
        .reduce((sum, transaction) => sum + (transaction.amount || 0), 0);
      
      const totalExpenses = balanceTransactions
        .filter(transaction => transaction.type === 'expense')
        .filter(transaction => {
          // Solo incluir gastos que afecten el balance inmediatamente:
          // 1. Gastos con efectivo
          // 2. Gastos con tarjeta de débito
          // 3. Pagos de tarjetas de crédito
          // 4. Gastos con tarjeta de crédito que NO sean pagos de tarjeta (estos NO se incluyen)
          
          if (transaction.paymentMethod === 'efectivo') {
            return true; // Efectivo siempre afecta el balance
          }
          
          if (transaction.paymentMethod === 'tarjeta' && transaction.selectedCard) {
            const card = cards.find(c => c.id === transaction.selectedCard);
            if (card && card.type === 'debit') {
              return true; // Tarjeta de débito afecta el balance inmediatamente
            }
            if (card && card.type === 'credit') {
              // Solo incluir si es un pago de tarjeta de crédito
              const isPayment = transaction.category === 'Pago Tarjeta de Crédito';
              if (!isPayment) {
                // Este es un gasto con tarjeta de crédito que NO debe afectar el balance
                return false;
              }
              return true;
            }
          }
          
          // Para otros casos (sin tarjeta seleccionada, etc.)
          return true;
        })
        .reduce((sum, transaction) => sum + (transaction.amount || 0), 0);
      
      const currentAmount = totalIncome - totalExpenses;
      
      return {
        ...balance,
        currentAmount: currentAmount
      };
    }
  });

  const allBalancesWithAmounts = [...balancesWithCurrentAmount];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Indicador de estado de conexión */}
      {connectionStatus === 'error' && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm">
                <strong>Error de conexión:</strong> Hay problemas para conectar con la base de datos. 
                Verifica tu conexión a internet y recarga la página.
              </p>
            </div>
          </div>
        </div>
      )}
      
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
            {(Object.keys(paymentMethodTotals).length > 0 || cardExpenses.length > 0) && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <CreditCard className="h-5 w-5 mr-2" />
                  Egresos por Método de Pago
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Efectivo */}
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
                  
                  {/* Tarjetas individuales */}
                  {cardExpenses.map((card) => (
                    <div key={card.id} className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg shadow p-6 border border-blue-200">
                      <div className="flex items-center">
                        <CreditCard className="h-8 w-8 text-blue-600" />
                        <div className="ml-4 flex-1">
                          <p className="text-sm font-medium text-blue-700">{card.nickname}</p>
                          <p className="text-xs text-blue-600 mb-1">{card.bank} (****{card.lastFourDigits})</p>
                          <p className="text-2xl font-semibold text-blue-800">
                            {formatCurrency(card.totalExpenses)}
                          </p>
                          <div className="flex items-center mt-1">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              card.type === 'credit' ? 'bg-blue-200 text-blue-800' : 'bg-green-200 text-green-800'
                            }`}>
                              {card.type === 'credit' ? 'Crédito' : 'Débito'}
                            </span>
                        </div>
                      </div>
                    </div>
                        </div>
                  ))}
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
                  onClick={openTransferModal}
                  disabled={isLoadingTransfer}
                  className={`group flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all duration-200 transform ${
                    isLoadingTransfer 
                      ? 'bg-blue-400 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 hover:scale-105 hover:shadow-lg'
                  } text-white shadow-md`}
                >
                  {isLoadingTransfer ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <ArrowLeftRight className="h-5 w-5 group-hover:scale-110 transition-transform duration-200" />
                  )}
                  <span>{isLoadingTransfer ? 'Procesando...' : 'Transferir'}</span>
                </button>

                <button
                  onClick={openCardsModal}
                  className="group flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all duration-200 transform bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 hover:scale-105 hover:shadow-lg text-white shadow-md"
                >
                  <CreditCard className="h-5 w-5 group-hover:scale-110 transition-transform duration-200" />
                  <span>Mis Tarjetas</span>
                </button>

                <button
                  onClick={() => setShowFutureBalanceModal(true)}
                  className="group flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all duration-200 transform bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 hover:scale-105 hover:shadow-lg text-white shadow-md"
                >
                  <Calendar className="h-5 w-5 group-hover:scale-110 transition-transform duration-200" />
                  <span>Balance Futuro</span>
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
                {allBalancesWithAmounts.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Target className="h-5 w-5 mr-2" />
                  Mis Balances
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {allBalancesWithAmounts.map((balance) => (
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
                            {/* Botones solo si NO es el balance general (estático) */}
                            {balance.type !== 'general' && (
                              <>
                                <button
                                  onClick={() => openAbonoModal(balance)}
                                  className="ml-2 px-3 py-1 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 text-xs font-semibold"
                                  title="Abonar a este balance"
                                >
                                  Abonar
                                </button>
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
                              </>
                            )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{balance.description}</p>
                      {balance.type === 'future' && balance.targetMonth && (
                        <p className="text-xs text-orange-600 mb-2 font-medium">
                          📅 Pago programado para: {balance.targetMonth}
                        </p>
                      )}
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

            {/* Mis Tarjetas */}
            {cards.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <CreditCard className="h-5 w-5 mr-2" />
                  Mis Tarjetas
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {cards.map((card) => (
                    <div key={card.id} className={`p-6 rounded-xl shadow-lg border-2 transition-all duration-200 hover:shadow-xl hover:scale-105 ${
                      card.type === 'credit' 
                        ? 'bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 hover:border-purple-300'
                        : 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:border-blue-300'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <CreditCard className={`h-5 w-5 ${card.type === 'credit' ? 'text-purple-600' : 'text-blue-600'}`} />
                          <h4 className="font-semibold text-gray-900">{card.nickname}</h4>
                        </div>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => openEditCardModal(card)}
                            className="group p-2 rounded-lg hover:bg-blue-100 transition-all duration-200 transform hover:scale-110"
                            title="Editar tarjeta"
                          >
                            <Edit3 className="h-4 w-4 text-blue-600 group-hover:text-blue-700" />
                          </button>
                          <button
                            onClick={() => deleteCard(card.id)}
                            className="group p-2 rounded-lg hover:bg-red-100 transition-all duration-200 transform hover:scale-110"
                            title="Eliminar tarjeta"
                          >
                            <Trash2 className="h-4 w-4 text-red-600 group-hover:text-red-700" />
                          </button>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-2">
                        {card.bank} •••• {card.lastFourDigits}
                      </p>
                      
                      <div className="flex items-center space-x-2 mb-2">
                        <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                          card.type === 'credit' 
                            ? 'bg-purple-200 text-purple-800' 
                            : 'bg-blue-200 text-blue-800'
                        }`}>
                          {card.type === 'credit' ? 'Crédito' : 'Débito'}
                        </span>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Gasto total:</span>
                          <span className="text-lg font-bold text-gray-900">
                            {formatCurrency(getCardExpenses(card.id))}
                          </span>
                        </div>
                        
                        {card.type === 'credit' && card.creditLimit && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Límite:</span>
                            <span className="text-sm font-medium text-purple-600">
                              {formatCurrency(parseInt(card.creditLimit))}
                            </span>
                          </div>
                        )}
                        
                        {card.type === 'credit' && getCreditCardPendingAmount(card.id) > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Pendiente:</span>
                            <span className="text-sm font-medium text-red-600">
                              {formatCurrency(getCreditCardPendingAmount(card.id))}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {card.type === 'credit' && (
                        <div className="mt-3">
                          <button
                            onClick={() => openPayCardModal(card)}
                            className="w-full px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-semibold transition-colors duration-200"
                            title="Pagar tarjeta"
                          >
                            Pagar
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Transacciones Recientes */}
              <div className="mb-8">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Calendar className="h-5 w-5 mr-2" />
                  Transacciones Recientes
                </h3>
                <div className="flex flex-wrap gap-2">
                  {/* Filtro de Tipo */}
                  <div className="relative">
                    <select
                      value={recentFilter}
                      onChange={(e) => setRecentFilterAndResetPage(e.target.value)}
                      className="appearance-none bg-white border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm text-gray-700 hover:border-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors duration-200"
                    >
                      <option value="all">Todas</option>
                      <option value="income">Solo Ingresos</option>
                      <option value="expense">Solo Egresos</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  
                  {/* Filtro de Fecha */}
                  <div className="relative">
                    <select
                      value={dateFilter}
                      onChange={(e) => setDateFilterAndResetPage(e.target.value)}
                      className="appearance-none bg-white border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm text-gray-700 hover:border-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors duration-200"
                    >
                      <option value="all">Todas las fechas</option>
                      <option value="today">Hoy</option>
                      <option value="week">Esta semana</option>
                      <option value="month">Este mes</option>
                      <option value="year">Este año</option>
                      <option value="custom">Rango personalizado</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  
                  {/* Filtro de Método de Pago */}
                  <div className="relative">
                    <select
                      value={paymentMethodFilter}
                      onChange={(e) => setPaymentMethodFilterAndResetPage(e.target.value)}
                      className={`appearance-none border rounded-lg px-3 py-2 pr-8 text-sm focus:ring-1 focus:outline-none transition-colors duration-200 ${
                        recentFilter === 'income' 
                          ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed' 
                          : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400 focus:border-blue-500 focus:ring-blue-500'
                      }`}
                      disabled={recentFilter === 'income'}
                    >
                      <option value="all">Todos los métodos</option>
                      <option value="efectivo">Efectivo</option>
                      <option value="tarjeta">Tarjeta</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  
                  {/* Botón para limpiar filtros */}
                  {(recentFilter !== 'all' || dateFilter !== 'all' || paymentMethodFilter !== 'all') && (
                    <button
                      onClick={() => {
                        setRecentFilterAndResetPage('all');
                        setDateFilterAndResetPage('all');
                        setPaymentMethodFilterAndResetPage('all');
                        setStartDate('');
                        setEndDate('');
                      }}
                      className="flex items-center space-x-1 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 hover:text-gray-700 rounded-lg text-sm font-medium transition-colors duration-200 border border-gray-200 hover:border-gray-300"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>Limpiar</span>
                    </button>
                  )}
                </div>
                              </div>

              {/* Filtros de fecha personalizados */}
              {dateFilter === 'custom' && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg border">
                  <div className="flex flex-wrap gap-4 items-end">
                    <div className="flex-1 min-w-48">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Fecha inicio
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => {
                          setStartDate(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                                </div>
                    <div className="flex-1 min-w-48">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Fecha fin
                      </label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => {
                          setEndDate(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                              </div>
                                <button
                      onClick={() => {
                        setStartDate('');
                        setEndDate('');
                        setCurrentPage(1);
                      }}
                      className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Limpiar
                                </button>
                              </div>
                      </div>
                    )}

              {/* Información de resultados */}
              <div className="mb-4 text-sm text-gray-600">
                Mostrando {filteredTransactions.length} transacción{filteredTransactions.length !== 1 ? 'es' : ''}
                {dateFilter !== 'all' && startDate && endDate && (
                  <span> del {formatDateString(startDate)} al {formatDateString(endDate)}</span>
                )}
                {paymentMethodFilter !== 'all' && recentFilter === 'expense' && (
                  <span> pagadas con {paymentMethodFilter === 'efectivo' ? '💵 efectivo' : '💳 tarjeta'}</span>
                )}
                  </div>
                  
              {filteredTransactions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No hay transacciones registradas</p>
                  </div>
              ) : (
                <div className="space-y-3">
                        {currentTransactions.map((transaction) => {
                          // Determinar si es un pago de tarjeta de crédito o un gasto con tarjeta de crédito
                          const isCreditPayment = transaction.category === 'Pago Tarjeta de Crédito';
                          const isCreditExpense = transaction.isCreditExpense === true;
                          const isTransfer = transaction.category === 'Transferencia';
                  
                          return (
                        <div key={transaction.id} className={`p-4 rounded-lg border-l-4 ${
                          transaction.type === 'income' 
                        ? isTransfer
                          ? 'bg-blue-50 border-blue-400'
                          : 'bg-green-50 border-green-400' 
                        : isCreditPayment || isCreditExpense
                        ? 'bg-orange-50 border-orange-400'
                        : isTransfer
                        ? 'bg-blue-50 border-blue-400'
                        : 'bg-red-50 border-red-400'
                    }`}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                                {transaction.type === 'income' ? (
                              isTransfer ? (
                                <ArrowLeftRight className="h-4 w-4 text-blue-600" />
                              ) : (
                                <TrendingUp className="h-4 w-4 text-green-600" />
                              )
                            ) : isCreditPayment || isCreditExpense ? (
                              <CreditCard className="h-4 w-4 text-orange-600" />
                            ) : isTransfer ? (
                              <ArrowLeftRight className="h-4 w-4 text-blue-600" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-red-600" />
                            )}
                            <span className="font-medium text-gray-900">{transaction.description}</span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    transaction.type === 'income' 
                                      ? isTransfer
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-green-100 text-green-800' 
                                      : isCreditPayment || isCreditExpense
                                      ? 'bg-orange-100 text-orange-800'
                                      : isTransfer
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}>
                                    {transaction.category}
                                  </span>
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-gray-600">
                            <span>{formatDateString(transaction.date)}</span>
                                  {transaction.paymentMethod && (
                              <span className="flex items-center space-x-1">
                                {transaction.paymentMethod === 'efectivo' && <Banknote className="h-3 w-3" />}
                                {transaction.paymentMethod === 'tarjeta' && <CreditCard className="h-3 w-3" />}
                                      <span className="capitalize">{transaction.paymentMethod}</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                        <div className="flex items-center space-x-2">
                          <div className="text-right">
                                                          <span className={`text-lg font-semibold ${
                                transaction.type === 'income' 
                                    ? isTransfer
                                      ? 'text-blue-600'
                                      : 'text-green-600'
                                    : isCreditPayment || isCreditExpense
                                    ? 'text-orange-600'
                                    : isTransfer
                                    ? 'text-blue-600'
                                    : 'text-red-600'
                              }`}>
                                {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                              </span>
                            {isCreditPayment && (
                              <p className="text-xs text-orange-600 font-medium">
                                Pago realizado
                              </p>
                            )}
                            {isCreditExpense && !isCreditPayment && (
                              <p className="text-xs text-orange-600 font-medium">
                                Gasto con tarjeta de crédito
                              </p>
                            )}
                            {isTransfer && (
                              <p className="text-xs text-blue-600 font-medium">
                                Transferencia
                              </p>
                            )}
                          </div>
                          <div className="flex space-x-1">
                                <button
                                  onClick={() => openTransactionModal(transaction.type, transaction)}
                              className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                  title="Editar transacción"
                                >
                              <Edit3 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => deleteTransaction(transaction.id)}
                              className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                  title="Eliminar transacción"
                                >
                              <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                        );
                        })}
                      </div>
                    )}
                    
              {/* Paginación */}
              {totalPages > 1 && (
                <div className="mt-6">
                  <div className="flex justify-between items-center mb-4">
                    <div className="text-sm text-gray-600">
                      Mostrando {indexOfFirstTransaction + 1} a {Math.min(indexOfLastTransaction, filteredTransactions.length)} de {filteredTransactions.length} transacciones
                    </div>
                    <div className="text-sm text-gray-500">
                      Página {currentPage} de {totalPages}
                    </div>
                          </div>
                          
                  <div className="flex justify-center items-center space-x-2">
                            <button
                      onClick={() => setCurrentPage(1)}
                              disabled={currentPage === 1}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Primera
                            </button>
                            
                                <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    
                    {/* Números de página */}
                    <div className="flex space-x-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`px-3 py-2 text-sm rounded-lg ${
                              currentPage === pageNum
                                ? 'bg-blue-600 text-white'
                                : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                                </button>
                        );
                      })}
                            </div>
                            
                            <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                              disabled={currentPage === totalPages}
                      className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Última
                            </button>
                        </div>
                      </div>
                    )}
                  </div>

            {/* Transacciones Automáticas */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Repeat className="h-5 w-5 mr-2" />
                  Transacciones Automáticas
                </h3>
                <div className="flex space-x-2">
                  <select
                    value={recurringFilter}
                    onChange={(e) => setRecurringFilter(e.target.value)}
                    className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">Todas</option>
                    <option value="income">Solo Ingresos</option>
                    <option value="expense">Solo Egresos</option>
                  </select>
                  </div>
                </div>
                
              {filteredRecurringTransactions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Repeat className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No hay transacciones automáticas configuradas</p>
                    </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredRecurringTransactions.map((transaction) => (
                    <div key={transaction.id} className={`p-4 rounded-lg border-l-4 ${
                      transaction.type === 'income' 
                        ? 'bg-green-50 border-green-400' 
                        : 'bg-red-50 border-red-400'
                    }`}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            {transaction.type === 'income' ? (
                              <TrendingUp className="h-4 w-4 text-green-600" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-red-600" />
                            )}
                            <span className="font-medium text-gray-900">{transaction.description}</span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              transaction.isActive 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {transaction.isActive ? 'Activo' : 'Inactivo'}
                            </span>
                  </div>
                          <div className="text-sm text-gray-600 space-y-1">
                            <div className="flex items-center space-x-1">
                              <Calendar className="h-3 w-3" />
                              <span>Día {transaction.dayOfMonth} de cada mes</span>
                </div>
                            {transaction.paymentMethod && (
                              <div className="flex items-center space-x-1">
                                {transaction.paymentMethod === 'efectivo' && <Banknote className="h-3 w-3" />}
                                {transaction.paymentMethod === 'tarjeta' && <CreditCard className="h-3 w-3" />}
                                <span className="capitalize">{transaction.paymentMethod}</span>
              </div>
                            )}
            </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`text-lg font-semibold ${
                            transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                          </span>
                          <div className="flex space-x-1">
                <button
                              onClick={() => toggleRecurringTransaction(transaction.id, !transaction.isActive)}
                              className={`p-1 rounded transition-colors ${
                                transaction.isActive 
                                  ? 'text-green-600 hover:text-green-700' 
                                  : 'text-gray-400 hover:text-green-600'
                              }`}
                              title={transaction.isActive ? 'Desactivar' : 'Activar'}
                            >
                              <Zap className="h-4 w-4" />
                </button>
                <button
                              onClick={() => deleteRecurringTransaction(transaction.id)}
                              className="p-1 text-gray-400 hover:text-red-600 transition-colors"
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
              )}
            </div>


          </div>
        ) : (
          /* Contenido de Gastos Compartidos */
          <div>
            {/* Estadísticas Grupales */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Users className="h-5 w-5 mr-2" />
                Salas de Gastos Compartidos
              </h3>
              
              {rooms.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No tienes salas de gastos compartidos</p>
                  <p className="text-sm">Únete a una sala o crea una nueva para comenzar</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rooms.map((room) => (
                    <div key={room.id} className="p-6 rounded-xl shadow-lg border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 hover:shadow-xl hover:scale-105 transition-all duration-200">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-2">
                          <Users className="h-6 w-6 text-blue-600" />
                          <h4 className="font-semibold text-gray-900">{room.name}</h4>
                        </div>
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                          {room.members?.length || 0} miembros
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-4">{room.description}</p>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">
                          Creado: {room.createdAt ? new Date(room.createdAt.seconds * 1000).toLocaleDateString('es-CO') : 'N/A'}
                        </span>
                      <button
                        onClick={() => navigate(`/room/${room.id}`)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                          Entrar
                      </button>
                    </div>
                  </div>
                ))}
                </div>
              )}
            </div>

            {/* Acciones de Salas */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Acciones de Salas</h3>
              <div className="flex flex-wrap gap-4">
                  <button
                  onClick={() => setShowJoinRoomModal(true)}
                  className="group flex items-center space-x-2 px-6 py-3 rounded-xl font-medium bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-md hover:scale-105 hover:shadow-lg transition-all duration-200 transform"
                  >
                  <Users className="h-5 w-5 group-hover:scale-110 transition-transform duration-200" />
                  <span>Unirse a Sala</span>
                  </button>
                
                  <button
                  onClick={() => setShowCreateRoomModal(true)}
                  className="group flex items-center space-x-2 px-6 py-3 rounded-xl font-medium bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white shadow-md hover:scale-105 hover:shadow-lg transition-all duration-200 transform"
                  >
                  <Plus className="h-5 w-5 group-hover:scale-110 transition-transform duration-200" />
                  <span>Crear Nueva Sala</span>
                  </button>
                </div>
            </div>
          </div>
        )}

        {/* Profile Modal */}
        {showProfileModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">Mi Perfil</h3>
              <form onSubmit={updateProfile}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nombre de Usuario
                    </label>
                    <input
                      type="text"
                      value={profileData.displayName}
                      onChange={(e) => setProfileData({...profileData, displayName: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Tu nombre de usuario"
                      required
                    />
                  </div>
                  
                  <div className="border-t pt-4">
                    <h4 className="text-md font-semibold text-gray-900 mb-3">Cambiar Contraseña</h4>
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
            <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-3">
                {editingTransaction 
                  ? `Editar ${transactionData.type === 'income' ? 'Ingreso' : 'Egreso'}`
                  : `Agregar ${transactionData.type === 'income' ? 'Ingreso' : 'Egreso'}`
                }
              </h3>
              <form onSubmit={addTransaction}>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Tipo
                    </label>
                    <select
                      value={transactionData.type}
                      onChange={(e) => setTransactionData({...transactionData, type: e.target.value})}
                      className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="income">Ingreso</option>
                      <option value="expense">Egreso</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Descripción
                    </label>
                    <input
                      type="text"
                      value={transactionData.description}
                      onChange={(e) => setTransactionData({...transactionData, description: e.target.value})}
                      className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ej: Salario, Compras, etc."
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Monto (COP)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatNumberThousands(transactionData.amount)}
                      onChange={e => {
                        const raw = parseNumberThousands(e.target.value);
                        if (/^\d*$/.test(raw)) {
                          setTransactionData({ ...transactionData, amount: raw });
                        }
                      }}
                      className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                        onChange={(e) => setTransactionData({...transactionData, paymentMethod: e.target.value, selectedCard: ''})}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="efectivo">💵 Efectivo</option>
                        <option value="tarjeta">💳 Tarjeta</option>
                      </select>
                      
                      {transactionData.paymentMethod === 'tarjeta' && (
                        <div className="mt-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Seleccionar Tarjeta
                          </label>
                          <select
                            value={transactionData.selectedCard || ''}
                            onChange={(e) => setTransactionData({...transactionData, selectedCard: e.target.value})}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                          >
                            <option value="">Seleccionar tarjeta</option>
                            {cards.map((card) => (
                              <option key={card.id} value={card.id}>
                                {card.type === 'credit' ? '💳' : '💳'} {card.bank} - {card.nickname} (****{card.lastFourDigits})
                              </option>
                            ))}
                          </select>
                          {cards.length === 0 && (
                            <p className="text-xs text-orange-600 mt-1">
                              No tienes tarjetas registradas. <button type="button" onClick={() => setShowCardsModal(true)} className="underline">Agregar tarjeta</button>
                            </p>
                          )}
                          
                          {/* Mostrar gasto acumulado de la tarjeta seleccionada */}
                          {transactionData.selectedCard && (
                            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <CreditCard className="h-4 w-4 text-blue-600" />
                                  <span className="text-sm font-medium text-blue-800">
                                    Gasto acumulado con esta tarjeta:
                                  </span>
                                </div>
                                <span className="text-sm font-semibold text-blue-900">
                                  {formatCurrency(getCardExpenses(transactionData.selectedCard))}
                                </span>
                              </div>
                              {getCardExpenses(transactionData.selectedCard) > 0 && (
                                <p className="text-xs text-blue-700 mt-1">
                                  Este monto se sumará al total actual
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Asignar a Balance (Opcional)
                    </label>
                    <select
                      value={transactionData.balance}
                      onChange={(e) => setTransactionData({...transactionData, balance: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Sin asignar</option>
                      {allBalancesWithAmounts.map((balance) => (
                        <option key={balance.id} value={balance.id}>
                          {balance.type === 'future' ? '📅 ' : 
                           balance.type === 'savings' ? '🐷 ' : 
                           balance.type === 'debt' ? '⚠️ ' : '💰 '}
                          {balance.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Selecciona un balance para asignar esta transacción (útil para balances futuros)
                    </p>
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
                      <option value="future">📅 Balance Futuro</option>
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
                  
                  {balanceData.type === 'future' ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Mes de Pago
                      </label>
                      <input
                        type="month"
                        value={balanceData.targetMonth}
                        onChange={(e) => setBalanceData({...balanceData, targetMonth: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Selecciona el mes en que planeas pagar estos gastos de tarjeta de crédito
                      </p>
                    </div>
                  ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Meta (Opcional)
                    </label>
                    <input
                        type="text"
                        inputMode="numeric"
                        value={formatNumberThousands(balanceData.goal)}
                        onChange={e => {
                          const raw = parseNumberThousands(e.target.value);
                          if (/^\d*$/.test(raw)) {
                            setBalanceData({ ...balanceData, goal: raw });
                          }
                        }}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {balanceData.type === 'savings' ? 'Cantidad que quieres ahorrar' :
                       balanceData.type === 'debt' ? 'Cantidad de la deuda total' :
                       'Meta financiera para este balance'}
                    </p>
                  </div>
                  )}
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
                      type="text"
                      inputMode="numeric"
                      value={formatNumberThousands(recurringData.amount)}
                      onChange={e => {
                        const raw = parseNumberThousands(e.target.value);
                        if (/^\d*$/.test(raw)) {
                          setRecurringData({ ...recurringData, amount: raw });
                        }
                      }}
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
                        onChange={(e) => setRecurringData({...recurringData, paymentMethod: e.target.value, selectedCard: ''})}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="efectivo">💵 Efectivo</option>
                        <option value="tarjeta">💳 Tarjeta</option>
                      </select>

                      {recurringData.paymentMethod === 'tarjeta' && (
                        <div className="mt-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                            Seleccionar Tarjeta
                    </label>
                    <select
                            value={recurringData.selectedCard || ''}
                            onChange={(e) => setRecurringData({...recurringData, selectedCard: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                          >
                            <option value="">Seleccionar tarjeta</option>
                            {cards.map((card) => (
                              <option key={card.id} value={card.id}>
                                {card.type === 'credit' ? '💳' : '💳'} {card.bank} - {card.nickname} (****{card.lastFourDigits})
                        </option>
                      ))}
                    </select>
                          {cards.length === 0 && (
                            <p className="text-xs text-orange-600 mt-1">
                              No tienes tarjetas registradas. <button type="button" onClick={() => setShowCardsModal(true)} className="underline">Agregar tarjeta</button>
                            </p>
                          )}
                          
                          {/* Mostrar gasto acumulado de la tarjeta seleccionada */}
                          {recurringData.selectedCard && (
                            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <CreditCard className="h-4 w-4 text-blue-600" />
                                  <span className="text-sm font-medium text-blue-800">
                                    Gasto acumulado con esta tarjeta:
                                  </span>
                  </div>
                                <span className="text-sm font-semibold text-blue-900">
                                  {formatCurrency(getCardExpenses(recurringData.selectedCard))}
                                </span>
                              </div>
                              {getCardExpenses(recurringData.selectedCard) > 0 && (
                                <p className="text-xs text-blue-700 mt-1">
                                  Este monto se sumará al total actual
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  
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

        {/* Modal de Transferencias */}
        {showTransferModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">Transferir entre Balances</h3>
              <form onSubmit={handleTransfer}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Balance Origen
                    </label>
                    <select
                      value={transferData.fromBalance}
                      onChange={(e) => setTransferData({...transferData, fromBalance: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Seleccionar balance origen</option>
                      {allBalancesWithAmounts.map(balance => (
                        <option key={balance.id} value={balance.id}>
                          {balance.name} - {formatCurrency(balance.currentAmount)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Balance Destino
                    </label>
                    <select
                      value={transferData.toBalance}
                      onChange={(e) => setTransferData({...transferData, toBalance: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Seleccionar balance destino</option>
                      {allBalancesWithAmounts
                        .filter(balance => balance.id !== transferData.fromBalance)
                        .map(balance => (
                          <option key={balance.id} value={balance.id}>
                            {balance.name} - {formatCurrency(balance.currentAmount)}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Monto
                    </label>
                    <input
                      type="text"
                      value={transferData.amount}
                      onChange={(e) => setTransferData({...transferData, amount: e.target.value})}
                      placeholder="0"
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Descripción (opcional)
                    </label>
                    <input
                      type="text"
                      value={transferData.description}
                      onChange={(e) => setTransferData({...transferData, description: e.target.value})}
                      placeholder="Transferencia entre balances"
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="flex space-x-3 mt-6">
                  <button
                    type="submit"
                    disabled={isLoadingTransfer}
                    className={`flex-1 text-white py-2 px-4 rounded-lg transition-colors ${
                      isLoadingTransfer 
                        ? 'bg-blue-400 cursor-not-allowed' 
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isLoadingTransfer ? 'Procesando...' : 'Transferir'}
                  </button>
                  <button
                    type="button"
                    onClick={closeTransferModal}
                    className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Tarjetas */}
        {showCardsModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Mis Tarjetas</h3>
                <button
                  onClick={closeCardsModal}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Lista de tarjetas */}
                {cards.length > 0 ? (
                  <div className="space-y-3">
                    {cards.map(card => (
                      <div key={card.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <CreditCard className="h-5 w-5 text-blue-600" />
                              <span className="font-medium">{card.bank}</span>
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                card.type === 'credit' 
                                  ? 'bg-red-100 text-red-800' 
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {card.type === 'credit' ? 'Crédito' : 'Débito'}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-1">
                              {card.nickname} •••• {card.lastFourDigits}
                            </p>
                            <p className="text-sm font-medium text-gray-800">
                              Gasto total: {formatCurrency(getCardExpenses(card.id))}
                            </p>
                            {card.type === 'credit' && card.creditLimit && (
                              <p className="text-sm font-medium text-blue-600">
                                Límite: {formatCurrency(parseInt(card.creditLimit))}
                              </p>
                            )}
                            {card.type === 'credit' && getCreditCardPendingAmount(card.id) > 0 && (
                              <p className="text-sm font-medium text-red-600">
                                Pendiente: {formatCurrency(getCreditCardPendingAmount(card.id))}
                              </p>
                            )}
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => openEditCardModal(card)}
                              className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                              title="Editar tarjeta"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            {card.type === 'credit' && (
                              <button
                                onClick={() => openPayCardModal(card)}
                                className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors duration-200"
                                title="Pagar tarjeta"
                              >
                                <DollarSign className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={() => deleteCard(card.id)}
                              className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors duration-200"
                              title="Eliminar tarjeta"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <CreditCard className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No tienes tarjetas registradas</p>
                  </div>
                )}

                {/* Formulario para agregar/editar tarjeta */}
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">
                    {editingCard ? 'Editar Tarjeta' : 'Agregar Nueva Tarjeta'}
                  </h4>
                  <form onSubmit={addCard} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Banco
                        </label>
                        <select
                          value={cardData.bank}
                          onChange={(e) => setCardData({...cardData, bank: e.target.value})}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        >
                          <option value="">Seleccionar banco</option>
                          <optgroup label="Bancos Colombianas">
                            <option value="Bancolombia">Bancolombia</option>
                            <option value="BBVA Colombia">BBVA Colombia</option>
                            <option value="Davivienda">Davivienda</option>
                            <option value="Colpatria">Colpatria</option>
                            <option value="Scotiabank Colpatria">Scotiabank Colpatria</option>
                            <option value="Citibank Colombia">Citibank Colombia</option>
                            <option value="HSBC Colombia">HSBC Colombia</option>
                            <option value="Banco de Bogotá">Banco de Bogotá</option>
                            <option value="Banco Popular">Banco Popular</option>
                            <option value="Banco AV Villas">Banco AV Villas</option>
                            <option value="Banco Caja Social">Banco Caja Social</option>
                            <option value="Banco Falabella">Banco Falabella</option>
                            <option value="Banco Pichincha">Banco Pichincha</option>
                            <option value="Banco Santander">Banco Santander</option>
                            <option value="Banco Agrario">Banco Agrario</option>
                            <option value="Banco Cooperativo Coopcentral">Banco Cooperativo Coopcentral</option>
                            <option value="Bancoomeva">Bancoomeva</option>
                            <option value="Banco Finandina">Banco Finandina</option>
                            <option value="Banco Mundo Mujer">Banco Mundo Mujer</option>
                            <option value="Banco W">Banco W</option>
                            <option value="Banco Compartir">Banco Compartir</option>
                            <option value="Banco Serfinanza">Banco Serfinanza</option>
                            <option value="Banco ProCredit">Banco ProCredit</option>
                            <option value="Banco Itaú">Banco Itaú</option>
                            <option value="Banco GNB Sudameris">Banco GNB Sudameris</option>
                            <option value="Banco de Occidente">Banco de Occidente</option>
                            <option value="Banco Corpbanca">Banco Corpbanca</option>
                            <option value="Banco Helm">Banco Helm</option>
                            <option value="Banco Colmena">Banco Colmena</option>
                            <option value="Banco Coopcentral">Banco Coopcentral</option>
                            <option value="Banco Coomeva">Banco Coomeva</option>
                            <option value="Banco Credifinanciera">Banco Credifinanciera</option>
                            <option value="Banco Financiero">Banco Financiero</option>
                            <option value="Banco Finandina">Banco Finandina</option>
                            <option value="Banco GNB Sudameris">Banco GNB Sudameris</option>
                            <option value="Banco Itaú">Banco Itaú</option>
                            <option value="Banco Mundo Mujer">Banco Mundo Mujer</option>
                            <option value="Banco Pichincha">Banco Pichincha</option>
                            <option value="Banco Popular">Banco Popular</option>
                            <option value="Banco ProCredit">Banco ProCredit</option>
                            <option value="Banco Santander">Banco Santander</option>
                            <option value="Banco Serfinanza">Banco Serfinanza</option>
                            <option value="Banco W">Banco W</option>
                          </optgroup>
                          <optgroup label="Billeteras Digitales">
                            <option value="Nequi">Nequi</option>
                            <option value="Daviplata">Daviplata</option>
                            <option value="Movii">Movii</option>
                            <option value="Lulo Bank">Lulo Bank</option>
                            <option value="RappiPay">RappiPay</option>
                            <option value="Ualá">Ualá</option>
                            <option value="Tyba">Tyba</option>
                            <option value="Powwi">Powwi</option>
                          </optgroup>
                          <optgroup label="Internacionales">
                            <option value="PayPal">PayPal</option>
                            <option value="Wise">Wise</option>
                            <option value="Remitly">Remitly</option>
                            <option value="Western Union">Western Union</option>
                            <option value="Visa">Visa</option>
                            <option value="Mastercard">Mastercard</option>
                            <option value="American Express">American Express</option>
                          </optgroup>
                          <option value="Otro">Otro</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tipo
                        </label>
                        <select
                          value={cardData.type}
                          onChange={(e) => {
                            const newType = e.target.value;
                            setCardData({
                              ...cardData, 
                              type: newType,
                              // Limpiar límite de crédito si se cambia a débito
                              creditLimit: newType === 'debit' ? '' : cardData.creditLimit
                            });
                          }}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="credit">Crédito</option>
                          <option value="debit">Débito</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Apodo
                        </label>
                        <input
                          type="text"
                          value={cardData.nickname}
                          onChange={(e) => setCardData({...cardData, nickname: e.target.value})}
                          placeholder="Ej: Mi Visa"
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Últimos 4 dígitos
                        </label>
                        <input
                          type="text"
                          value={cardData.lastFourDigits}
                          onChange={(e) => setCardData({...cardData, lastFourDigits: e.target.value})}
                          placeholder="1234"
                          maxLength="4"
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                      </div>

                      {cardData.type === 'credit' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Límite de crédito
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formatNumberThousands(cardData.creditLimit)}
                            onChange={(e) => {
                              const raw = parseNumberThousands(e.target.value);
                              if (/^\d*$/.test(raw)) {
                                setCardData({...cardData, creditLimit: raw});
                              }
                            }}
                            placeholder="Ej: 5.000.000"
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Monto máximo que puedes gastar con esta tarjeta
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex space-x-3">
                      <button
                        type="submit"
                        disabled={isLoadingCardOperation}
                        className={`flex-1 text-white py-2 px-4 rounded-lg transition-colors ${
                          isLoadingCardOperation 
                            ? 'bg-blue-400 cursor-not-allowed' 
                            : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                      >
                        {isLoadingCardOperation ? 'Procesando...' : (editingCard ? 'Actualizar' : 'Agregar')}
                      </button>
                      <button
                        type="button"
                        onClick={closeCardsModal}
                        className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Pago de Tarjeta */}
        {showPayCardModal && payingCard && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Pagar Tarjeta de Crédito</h3>
                <button
                  onClick={() => setShowPayCardModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <CreditCard className="h-5 w-5 text-blue-600" />
                  <span className="font-medium">{payingCard.bank}</span>
                  <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
                    Crédito
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-1">
                  {payingCard.nickname} •••• {payingCard.lastFourDigits}
                </p>
                <p className="text-sm font-medium text-red-600">
                  Saldo pendiente: {formatCurrency(getCreditCardPendingAmount(payingCard.id))}
                </p>
              </div>

              <form onSubmit={handlePayCreditCard}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Monto a Pagar
                    </label>
                    <input
                      type="text"
                      value={formatNumberThousands(payAmount)}
                      onChange={e => {
                        const raw = parseNumberThousands(e.target.value);
                        if (/^\d*$/.test(raw)) {
                          setPayAmount(raw);
                        }
                      }}
                      placeholder="0"
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Máximo: {formatCurrency(getCreditCardPendingAmount(payingCard.id))}
                    </p>
                  </div>
                </div>

                <div className="flex space-x-3 mt-6">
                  <button
                    type="submit"
                    disabled={isLoadingCardOperation}
                    className={`flex-1 text-white py-2 px-4 rounded-lg transition-colors ${
                      isLoadingCardOperation 
                        ? 'bg-green-400 cursor-not-allowed' 
                        : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {isLoadingCardOperation ? 'Procesando...' : 'Pagar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPayCardModal(false)}
                    className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Abono */}
        {showAbonoModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">Realizar Abono</h3>
              <form onSubmit={handleAbono}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Balance
                    </label>
                    <select
                      value={abonoData.balanceId}
                      onChange={(e) => setAbonoData({...abonoData, balanceId: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Seleccionar balance</option>
                      {allBalancesWithAmounts.map(balance => (
                        <option key={balance.id} value={balance.id}>
                          {balance.name} - {formatCurrency(balance.currentAmount)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Monto del Abono
                    </label>
                    <input
                      type="text"
                      value={abonoData.amount}
                      onChange={(e) => setAbonoData({...abonoData, amount: e.target.value})}
                      placeholder="0"
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Descripción (opcional)
                    </label>
                    <input
                      type="text"
                      value={abonoData.description}
                      onChange={(e) => setAbonoData({...abonoData, description: e.target.value})}
                      placeholder="Descripción del abono"
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="flex space-x-3 mt-6">
                  <button
                    type="submit"
                    disabled={isLoadingAbono}
                    className={`flex-1 text-white py-2 px-4 rounded-lg transition-colors ${
                      isLoadingAbono 
                        ? 'bg-green-400 cursor-not-allowed' 
                        : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {isLoadingAbono ? 'Procesando...' : 'Realizar Abono'}
                  </button>
                  <button
                    type="button"
                    onClick={closeAbonoModal}
                    className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Balance Futuro */}
        {showFutureBalanceModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">Crear Balance Futuro</h3>
              <form onSubmit={createFutureBalance}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre del Balance
                    </label>
                    <input
                      type="text"
                      value={futureBalanceData.name}
                      onChange={(e) => setFutureBalanceData({...futureBalanceData, name: e.target.value})}
                      placeholder="Ej: Gastos Diciembre 2024"
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mes Objetivo
                    </label>
                    <input
                      type="month"
                      value={futureBalanceData.targetMonth}
                      onChange={(e) => setFutureBalanceData({...futureBalanceData, targetMonth: e.target.value})}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Descripción (opcional)
                    </label>
                    <textarea
                      value={futureBalanceData.description}
                      onChange={(e) => setFutureBalanceData({...futureBalanceData, description: e.target.value})}
                      placeholder="Descripción del balance futuro"
                      rows="3"
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="flex space-x-3 mt-6">
                  <button
                    type="submit"
                    disabled={isLoadingBalance}
                    className={`flex-1 text-white py-2 px-4 rounded-lg transition-colors ${
                      isLoadingBalance 
                        ? 'bg-blue-400 cursor-not-allowed' 
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isLoadingBalance ? 'Creando...' : 'Crear Balance Futuro'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowFutureBalanceModal(false)}
                    className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Alerta Personalizada */}
        {customAlert.show && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 transform transition-all duration-300 scale-100">
              <div className="p-6">
                <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-blue-100">
                  {customAlert.type === 'confirm' && (
                    <AlertTriangle className="h-6 w-6 text-blue-600" />
                  )}
                  {customAlert.type === 'info' && (
                    <AlertTriangle className="h-6 w-6 text-blue-600" />
                  )}
                  {customAlert.type === 'warning' && (
                    <AlertTriangle className="h-6 w-6 text-yellow-600" />
                  )}
                  {customAlert.type === 'error' && (
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  )}
                </div>
                
                <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
                  {customAlert.title}
                </h3>
                
                <p className="text-gray-600 text-center mb-6">
                  {customAlert.message}
                </p>
                
                <div className="flex space-x-3">
                  <button
                    onClick={handleAlertCancel}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors duration-200 font-medium"
                  >
                    {customAlert.cancelText}
                  </button>
                  <button
                    onClick={handleAlertConfirm}
                    className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors duration-200 font-medium ${
                      customAlert.type === 'error' 
                        ? 'bg-red-600 hover:bg-red-700'
                        : customAlert.type === 'warning'
                        ? 'bg-yellow-600 hover:bg-yellow-700'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {customAlert.confirmText}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
} 
