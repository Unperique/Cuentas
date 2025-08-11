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
  AlertCircle
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
    if (!newExpense.description || !newExpense.amount || newExpense.splitBetween.length === 0) {
      toast.error('Por favor completa todos los campos');
      return;
    }

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

  function calculateDebts() {
    if (!expenses.length || !members.length) return [];

    const debts = {};
    members.forEach(member => {
      debts[member.id] = 0;
    });

    expenses.forEach(expense => {
      const paidBy = expense.paidBy;
      const amount = parseFloat(expense.amount) || 0;
      const splitAmount = parseFloat(expense.splitAmount) || 0;

      // Quienes deben pagan (considerando múltiples participaciones)
      if (expense.splitBetween && Array.isArray(expense.splitBetween)) {
        expense.splitBetween.forEach(memberId => {
          if (debts[memberId] !== undefined) {
            const shares = expense.memberShares?.[memberId] || 1;
            const totalDebt = splitAmount * shares;
            
            if (memberId === paidBy) {
              // Si quien debe es quien pagó, recibe el dinero de las otras participaciones
              // Solo se descuenta 1 participación (la suya propia)
              debts[memberId] += amount - splitAmount;
            } else {
              // Si no pagó, debe todo lo que le corresponde
              debts[memberId] -= totalDebt;
            }
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
    const debts = calculateDebts();
    const individualDebts = [];

    // Separar quienes deben dinero y quienes deben recibir
    const debtors = debts.filter(debt => debt.balance < 0);
    const creditors = debts.filter(debt => debt.balance > 0);

    // Calcular deudas individuales
    debtors.forEach(debtor => {
      const amountOwed = Math.abs(debtor.balance);
      let remainingDebt = amountOwed;

      creditors.forEach(creditor => {
        if (remainingDebt > 0 && creditor.balance > 0) {
          const paymentAmount = Math.min(remainingDebt, creditor.balance);
          
          if (paymentAmount > 0) {
            individualDebts.push({
              from: debtor.member?.displayName || 'Usuario',
              fromId: debtor.memberId,
              to: creditor.member?.displayName || 'Usuario',
              toId: creditor.memberId,
              amount: paymentAmount
            });

            remainingDebt -= paymentAmount;
            creditor.balance -= paymentAmount;
          }
        }
      });
    });

    return individualDebts;
  }

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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Gastos</p>
                <p className="text-2xl font-semibold text-gray-900">
                  ${totalExpenses.toFixed(2)}
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
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <User className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Promedio</p>
                <p className="text-2xl font-semibold text-gray-900">
                  ${members.length > 0 ? (totalExpenses / members.length).toFixed(2) : '0.00'}
                </p>
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
                    className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Agregar Gasto</span>
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
                        <div key={expense.id} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h3 className="font-medium text-gray-900">{expense.description}</h3>
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
                            <div className="text-right">
                              <p className="text-lg font-semibold text-gray-900">
                                ${expense.amount.toFixed(2)}
                              </p>
                              <p className="text-sm text-gray-600">
                                ${expense.splitAmount.toFixed(2)} c/u
                              </p>
                            </div>
                            {expense.createdBy === currentUser.uid && (
                              <button
                                onClick={() => deleteExpense(expense.id)}
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
                  <h2 className="text-lg font-semibold text-gray-900">Balance de Deudas</h2>
                  <button
                    onClick={() => setShowIndividualDebts(!showIndividualDebts)}
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                  >
                    <User className="h-4 w-4" />
                    <span>{showIndividualDebts ? 'Ver balance' : 'Ver deudas'}</span>
                  </button>
                </div>
              </div>
              
              <div className="p-6">
                {!showIndividualDebts ? (
                  /* Balance General */
                  <div className="space-y-4">
                    {debts.map(({ memberId, balance, member }) => (
                      <div key={memberId} className="border rounded-lg p-3">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-gray-900">
                            {member?.displayName || 'Usuario'}
                          </span>
                          <span className="text-sm font-semibold text-gray-900">
                            ${Math.abs(balance).toFixed(2)}
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
                        
                        {/* Botón para editar cuentas */}
                        <div className="mt-2 flex justify-end">
                          <button
                            onClick={() => openAccountsModal(member)}
                            className="text-xs text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                            disabled={memberId !== currentUser.uid}
                          >
                            <User className="h-3 w-3" />
                            <span>
                              {memberId === currentUser.uid 
                                ? (userAccounts[memberId]?.length > 0 ? 'Editar cuentas' : 'Agregar cuentas')
                                : 'Ver cuentas'
                              }
                            </span>
                          </button>
                        </div>
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
                                ${debt.amount.toFixed(2)}
                              </span>
                              {userAccounts[debt.toId] && userAccounts[debt.toId].length > 0 && (
                                <button
                                  onClick={() => {
                                    const member = members.find(m => m.id === debt.toId);
                                    openAccountsModal(member);
                                  }}
                                  className="text-xs text-blue-600 hover:text-blue-800"
                                  title="Ver cuentas para pagar"
                                >
                                  <User className="h-3 w-3" />
                                </button>
                              )}
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
                      type="number"
                      step="0.01"
                      value={newExpense.amount}
                      onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0.00"
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
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
                  >
                    Agregar
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
        <h3 className="text-lg font-semibold mb-4">
          {isOwner ? 'Mis Cuentas' : `Cuentas de ${member.displayName || 'Usuario'}`}
        </h3>
        
        {isOwner ? (
          <div className="space-y-4">
            {localAccounts.map((account, index) => (
              <div key={index} className="border rounded-lg p-3">
                <div className="space-y-2">
                  <select
                    value={account.type}
                    onChange={(e) => updateAccount(index, 'type', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-sm"
                  >
                    <option value="">Seleccionar tipo</option>
                    <option value="Banco">Banco</option>
                    <option value="PayPal">PayPal</option>
                    <option value="Venmo">Venmo</option>
                    <option value="Zelle">Zelle</option>
                    <option value="CashApp">CashApp</option>
                    <option value="Bizum">Bizum</option>
                    <option value="Otro">Otro</option>
                  </select>
                  
                  <input
                    type="text"
                    value={account.info}
                    onChange={(e) => updateAccount(index, 'info', e.target.value)}
                    placeholder="Número de cuenta, email, etc."
                    className="w-full p-2 border border-gray-300 rounded text-sm"
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
                <div key={index} className="border rounded-lg p-3 bg-gray-50">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">
                      <strong>{account.type}:</strong> {account.info}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(account.info);
                        toast.success('Información copiada');
                      }}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-600 text-center py-4">
                Este usuario no ha agregado cuentas aún
              </p>
            )}
            
            <button
              onClick={onClose}
              className="w-full bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 