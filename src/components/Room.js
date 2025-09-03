import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  ArrowLeft, 
  Plus, 
  DollarSign, 
  Users, 
  User, 
  Trash2,
  Copy,
  Check,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { 
  doc, 
  getDoc, 
  onSnapshot, 
  addDoc, 
  deleteDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  collection,
  query,
  where,
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';
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
  return value.replace(/\./g, '').replace(/,/g, '');
}

export default function Room() {
  const { roomId } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [members, setMembers] = useState([]);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [newExpense, setNewExpense] = useState({
    description: '',
    amount: '',
    paidBy: currentUser?.uid || '',
    splitBetween: []
  });
  const [memberShares, setMemberShares] = useState({});
  const [copiedCode, setCopiedCode] = useState(false);
  const [showAccountsModal, setShowAccountsModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [userAccounts, setUserAccounts] = useState({});
  const [showIndividualDebts, setShowIndividualDebts] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);
  const [isLoadingExpense, setIsLoadingExpense] = useState(false);
  const [isLoadingMember, setIsLoadingMember] = useState(false);

  useEffect(() => {
    if (!roomId || !currentUser) return;

    // Escuchar cambios en la sala
    const roomUnsubscribe = onSnapshot(doc(db, 'rooms', roomId), (roomDoc) => {
      if (roomDoc.exists()) {
        const roomData = { id: roomDoc.id, ...roomDoc.data() };
        setRoom(roomData);
        
        // Obtener información de miembros
        if (roomData.members) {
          Promise.all(
            roomData.members.map(async (memberId) => {
              const userDoc = await getDoc(doc(db, 'users', memberId));
              return userDoc.exists() ? { id: memberId, ...userDoc.data() } : { id: memberId, displayName: 'Usuario' };
            })
          ).then((membersData) => {
            setMembers(membersData);
            
            // Cargar cuentas de usuarios
            const accounts = {};
            membersData.forEach(member => {
              if (member.accounts) {
                accounts[member.id] = member.accounts;
              }
            });
            setUserAccounts(accounts);
          });
        }
      } else {
        toast.error('Sala no encontrada');
        navigate('/dashboard');
      }
    });

    // Escuchar cambios en gastos
    const expensesUnsubscribe = onSnapshot(
      query(
        collection(db, 'expenses'),
        where('roomId', '==', roomId)
      ),
      (snapshot) => {
        const expensesData = snapshot.docs.map(expenseDoc => ({
          id: expenseDoc.id,
          ...expenseDoc.data()
        }));
        // Ordenar por fecha de creación (más reciente primero)
        expensesData.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
          const dateB = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
          return dateB - dateA;
        });
        setExpenses(expensesData);
      }
    );

    return () => {
      roomUnsubscribe();
      expensesUnsubscribe();
    };
  }, [roomId, currentUser, navigate]);

  async function addExpense(e) {
    e.preventDefault();
    if (isLoadingExpense) return; // Prevenir múltiples clicks
    
    if (!newExpense.description || !newExpense.amount || newExpense.splitBetween.length === 0) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    setIsLoadingExpense(true);
    try {
      const amount = parseFloat(newExpense.amount);
      
      // Calcular el total de participaciones
      const totalShares = newExpense.splitBetween.reduce((total, memberId) => {
        return total + (memberShares[memberId] || 1);
      }, 0);
      
      const splitAmount = amount / totalShares;

      await addDoc(collection(db, 'expenses'), {
        roomId,
        description: newExpense.description,
        amount,
        paidBy: newExpense.paidBy,
        splitBetween: newExpense.splitBetween,
        splitAmount,
        memberShares: memberShares,
        totalShares,
        createdBy: currentUser.uid,
        createdAt: serverTimestamp()
      });

      setNewExpense({
        description: '',
        amount: '',
        paidBy: currentUser.uid,
        splitBetween: []
      });
      setMemberShares({});
      setShowAddExpense(false);
      toast.success('Gasto agregado exitosamente');
    } catch (error) {
      toast.error('Error al agregar el gasto');
    } finally {
      setIsLoadingExpense(false);
    }
  }

  async function deleteExpense(expenseId) {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este gasto?')) return;

    try {
      await deleteDoc(doc(db, 'expenses', expenseId));
      toast.success('Gasto eliminado');
    } catch (error) {
      toast.error('Error al eliminar el gasto');
    }
  }

  function copyCode() {
    if (room?.code) {
      navigator.clipboard.writeText(room.code);
      setCopiedCode(true);
      toast.success('Código copiado al portapapeles');
      setTimeout(() => setCopiedCode(false), 2000);
    }
  }

  function openAccountsModal(member) {
    setSelectedMember(member);
    setShowAccountsModal(true);
  }

  async function saveUserAccounts(accounts) {
    if (!selectedMember) return;

    try {
      await updateDoc(doc(db, 'users', selectedMember.id), {
        accounts: accounts
      });

      // Actualizar estado local
      setUserAccounts(prev => ({
        ...prev,
        [selectedMember.id]: accounts
      }));

      setShowAccountsModal(false);
      setSelectedMember(null);
      toast.success('Cuentas actualizadas correctamente');
    } catch (error) {
      toast.error('Error al actualizar las cuentas');
    }
  }

  function copyAccountInfo(accountInfo) {
    navigator.clipboard.writeText(accountInfo);
    toast.success('Información copiada al portapapeles');
  }

  function openExpenseModal(expense) {
    setSelectedExpense(expense);
    setShowExpenseModal(true);
    // Si el usuario actual es el creador, preparar para edición
    if (expense.createdBy === currentUser.uid) {
      setEditingExpense({
        description: expense.description,
        amount: expense.amount.toString(),
        paidBy: expense.paidBy,
        splitBetween: [...expense.splitBetween],
        memberShares: { ...expense.memberShares }
      });
    }
  }

  function closeExpenseModal() {
    setShowExpenseModal(false);
    setSelectedExpense(null);
    setEditingExpense(null);
    setMemberShares({});
  }

  async function updateExpense(e) {
    e.preventDefault();
    if (!editingExpense || !selectedExpense) return;

    if (!editingExpense.description || !editingExpense.amount || editingExpense.splitBetween.length === 0) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    try {
      const amount = parseFloat(editingExpense.amount);
      
      // Calcular el total de participaciones
      const totalShares = editingExpense.splitBetween.reduce((total, memberId) => {
        return total + (editingExpense.memberShares[memberId] || 1);
      }, 0);
      
      const splitAmount = amount / totalShares;

      await updateDoc(doc(db, 'expenses', selectedExpense.id), {
        description: editingExpense.description,
        amount,
        paidBy: editingExpense.paidBy,
        splitBetween: editingExpense.splitBetween,
        splitAmount,
        memberShares: editingExpense.memberShares,
        totalShares,
        updatedAt: serverTimestamp()
      });

      closeExpenseModal();
      toast.success('Gasto actualizado exitosamente');
    } catch (error) {
      toast.error('Error al actualizar el gasto');
    }
  }

  function calculatePaymentSummary() {
    if (!expenses.length || !members.length) return [];

    const payments = {};
    members.forEach(member => {
      payments[member.id] = 0;
    });

    // Sumar todos los pagos por persona
    expenses.forEach(expense => {
      const paidBy = expense.paidBy;
      const amount = parseFloat(expense.amount) || 0;
      
      if (payments[paidBy] !== undefined) {
        payments[paidBy] += amount;
      }
    });

    const result = Object.entries(payments).map(([memberId, totalPaid]) => ({
      memberId,
      totalPaid: parseFloat(totalPaid.toFixed(2)),
      member: members.find(m => m.id === memberId)
    }));

    return result;
  }

  function calculateDebts() {
    if (!expenses.length || !members.length) return [];

    const debts = {};
    members.forEach(member => {
      debts[member.id] = 0;
    });

    expenses.forEach(expense => {
      const paidBy = expense.paidBy;
      const amount = parseFloat(expense.amount) || 0;
      
      // Calcular el total de participaciones para este gasto
      const totalShares = expense.splitBetween.reduce((total, memberId) => {
        return total + (expense.memberShares?.[memberId] || 1);
      }, 0);
      
      const amountPerShare = totalShares > 0 ? amount / totalShares : 0;

      // Quien pagó recibe crédito por el monto total
      if (debts[paidBy] !== undefined) {
        debts[paidBy] += amount;
      }

      // Todos los que participan deben su parte
      if (expense.splitBetween && Array.isArray(expense.splitBetween)) {
        expense.splitBetween.forEach(memberId => {
          if (debts[memberId] !== undefined) {
            const shares = expense.memberShares?.[memberId] || 1;
            const personalDebt = amountPerShare * shares;
            debts[memberId] -= personalDebt;
          }
        });
      }
    });

    const result = Object.entries(debts).map(([memberId, balance]) => ({
      memberId,
      balance: parseFloat(balance.toFixed(2)),
      member: members.find(m => m.id === memberId)
    }));



    return result;
  }

  function calculateIndividualDebts() {
    // Calcular deudas directamente desde los gastos
    const debtMap = {}; // { fromId-toId: amount }
    
    expenses.forEach(expense => {
      const paidBy = expense.paidBy;
      const amount = parseFloat(expense.amount) || 0;
      
      if (!expense.splitBetween || !Array.isArray(expense.splitBetween)) return;
      
      // Calcular el total de participaciones para este gasto
      const totalShares = expense.splitBetween.reduce((total, memberId) => {
        return total + (expense.memberShares?.[memberId] || 1);
      }, 0);
      
      const amountPerShare = totalShares > 0 ? amount / totalShares : 0;
      
      // Para cada participante que no sea quien pagó
      expense.splitBetween.forEach(memberId => {
        if (memberId !== paidBy) {
          const shares = expense.memberShares?.[memberId] || 1;
          const personalDebt = amountPerShare * shares;
          
          if (personalDebt > 0.01) {
            const key = `${memberId}-${paidBy}`;
            debtMap[key] = (debtMap[key] || 0) + personalDebt;
          }
        }
      });
    });

    // Convertir el mapa a array de deudas individuales
    const individualDebts = Object.entries(debtMap).map(([key, amount]) => {
      const [fromId, toId] = key.split('-');
      const fromMember = members.find(m => m.id === fromId);
      const toMember = members.find(m => m.id === toId);
      
      return {
        from: fromMember?.displayName || 'Usuario',
        fromId: fromId,
        to: toMember?.displayName || 'Usuario',
        toId: toId,
        amount: parseFloat(amount.toFixed(2))
      };
    });



    return individualDebts;
  }

  const paymentSummary = calculatePaymentSummary();
  const debts = calculateDebts();
  const individualDebts = calculateIndividualDebts();
  const totalExpenses = expenses.reduce((sum, expense) => sum + (parseFloat(expense.amount) || 0), 0);

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando sala...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-5 w-5" />
                <span>Volver</span>
              </button>
              <h1 className="text-xl font-semibold text-gray-900">{room.name}</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={copyCode}
                className="flex items-center space-x-2 text-blue-600 hover:text-blue-700"
              >
                {copiedCode ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span className="font-mono">{room.code}</span>
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
              <DollarSign className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Gastos</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {formatCurrency(totalExpenses)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Miembros</p>
                <p className="text-2xl font-semibold text-gray-900">{members.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <AlertCircle className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Gastos</p>
                <p className="text-2xl font-semibold text-gray-900">{expenses.length}</p>
              </div>
            </div>
          </div>

        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Expenses List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-gray-900">Gastos</h2>
                  <button
                    onClick={() => setShowAddExpense(true)}
                    disabled={isLoadingExpense}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                      isLoadingExpense 
                        ? 'bg-blue-400 cursor-not-allowed' 
                        : 'bg-blue-600 hover:bg-blue-700'
                    } text-white`}
                  >
                    {isLoadingExpense ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    <span>{isLoadingExpense ? 'Procesando...' : 'Agregar Gasto'}</span>
                  </button>
                </div>
              </div>
              
              <div className="p-6">
                {expenses.length === 0 ? (
                  <div className="text-center py-8">
                    <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No hay gastos registrados</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {expenses.map((expense) => {
                      const paidByMember = members.find(m => m.id === expense.paidBy);
                      return (
                        <div key={expense.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex justify-between items-start">
                            <div 
                              className="flex-1 cursor-pointer"
                              onClick={() => openExpenseModal(expense)}
                            >
                              <h3 className="font-medium text-gray-900 hover:text-blue-600">{expense.description}</h3>
                              <p className="text-sm text-gray-600">
                                Pagado por: {paidByMember?.displayName || 'Usuario'}
                              </p>
                              <p className="text-sm text-gray-600">
                                 Dividido entre: {expense.splitBetween.length} personas
                                 {expense.memberShares && Object.keys(expense.memberShares).length > 0 && (
                                   <span className="text-xs text-gray-500 ml-1">
                                     ({Object.entries(expense.memberShares).map(([memberId, shares]) => {
                                       const member = members.find(m => m.id === memberId);
                                       return `${member?.displayName || 'Usuario'} ${shares}x`;
                                     }).join(', ')})
                                   </span>
                                 )}
                               </p>
                            </div>
                            <div 
                              className="text-right cursor-pointer"
                              onClick={() => openExpenseModal(expense)}
                            >
                              <p className="text-lg font-semibold text-gray-900">
                                {formatCurrency(expense.amount)}
                              </p>
                              <p className="text-sm text-gray-600">
                                {formatCurrency(expense.splitAmount)} c/u
                              </p>
                            </div>
                            {expense.createdBy === currentUser.uid && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteExpense(expense.id);
                                }}
                                className="ml-4 text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Debts Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-gray-900">{showIndividualDebts ? 'Deudas Individuales' : 'Resumen de Pagos'}</h2>
                  <button
                    onClick={() => setShowIndividualDebts(!showIndividualDebts)}
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                  >
                    <User className="h-4 w-4" />
                    <span>{showIndividualDebts ? 'Ver pagos' : 'Ver deudas'}</span>
                  </button>
                </div>
              </div>
              
              <div className="p-6">
                {!showIndividualDebts ? (
                  /* Resumen de Pagos */
                  <div className="space-y-4">
                    {paymentSummary.map(({ memberId, totalPaid, member }) => (
                      <div key={memberId} className="border rounded-lg p-3">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-gray-900">
                            {member?.displayName || 'Usuario'}
                          </span>
                          <span className="text-sm font-semibold text-green-600">
                            {formatCurrency(totalPaid)} pagado
                          </span>
                        </div>
                        
                        {/* Mostrar cuentas si existen */}
                        {userAccounts[memberId] && userAccounts[memberId].length > 0 && (
                          <div className="mt-2 space-y-1">
                            {userAccounts[memberId].map((account, index) => (
                              <div key={index} className="flex items-center justify-between text-xs text-gray-600 bg-gray-50 p-2 rounded">
                                <span>
                                  <strong>{account.type}:</strong> {account.info}
                                </span>
                                <button
                                  onClick={() => copyAccountInfo(account.info)}
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Botón para editar cuentas - solo para el usuario actual */}
                        {memberId === currentUser.uid && (
                          <div className="mt-2 flex justify-end">
                            <button
                              onClick={() => openAccountsModal(member)}
                              className="text-xs text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                            >
                              <User className="h-3 w-3" />
                              <span>
                                {userAccounts[memberId]?.length > 0 ? 'Editar cuentas' : 'Agregar cuentas'}
                              </span>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Deudas Individuales */
                  <div className="space-y-3">
                    {individualDebts.length > 0 ? (
                      individualDebts.map((debt, index) => (
                        <div key={index} className="border rounded-lg p-3 bg-red-50 border-red-200">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                              <span className="text-sm font-medium text-gray-900">
                                <strong>{debt.from}</strong> le debe a <strong>{debt.to}</strong>
                              </span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-semibold text-red-600">
                                {formatCurrency(debt.amount)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4">
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                          <Check className="h-6 w-6 text-green-600" />
                        </div>
                        <p className="text-sm text-gray-600">¡Todas las deudas están saldadas!</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Add Expense Modal */}
        {showAddExpense && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">Agregar Gasto</h3>
              <form onSubmit={addExpense}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Descripción
                    </label>
                    <input
                      type="text"
                      value={newExpense.description}
                      onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ej: Cena, Transporte, etc."
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Monto
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatNumberThousands(newExpense.amount)}
                      onChange={e => {
                        const raw = parseNumberThousands(e.target.value);
                        if (/^\d*$/.test(raw)) {
                          setNewExpense({ ...newExpense, amount: raw });
                        }
                      }}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Pagado por
                    </label>
                    <select
                      value={newExpense.paidBy}
                      onChange={(e) => setNewExpense({...newExpense, paidBy: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      {members.map(member => (
                        <option key={member.id} value={member.id}>
                          {member.displayName || 'Usuario'}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                                     <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                       Dividir entre
                     </label>
                     <div className="space-y-3">
                       {members.map(member => (
                         <div key={member.id} className="flex items-center justify-between">
                           <label className="flex items-center">
                             <input
                               type="checkbox"
                               checked={newExpense.splitBetween.includes(member.id)}
                               onChange={(e) => {
                                 const updated = e.target.checked
                                   ? [...newExpense.splitBetween, member.id]
                                   : newExpense.splitBetween.filter(id => id !== member.id);
                                 setNewExpense({...newExpense, splitBetween: updated});
                                 
                                 // Limpiar participaciones si se deselecciona
                                 if (!e.target.checked) {
                                   const newMemberShares = { ...memberShares };
                                   delete newMemberShares[member.id];
                                   setMemberShares(newMemberShares);
                                 }
                               }}
                               className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                             />
                             <span className="ml-2 text-sm text-gray-700">
                               {member.displayName || 'Usuario'}
                             </span>
                           </label>
                           
                           {newExpense.splitBetween.includes(member.id) && (
                             <div className="flex items-center space-x-2">
                               <span className="text-xs text-gray-500">Participaciones:</span>
                               <select
                                 value={memberShares[member.id] || 1}
                                 onChange={(e) => {
                                   const shares = parseInt(e.target.value);
                                   setMemberShares({
                                     ...memberShares,
                                     [member.id]: shares
                                   });
                                 }}
                                 className="text-xs border border-gray-300 rounded px-2 py-1"
                               >
                                 <option value={1}>1x</option>
                                 <option value={2}>2x</option>
                                 <option value={3}>3x</option>
                                 <option value={4}>4x</option>
                                 <option value={5}>5x</option>
                                 <option value={6}>6x</option>
                               </select>
                             </div>
                           )}
                         </div>
                       ))}
                     </div>
                   </div>
                </div>
                
                <div className="flex space-x-3 mt-6">
                  <button
                    type="submit"
                    disabled={isLoadingExpense}
                    className={`flex-1 flex items-center justify-center space-x-2 text-white py-2 px-4 rounded-lg transition-colors ${
                      isLoadingExpense 
                        ? 'bg-blue-400 cursor-not-allowed' 
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isLoadingExpense && <Loader2 className="h-4 w-4 animate-spin" />}
                    <span>{isLoadingExpense ? 'Agregando...' : 'Agregar'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddExpense(false)}
                    className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Expense Details/Edit Modal */}
        {showExpenseModal && selectedExpense && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">
                  {editingExpense ? 'Editar Gasto' : 'Detalles del Gasto'}
                </h3>
                <button
                  onClick={closeExpenseModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {editingExpense ? (
                /* Modo Edición */
                <form onSubmit={updateExpense}>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Descripción
                      </label>
                      <input
                        type="text"
                        value={editingExpense.description}
                        onChange={(e) => setEditingExpense({...editingExpense, description: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Ej: Cena, Transporte, etc."
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Monto
                      </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formatNumberThousands(editingExpense.amount)}
                          onChange={e => {
                            const raw = parseNumberThousands(e.target.value);
                            if (/^\d*$/.test(raw)) {
                              setEditingExpense({ ...editingExpense, amount: raw });
                            }
                          }}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="0"
                          required
                        />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Pagado por
                      </label>
                      <select
                        value={editingExpense.paidBy}
                        onChange={(e) => setEditingExpense({...editingExpense, paidBy: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      >
                        {members.map(member => (
                          <option key={member.id} value={member.id}>
                            {member.displayName || 'Usuario'}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <label className="block text-sm font-medium text-gray-700">
                          Dividir entre
                        </label>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          {editingExpense.splitBetween.length} persona{editingExpense.splitBetween.length !== 1 ? 's' : ''} seleccionada{editingExpense.splitBetween.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="space-y-3 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                        {members.map(member => (
                          <div key={member.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                            <label className="flex items-center flex-1">
                              <input
                                type="checkbox"
                                checked={editingExpense.splitBetween.includes(member.id)}
                                onChange={(e) => {
                                  const updated = e.target.checked
                                    ? [...editingExpense.splitBetween, member.id]
                                    : editingExpense.splitBetween.filter(id => id !== member.id);
                                  
                                  // Limpiar participaciones si se deselecciona
                                  const newMemberShares = { ...editingExpense.memberShares };
                                  if (!e.target.checked) {
                                    delete newMemberShares[member.id];
                                  } else {
                                    // Establecer participación por defecto si se selecciona
                                    newMemberShares[member.id] = 1;
                                  }
                                  
                                  setEditingExpense({
                                    ...editingExpense, 
                                    splitBetween: updated,
                                    memberShares: newMemberShares
                                  });
                                }}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-3"
                              />
                              <span className="text-sm text-gray-700 font-medium">
                                {member.displayName || 'Usuario'}
                              </span>
                            </label>
                            
                            {editingExpense.splitBetween.includes(member.id) && (
                              <div className="flex items-center space-x-2">
                                <span className="text-xs text-gray-500">Participaciones:</span>
                                <select
                                  value={editingExpense.memberShares[member.id] || 1}
                                  onChange={(e) => {
                                    const shares = parseInt(e.target.value);
                                    setEditingExpense({
                                      ...editingExpense,
                                      memberShares: {
                                        ...editingExpense.memberShares,
                                        [member.id]: shares
                                      }
                                    });
                                  }}
                                  className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                  <option value={1}>1x</option>
                                  <option value={2}>2x</option>
                                  <option value={3}>3x</option>
                                  <option value={4}>4x</option>
                                  <option value={5}>5x</option>
                                  <option value={6}>6x</option>
                                </select>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex space-x-3 mt-6">
                    <button
                      type="submit"
                      className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
                    >
                      Actualizar
                    </button>
                    <button
                      type="button"
                      onClick={closeExpenseModal}
                      className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                /* Modo Solo Lectura */
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Descripción</p>
                    <p className="text-lg text-gray-900">{selectedExpense.description}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-gray-700">Monto Total</p>
                    <p className="text-2xl font-semibold text-green-600">{formatCurrency(selectedExpense.amount)}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-gray-700">Pagado por</p>
                    <p className="text-gray-900">
                      {members.find(m => m.id === selectedExpense.paidBy)?.displayName || 'Usuario'}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-gray-700">Dividido entre</p>
                    <div className="space-y-2">
                      {selectedExpense.splitBetween.map(memberId => {
                        const member = members.find(m => m.id === memberId);
                        const shares = selectedExpense.memberShares?.[memberId] || 1;
                        const amountPerShare = selectedExpense.amount / selectedExpense.totalShares;
                        const personalAmount = amountPerShare * shares;
                        
                        return (
                          <div key={memberId} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                            <span className="text-sm text-gray-900">
                              {member?.displayName || 'Usuario'}
                              {shares > 1 && <span className="text-xs text-gray-500 ml-1">({shares}x)</span>}
                            </span>
                            <span className="text-sm font-medium text-gray-900">
                              {formatCurrency(personalAmount)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Creado por</span>
                      <span className="text-sm text-gray-900">
                        {members.find(m => m.id === selectedExpense.createdBy)?.displayName || 'Usuario'}
                      </span>
                    </div>
                    {selectedExpense.createdAt && (
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-sm font-medium text-gray-700">Fecha</span>
                        <span className="text-sm text-gray-900">
                          {selectedExpense.createdAt.toDate().toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex space-x-3 mt-6">
                    {selectedExpense.createdBy === currentUser.uid && (
                      <button
                        onClick={() => {
                          setEditingExpense({
                            description: selectedExpense.description,
                            amount: selectedExpense.amount.toString(),
                            paidBy: selectedExpense.paidBy,
                            splitBetween: [...selectedExpense.splitBetween],
                            memberShares: { ...selectedExpense.memberShares }
                          });
                        }}
                        className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
                      >
                        Editar
                      </button>
                    )}
                    <button
                      onClick={closeExpenseModal}
                      className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Accounts Modal */}
        {showAccountsModal && selectedMember && (
          <AccountsModal
            member={selectedMember}
            accounts={userAccounts[selectedMember.id] || []}
            onSave={saveUserAccounts}
            onClose={() => {
              setShowAccountsModal(false);
              setSelectedMember(null);
            }}
            isOwner={selectedMember.id === currentUser.uid}
          />
        )}
      </div>
    </div>
  );
}

// Componente del Modal de Cuentas
function AccountsModal({ member, accounts, onSave, onClose, isOwner }) {
  const [localAccounts, setLocalAccounts] = useState(accounts || []);

  const addAccount = () => {
    setLocalAccounts([...localAccounts, { type: '', info: '' }]);
  };

  const updateAccount = (index, field, value) => {
    const updated = localAccounts.map((account, i) => 
      i === index ? { ...account, [field]: value } : account
    );
    setLocalAccounts(updated);
  };

  const removeAccount = (index) => {
    setLocalAccounts(localAccounts.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const validAccounts = localAccounts.filter(account => 
      account.type.trim() && account.info.trim()
    );
    onSave(validAccounts);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-96 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">
            {isOwner ? 'Mis Cuentas' : `Cuentas de ${member.displayName || 'Usuario'}`}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {isOwner ? (
          <div className="space-y-4">
            {localAccounts.map((account, index) => (
              <div key={index} className="border rounded-lg p-3">
                <div className="space-y-2">
                  <select
                    value={account.type}
                    onChange={(e) => updateAccount(index, 'type', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Seleccionar tipo</option>
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
                    </optgroup>
                    <optgroup label="Billeteras Digitales">
                      <option value="Nequi">Nequi</option>
                      <option value="Daviplata">Daviplata</option>
                      <option value="Movii">Movii</option>
                      <option value="Lulo Bank">Lulo Bank</option>
                      <option value="RappiPay">RappiPay</option>
                    </optgroup>
                    <optgroup label="Internacionales">
                      <option value="PayPal">PayPal</option>
                      <option value="Wise">Wise</option>
                      <option value="Remitly">Remitly</option>
                      <option value="Western Union">Western Union</option>
                    </optgroup>
                    <option value="Efectivo">Efectivo</option>
                    <option value="Otro">Otro</option>
                  </select>
                  
                  <input
                    type="text"
                    value={account.info}
                    onChange={(e) => updateAccount(index, 'info', e.target.value)}
                    placeholder={
                      account.type.includes('Banco') ? "Número de cuenta bancaria" :
                      account.type === 'Nequi' || account.type === 'Daviplata' || account.type === 'Movii' ? "Número de celular" :
                      account.type === 'PayPal' ? "Email de PayPal" :
                      account.type === 'Efectivo' ? "Descripción (ej: Efectivo en mano)" :
                      "Información de la cuenta"
                    }
                    className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  
                  <button
                    onClick={() => removeAccount(index)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
            
            <button
              onClick={addAccount}
              className="w-full p-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600"
            >
              + Agregar cuenta
            </button>
            
            <div className="flex space-x-2 mt-6">
              <button
                onClick={handleSave}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
              >
                Guardar
              </button>
              <button
                onClick={onClose}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {accounts.length > 0 ? (
              accounts.map((account, index) => (
                <div key={index} className="border rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-sm font-medium text-gray-700">
                          {account.type}
                        </span>
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                          {account.type.includes('Banco') ? 'Bancario' : 
                           account.type === 'Nequi' || account.type === 'Daviplata' || account.type === 'Movii' ? 'Digital' :
                           account.type === 'Efectivo' ? 'Físico' : 'Otro'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 break-all">
                        {account.info}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(account.info);
                        toast.success('Información copiada al portapapeles');
                      }}
                      className="ml-3 p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Copiar información"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <div className="text-gray-400 mb-2">
                  <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <p className="text-gray-600 mb-1">
                  Este usuario no ha agregado cuentas aún
                </p>
                <p className="text-sm text-gray-500">
                  Las cuentas permiten recibir pagos de manera más fácil
                </p>
              </div>
            )}
            
            <button
              onClick={onClose}
              className="w-full bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 