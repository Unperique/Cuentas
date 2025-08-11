import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  ArrowLeft, 
  Users, 
  Check, 
  X,
  UserPlus,
  AlertCircle
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  arrayUnion,
  setDoc 
} from 'firebase/firestore';
import { db } from '../firebase';
import toast from 'react-hot-toast';

export default function JoinRoom() {
  const { code } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!code || !currentUser) return;

    async function findRoom() {
      try {
        const q = query(
          collection(db, 'rooms'),
          where('code', '==', code.toUpperCase())
        );
        
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          toast.error('Código de sala inválido');
          navigate('/dashboard');
          return;
        }

        const roomDoc = querySnapshot.docs[0];
        const roomData = { id: roomDoc.id, ...roomDoc.data() };

        // Verificar si el usuario ya es miembro
        if (roomData.members && roomData.members.includes(currentUser.uid)) {
          toast.info('Ya eres miembro de esta sala');
          navigate(`/room/${roomData.id}`);
          return;
        }

        setRoom(roomData);
      } catch (error) {
        toast.error('Error al buscar la sala');
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    }

    findRoom();
  }, [code, currentUser, navigate]);

  async function joinRoom() {
    if (!room || !currentUser) return;

    try {
      setJoining(true);

      // Agregar usuario a la sala
      await updateDoc(doc(db, 'rooms', room.id), {
        members: arrayUnion(currentUser.uid)
      });

      // Crear o actualizar documento del usuario
      await setDoc(doc(db, 'users', currentUser.uid), {
        displayName: currentUser.displayName || 'Usuario',
        email: currentUser.email,
        uid: currentUser.uid,
        joinedAt: new Date()
      }, { merge: true });

      toast.success('¡Te has unido a la sala exitosamente!');
      navigate(`/room/${room.id}`);
    } catch (error) {
      toast.error('Error al unirse a la sala');
    } finally {
      setJoining(false);
    }
  }

  function goBack() {
    navigate('/dashboard');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verificando código...</p>
        </div>
      </div>
    );
  }

  if (!room) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={goBack}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-5 w-5" />
                <span>Volver</span>
              </button>
              <h1 className="text-xl font-semibold text-gray-900">Unirse a Sala</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header de la sala */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-8 text-white">
            <div className="text-center">
              <Users className="h-16 w-16 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">{room.name}</h2>
              <p className="text-blue-100">Código: {room.code}</p>
            </div>
          </div>

          {/* Información de la sala */}
          <div className="p-6">
            <div className="space-y-6">
              {/* Detalles */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Detalles de la Sala
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Nombre:</span>
                    <span className="font-medium text-gray-900">{room.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Código:</span>
                    <span className="font-mono font-medium text-gray-900">{room.code}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Miembros actuales:</span>
                    <span className="font-medium text-gray-900">{room.members?.length || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Creada:</span>
                    <span className="font-medium text-gray-900">
                      {room.createdAt?.toDate ? room.createdAt.toDate().toLocaleDateString() : 'Reciente'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Beneficios */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-blue-900 mb-4">
                  ¿Qué puedes hacer en esta sala?
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <Check className="h-5 w-5 text-green-600" />
                    <span className="text-blue-800">Agregar y gestionar gastos</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="h-5 w-5 text-green-600" />
                    <span className="text-blue-800">Ver balance de deudas en tiempo real</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="h-5 w-5 text-green-600" />
                    <span className="text-blue-800">Compartir gastos equitativamente</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Check className="h-5 w-5 text-green-600" />
                    <span className="text-blue-800">Sincronización automática con todos los miembros</span>
                  </div>
                </div>
              </div>

              {/* Advertencia */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-yellow-800">
                      Información importante
                    </h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      Al unirte a esta sala, tendrás acceso a todos los gastos y podrás agregar nuevos. 
                      Asegúrate de que el código sea correcto antes de continuar.
                    </p>
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex space-x-4">
                <button
                  onClick={joinRoom}
                  disabled={joining}
                  className="flex-1 flex items-center justify-center space-x-2 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {joining ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Uniéndose...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-5 w-5" />
                      <span>Unirse a la Sala</span>
                    </>
                  )}
                </button>
                
                <button
                  onClick={goBack}
                  className="flex-1 flex items-center justify-center space-x-2 bg-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  <X className="h-5 w-5" />
                  <span>Cancelar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 